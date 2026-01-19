import { describe, it, expect } from "vitest";
import { AppError } from "./AppError";
import { ErrorCode } from "./errorCodes";

describe("AppError", () => {
  it("should create error with all properties", () => {
    const error = new AppError("Test error", ErrorCode.INTERNAL_ERROR, 500, {
      foo: "bar",
    });

    expect(error.message).toBe("Test error");
    expect(error.code).toBe(ErrorCode.INTERNAL_ERROR);
    expect(error.statusCode).toBe(500);
    expect(error.details).toEqual({ foo: "bar" });
    expect(error.isOperational).toBe(true);
    expect(error.stack).toBeDefined();
  });

  it("should default isOperational to true", () => {
    const error = new AppError("Test", ErrorCode.INTERNAL_ERROR, 500);
    expect(error.isOperational).toBe(true);
  });

  it("should allow setting isOperational to false", () => {
    const error = new AppError(
      "Test",
      ErrorCode.INTERNAL_ERROR,
      500,
      undefined,
      false,
    );
    expect(error.isOperational).toBe(false);
  });

  it("should be instance of Error", () => {
    const error = new AppError("Test", ErrorCode.INTERNAL_ERROR, 500);
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
  });
});
