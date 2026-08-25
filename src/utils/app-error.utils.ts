export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;

    // "Operational" means it's a known error we anticipate (like bad user inputs)
    // rather than a critical system crash (like a database connection failure)
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}
