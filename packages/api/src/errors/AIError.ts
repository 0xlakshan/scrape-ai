import { AppError } from "./AppError";
import { ErrorCode } from "./errorCodes";

export class AIError extends AppError {
  constructor(message: string, code: ErrorCode, details?: unknown) {
    super(message, code, 503, details);
  }
}

export class ModelError extends AIError {
  constructor(model: string, details?: Record<string, unknown>) {
    super(`AI model error: ${model}`, ErrorCode.MODEL_ERROR, {
      model,
      ...(details || {}),
    });
  }
}

export class TokenLimitError extends AIError {
  constructor(limit: number, actual: number) {
    super(
      `Token limit exceeded: ${actual} > ${limit}`,
      ErrorCode.TOKEN_LIMIT_EXCEEDED,
      {
        limit,
        actual,
      },
    );
  }
}

export class GenerationError extends AIError {
  constructor(details?: unknown) {
    super("AI generation failed", ErrorCode.GENERATION_FAILED, details);
  }
}
