import type { Request, Response, NextFunction } from "express";
import { AppError, ErrorCode } from "../errors";

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId: string;
    timestamp: string;
  };
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const timestamp = new Date().toISOString();
  const requestId = req.id || "unknown";

  // Log error
  console.error(`[${timestamp}] [${requestId}] Error:`, {
    name: err.name,
    message: err.message,
    stack: err.stack,
    ...(err instanceof AppError && { code: err.code, details: err.details }),
  });

  // Handle AppError
  if (err instanceof AppError) {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
        requestId,
        timestamp,
      },
    };
    res.status(err.statusCode).json(response);
    return;
  }

  // Handle unknown errors
  const response: ErrorResponse = {
    success: false,
    error: {
      code: ErrorCode.INTERNAL_ERROR,
      message: "An unexpected error occurred",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
      requestId,
      timestamp,
    },
  };
  res.status(500).json(response);
}
