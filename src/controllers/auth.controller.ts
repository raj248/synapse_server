import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import {
  verifyRefreshToken,
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  comparePassword,
  generateSecureToken,
  generateSixDigitCode,
} from "../utils/crypto.utils";
import { AppError } from "../utils/app-error.utils";
import { prisma } from "../config/db";
import { OAuth2Client } from "google-auth-library";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { sendEmail } from "../utils/mailer.utils";
import {
  getResetPasswordEmailHtml,
  getVerificationEmailHtml,
} from "../utils/email-templates.utils";

export const handleLogin = async (
  req: Request,
  res: Response,
): Promise<void> => {
  // Allow login using either username or email passed in the identifier parameter
  const identifier =
    req.body?.username || req.body?.email || req.body?.identifier;
  const { password } = req.body;

  if (!identifier || !password) {
    throw new AppError("Username/Email and password are required", 400);
  }

  // 1. Find user by either matching email OR username
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: identifier }, { username: identifier }],
    },
  });

  // 2. Validate user existence and password
  if (
    !user ||
    !user.password ||
    !(await comparePassword(password, user.password))
  ) {
    throw new AppError("Invalid credentials", 400);
  }

  // 3. Generate access and refresh tokens
  const tokenPayload = { userId: user.id };
  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  // 4. Return user profile + tokens
  res.status(200).json({
    id: user.id,
    username: user.username,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
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
    const ticket = await googleClient.verifyIdToken({
      idToken: idToken,
      audience: [
        process.env.GOOGLE_WEB_CLIENT_ID ?? "",
        process.env.GOOGLE_DESKTOP_CLIENT_ID ?? "",
      ],
    });
    payload = ticket.getPayload();
  } catch (error) {
    console.error("[Auth Error] Google token verification failed:", error);
    throw new AppError("Invalid or expired Google ID token", 401);
  }

  if (!payload || !payload.email) {
    throw new AppError("Malformed Google ID token payload", 400);
  }

  if (!payload.email_verified) {
    throw new AppError("Google email is not verified", 401);
  }

  const { email, given_name, family_name, picture, sub: googleId } = payload;

  // 2. Find existing user by email
  let user = await prisma.user.findUnique({
    where: { email },
  });

  if (user) {
    // If account exists, link googleId and ensure verified status
    if (!user.googleId || !user.isEmailVerified) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: user.googleId ?? googleId,
          isEmailVerified: true,
          image: user.image || picture || "",
        },
      });
    }
  } else {
    // Create new user using the Google email as the username
    user = await prisma.user.create({
      data: {
        email,
        username: email, // Sets email as the default username for Google accounts
        firstName: given_name || "",
        lastName: family_name || "",
        image: picture || "",
        password: null,
        googleId,
        isEmailVerified: true,
      },
    });
  }

  // 3. Generate internal access & refresh tokens
  const tokenPayload = { userId: user.id };
  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  // 4. Return auth payload
  res.status(200).json({
    id: user.id,
    username: user.username,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
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

  const tokenPayload = { userId: user.id };
  const newAccessToken = generateAccessToken(tokenPayload);
  const newRefreshToken = generateRefreshToken(tokenPayload);

  res.status(200).json({
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  });
};

/**
 * 1. Register with Email & Password
 */
export const handleRegister = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { email, username, password, firstName, lastName } = req.body;

  if (!email || !username || !password) {
    throw new AppError("Email, username, and password are required", 400);
  }

  const existingEmail = await prisma.user.findUnique({ where: { email } });
  if (existingEmail) {
    throw new AppError("Email is already registered", 409);
  }

  const existingUsername = await prisma.user.findUnique({
    where: { username },
  });
  if (existingUsername) {
    throw new AppError("Username is taken", 409);
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const verificationToken = generateSecureToken();

  const user = await prisma.user.create({
    data: {
      email,
      username,
      password: hashedPassword,
      firstName: firstName || "",
      lastName: lastName || "",
      isEmailVerified: false,
      emailVerificationToken: verificationToken,
    },
  });

  await sendEmail({
    to: user.email,
    subject: "Verify your Synapse Account",
    htmlContent: getVerificationEmailHtml(verificationToken),
  });

  const tokenPayload = { userId: user.id };
  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  res.status(201).json({
    message:
      "Registration successful. Please check your email for verification.",
    id: user.id,
    username: user.username,
    email: user.email,
    isEmailVerified: user.isEmailVerified,
    accessToken,
    refreshToken,
  });
};

/**
 * 2. Verify Email Token
 */
export const handleVerifyEmail = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { token } = req.body;

  if (!token) {
    throw new AppError("Verification token is required", 400);
  }

  const user = await prisma.user.findFirst({
    where: { emailVerificationToken: token },
  });

  if (!user) {
    throw new AppError("Invalid or expired verification token", 400);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      isEmailVerified: true,
      emailVerificationToken: null,
    },
  });

  res.status(200).json({ message: "Email verified successfully" });
};

/**
 * 3. Forget Password (Request Reset Code)
 */
export const handleForgotPassword = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { email } = req.body;

  if (!email) {
    throw new AppError("Email is required", 400);
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // Return success even if email doesn't exist to prevent account enumeration
  if (!user) {
    res
      .status(200)
      .json({ message: "If the email exists, a 6-digit code has been sent." });
    return;
  }

  const resetCode = generateSixDigitCode();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // Code valid for 15 minutes

  await prisma.user.update({
    where: { id: user.id },
    data: {
      resetPasswordCode: resetCode,
      resetPasswordExpires: expiresAt,
    },
  });

  await sendEmail({
    to: user.email,
    subject: "Your Password Reset Code",
    htmlContent: getResetPasswordEmailHtml(resetCode),
  });
  res
    .status(200)
    .json({ message: "If the email exists, a 6-digit code has been sent." });
};

/**
 * 4. Verify Password Reset Code & Apply New Password
 */
export const handleResetPassword = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { email, code, newPassword } = req.body;

  if (!email || !code || !newPassword) {
    throw new AppError("Email, code, and new password are required", 400);
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (
    !user ||
    user.resetPasswordCode !== code ||
    !user.resetPasswordExpires ||
    user.resetPasswordExpires < new Date()
  ) {
    throw new AppError("Invalid or expired reset code", 400);
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      resetPasswordCode: null,
      resetPasswordExpires: null,
    },
  });

  res
    .status(200)
    .json({ message: "Password reset successfully. You can now sign in." });
};

/**
 * 5. Change Password (Authenticated User)
 */
export const handleChangePassword = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const userId = req.user?.userId;
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    throw new AppError("Old password and new password are required", 400);
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError("User not found", 404);
  }

  if (!user.password) {
    throw new AppError(
      "Accounts logged in via Google must set a password first",
      400,
    );
  }

  const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
  if (!isPasswordValid) {
    throw new AppError("Incorrect old password", 400);
  }

  const hashedNewPassword = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedNewPassword },
  });

  res.status(200).json({ message: "Password changed successfully" });
};

// GET /auth/dev/tokens?email=test.user@example.com
export const handleGetDevAuthTokens = async (
  req: Request,
  res: Response,
): Promise<void> => {
  if (process.env.NODE_ENV === "production") {
    throw new AppError("Forbidden in production", 403);
  }

  const email = req.query.email as string;
  if (!email) {
    throw new AppError("Email query parameter is required", 400);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      emailVerificationToken: true,
      resetPasswordCode: true,
    },
  });

  if (!user) {
    throw new AppError("User not found", 404);
  }

  res.status(200).json({
    emailVerificationToken: user.emailVerificationToken,
    resetPasswordCode: user.resetPasswordCode,
  });
};
