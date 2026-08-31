import { Response } from "express";
import { prisma } from "../config/db";
import { AppError } from "../utils/app-error.utils";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";

export const handleRegisterDevice = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const userId = req.user!.userId;
  const { token } = req.body;

  if (!token) {
    throw new AppError("token is required", 400);
  }

  // upsert on token (unique) — a token refresh callback firing twice, or a
  // reinstall under the same account, just re-points ownership instead of
  // hitting a duplicate-key error.
  await prisma.deviceToken.upsert({
    where: { token },
    update: { userId },
    create: { userId, token, platform: "ANDROID" },
  });

  res.status(204).send();
};

export const handleUnregisterDevice = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const { token } = req.body;

  if (!token) {
    throw new AppError("token is required", 400);
  }

  await prisma.deviceToken.deleteMany({ where: { token } });

  res.status(204).send();
};
