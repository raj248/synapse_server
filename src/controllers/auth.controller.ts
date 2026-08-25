import { Request, Response } from "express";
import { verifyRefreshToken, generateAccessToken } from "../utils/crypto.utils";
import { AppError } from "../utils/app-error.utils";

export const handleRefreshToken = async (
  req: Request,
  res: Response,
): Promise<void> => {
  // 1. Grab the refresh token from cookies (web) or body (mobile)
  const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

  if (!refreshToken) {
    throw new AppError("Refresh token missing", 401);
  }

  // 2. Verify the token using our utility
  // Express 5 will instantly catch any verification errors and handle them globally
  const payload = verifyRefreshToken(refreshToken);

  // 3. (Optional but recommended) Check if user exists in the DB
  // const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  // if (!user) throw new AppError("User no longer exists", 401);

  // 4. Generate a brand new short-lived access token
  const newAccessToken = generateAccessToken(payload);

  // 5. Return the new access token to the client
  res.status(200).json({
    accessToken: newAccessToken,
  });
};
