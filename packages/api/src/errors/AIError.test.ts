import { describe, it, expect } from "vitest";
import {
  AIError,
  ModelError,
  TokenLimitError,
  GenerationError,
} from "./AIError";
import { ErrorCode } from "./errorCodes";

describe("AIError", () => {
  it("should create AI error", () => {
    const error = new AIError("AI failed", ErrorCode.AI_SERVICE_ERROR);

    expect(error.message).toBe("AI failed");
    expect(error.code).toBe(ErrorCode.AI_SERVICE_ERROR);
    expect(error.statusCode).toBe(503);
  });
});

describe("ModelError", () => {
  it("should create model error", () => {
    const error = new ModelError("gpt-4");

    expect(error.message).toBe("AI model error: gpt-4");
    expect(error.code).toBe(ErrorCode.MODEL_ERROR);
    expect(error.statusCode).toBe(503);
    expect(error.details).toMatchObject({ model: "gpt-4" });
  });

  it("should include additional details", () => {
    const error = new ModelError("gemini-pro", { reason: "unavailable" });

    expect(error.details).toMatchObject({
      model: "gemini-pro",
      reason: "unavailable",
    });
  });
});

describe("TokenLimitError", () => {
  it("should create token limit error", () => {
    const error = new TokenLimitError(1000, 1500);

    expect(error.message).toBe("Token limit exceeded: 1500 > 1000");
    expect(error.code).toBe(ErrorCode.TOKEN_LIMIT_EXCEEDED);
    expect(error.statusCode).toBe(503);
    expect(error.details).toEqual({
      limit: 1000,
      actual: 1500,
    });
  });

  it("should handle different token values", () => {
    const error = new TokenLimitError(4096, 5000);

    expect(error.message).toBe("Token limit exceeded: 5000 > 4096");
    expect(error.details).toEqual({
      limit: 4096,
      actual: 5000,
    });
  });
});

describe("GenerationError", () => {
  it("should create generation error", () => {
    const error = new GenerationError();

    expect(error.message).toBe("AI generation failed");
    expect(error.code).toBe(ErrorCode.GENERATION_FAILED);
    expect(error.statusCode).toBe(503);
  });

  it("should include details", () => {
    const error = new GenerationError({ reason: "rate limit" });

    expect(error.details).toEqual({ reason: "rate limit" });
  });
});
