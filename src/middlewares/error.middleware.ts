import { Request, Response, NextFunction } from "express";

export const globalErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  // 1. Assign defaults if the error isn't explicitly an AppError
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";

  // 2. Format specific third-party library errors automatically

  // Handle Prisma Database Errors (e.g., Record not found)
  if (err.code?.startsWith("P")) {
    statusCode = 400;
    message = `Database Operation Failed: ${err.meta?.target || err.message}`;
  }

  // Handle Invalid JWT Errors
  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid authentication token. Please log in again.";
  }

  // Handle Expired JWT Errors
  if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Your session has expired. Please refresh your token.";
  }

  // 3. Log the full stack trace for you in development, but hide it from the user
  const isDevelopment = process.env.NODE_ENV === "development";
  if (isDevelopment || statusCode === 500) {
    console.error("💥 Error Caught:", {
      message: err.message,
      stack: err.stack,
      code: err.code,
    });
  }

  // 4. Send clean JSON response to client
  res.status(statusCode).json({
    status: statusCode >= 400 && statusCode < 500 ? "fail" : "error",
    message,
    ...(isDevelopment && { stack: err.stack }), // Only reveal stack traces in dev mode
  });
};
