import { Request, Response, NextFunction } from "express";
import { TokenPayload, verifyAccessToken } from "../utils/crypto.utils";
import { AppError } from "../utils/app-error.utils";

// 1. Explicitly extend the Express Request type right here
interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

export const requireAuth = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  // 1. Get the Authorization header (e.g., "Bearer eyJhbGciOi...")
  const authReq = req as AuthenticatedRequest;
  const authHeader = authReq.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new AppError("Authorization token missing or malformed", 401);
  }

  // 2. Extract the raw token string
  const token = authHeader.split(" ")[1];

  // 3. Verify the access token using our utility helper
  // If it throws an error, it safely bubbles up straight to the globalErrorHandler middleware
  const decodedPayload = verifyAccessToken(token);

  // 4. Attach the user payload (e.g., { userId }) directly to the request object
  authReq.user = decodedPayload;

  // 5. Pass execution along to the next middleware or controller
  next();
};
