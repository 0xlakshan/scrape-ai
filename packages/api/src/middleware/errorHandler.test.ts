import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { errorHandler } from "./errorHandler";
import { AppError, ErrorCode, ValidationError } from "../errors";

describe("errorHandler", () => {
  let req: Request;
  let res: Response;
  let next: NextFunction;
  let jsonSpy: ReturnType<typeof vi.fn>;
  let statusSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    req = { id: "req_test123" } as Request;
    jsonSpy = vi.fn();
    statusSpy = vi.fn().mockReturnValue({ json: jsonSpy });
    res = { status: statusSpy } as unknown as Response;
    next = vi.fn();

    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("should handle AppError with correct status and format", () => {
    const error = new AppError("Test error", ErrorCode.VALIDATION_ERROR, 400, {
      field: "test",
    });

    errorHandler(error, req, res, next);

    expect(statusSpy).toHaveBeenCalledWith(400);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: "Test error",
        details: { field: "test" },
        requestId: "req_test123",
        timestamp: expect.any(String),
      },
    });
  });

  it("should handle ValidationError", () => {
    const error = new ValidationError("Invalid input", { field: "email" });

    errorHandler(error, req, res, next);

    expect(statusSpy).toHaveBeenCalledWith(400);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: "Invalid input",
        details: { field: "email" },
        requestId: "req_test123",
        timestamp: expect.any(String),
      },
    });
  });

  it("should handle unknown errors as 500", () => {
    const error = new Error("Unknown error");

    errorHandler(error, req, res, next);

    expect(statusSpy).toHaveBeenCalledWith(500);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: false,
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: "An unexpected error occurred",
        details: undefined,
        requestId: "req_test123",
        timestamp: expect.any(String),
      },
    });
  });

  it("should include error message in development mode", () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";

    const error = new Error("Dev error");
    errorHandler(error, req, res, next);

    expect(jsonSpy).toHaveBeenCalledWith({
      success: false,
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: "An unexpected error occurred",
        details: "Dev error",
        requestId: "req_test123",
        timestamp: expect.any(String),
      },
    });

    process.env.NODE_ENV = originalEnv;
  });

  it("should use 'unknown' requestId if not present", () => {
    req.id = undefined as any;
    const error = new AppError("Test", ErrorCode.INTERNAL_ERROR, 500);

    errorHandler(error, req, res, next);

    expect(jsonSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          requestId: "unknown",
        }),
      }),
    );
  });

  it("should log error details", () => {
    const error = new AppError("Test error", ErrorCode.VALIDATION_ERROR, 400, {
      test: true,
    });

    errorHandler(error, req, res, next);

    expect(console.error).toHaveBeenCalledWith(
      expect.stringMatching(/\[req_test123\]/),
      expect.objectContaining({
        message: "Test error",
        code: ErrorCode.VALIDATION_ERROR,
        details: { test: true },
      }),
    );
  });
});
