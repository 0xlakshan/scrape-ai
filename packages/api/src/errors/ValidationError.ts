import { AppError } from "./AppError";
import { ErrorCode } from "./errorCodes";

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, ErrorCode.VALIDATION_ERROR, 400, details);
  }
}

export class MissingFieldError extends AppError {
  constructor(field: string) {
    super(
      `Missing required field: ${field}`,
      ErrorCode.MISSING_REQUIRED_FIELD,
      400,
      { field },
    );
  }
}

export class InvalidUrlError extends AppError {
  constructor(url: string) {
    super(`Invalid URL: ${url}`, ErrorCode.INVALID_URL, 400, { url });
  }
}
