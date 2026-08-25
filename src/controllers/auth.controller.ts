import { Request, Response } from "express";
import {
  verifyRefreshToken,
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  comparePassword,
} from "../utils/crypto.utils";
import { AppError } from "../utils/app-error.utils";
import { prisma } from "../config/db";
import { OAuth2Client } from "google-auth-library";

export const handleLogin = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { username, password } = req.body;

  if (!username || !password) {
    throw new AppError("Username and password are required", 400);
  }

  // 1. Find user by username
  const user = await prisma.user.findUnique({
    where: { username },
  });

  // 2. Validate user existence and password (assuming custom compare function or library)
  if (!user || !(await comparePassword(password, user.password ?? ""))) {
    throw new AppError("Invalid credentials", 400);
  }

  // 3. Generate access and refresh tokens
  const payload = { userId: user.id };
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  // 4. Return user profile + tokens (DummyJSON format)
  res.status(200).json({
    id: user.id,
    username: user.username,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    gender: user.gender,
    image: user.image,
    accessToken,
    refreshToken,
  });
};

const googleClient = new OAuth2Client(process.env.GOOGLE_WEB_CLIENT_ID);

export const handleGoogleLogin = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { idToken } = req.body;

  if (!idToken) {
    throw new AppError("Google ID token is required", 400);
  }

  let payload;
  try {
    // 1. Verify Google ID token signature, expiration, and audience
    const ticket = await googleClient.verifyIdToken({
      idToken: idToken,
      audience: process.env.GOOGLE_WEB_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch (error) {
    throw new AppError("Invalid or expired Google ID token", 401);
  }

  if (!payload || !payload.email) {
    throw new AppError("Malformed Google ID token payload", 400);
  }

  // Optional: Ensure the Google email is verified
  if (!payload.email_verified) {
    throw new AppError("Google email is not verified", 401);
  }

  const { email, given_name, family_name, picture, sub: googleId } = payload;

  // 2. Find or create the user in Prisma DB
  let user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    // Create new user if they don't exist yet
    // Generates a unique fallback username based on their Google email prefix
    const baseUsername = email.split("@")[0];
    const uniqueUsername = `${baseUsername}_${Math.floor(1000 + Math.random() * 9000)}`;

    user = await prisma.user.create({
      data: {
        email,
        username: uniqueUsername,
        firstName: given_name || "",
        lastName: family_name || "",
        image: picture || "",
        password: "",
        googleId,
      },
    });
  }

  // 3. Generate internal access & refresh tokens
  const tokenPayload = { userId: user.id };
  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  // 4. Return identical payload schema as handleLogin
  res.status(200).json({
    id: user.id,
    username: user.username,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    gender: user.gender,
    image: user.image,
    accessToken,
    refreshToken,
  });
};

export const handleGetMe = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : req.cookies?.accessToken;

  if (!token) {
    throw new AppError("Access token missing", 401);
  }

  const payload = verifyAccessToken(token);

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
  });

  if (!user) {
    throw new AppError("User not found", 404);
  }

  res.status(200).json({
    id: user.id,
    username: user.username,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    gender: user.gender,
    image: user.image,
  });
};

export const handleRefreshToken = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

  if (!refreshToken) {
    throw new AppError("Refresh token missing", 401);
  }

  const payload = verifyRefreshToken(refreshToken);

  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user) throw new AppError("User no longer exists", 401);

  const newAccessToken = generateAccessToken(payload);

  const newRefreshToken = generateRefreshToken(payload);
  res.status(200).json({
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  });
};
