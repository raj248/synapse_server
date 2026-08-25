import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { AppError } from "./app-error.utils";

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET!;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;

export interface TokenPayload {
  userId: string;
}

/**
 * Password Management
 */
export const hashPassword = async (password: string): Promise<string> => {
  return await bcrypt.hash(password, 10);
};

export const comparePassword = async (
  password: string,
  hashed: string,
): Promise<boolean> => {
  return await bcrypt.compare(password, hashed);
};

/**
 * Access Tokens
 */
export const generateAccessToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, JWT_ACCESS_SECRET, { expiresIn: "15m" });
};

export const verifyAccessToken = (token: string): TokenPayload => {
  try {
    return jwt.verify(token, JWT_ACCESS_SECRET) as TokenPayload;
  } catch (error: any) {
    // Forward the error cleanly with an explicit 401 status code
    throw new AppError(error.message || "Invalid access token", 401);
  }
};

/**
 * Refresh Tokens
 */
export const generateRefreshToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: "7d" });
};

export const verifyRefreshToken = (token: string): TokenPayload => {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET) as TokenPayload;
  } catch (error: any) {
    // Intercept jwt validation failures and convert them to explicit 403 Forbidden errors
    throw new AppError(
      error.name === "TokenExpiredError"
        ? "Refresh token expired"
        : "Invalid refresh token",
      403,
    );
  }
};
