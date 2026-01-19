import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";
import { tokenUsageController } from "./token-usage";
import { MissingFieldError, InvalidUrlError } from "../errors";

vi.mock("../scrapeEngine/scrapeEngine");

describe("tokenUsageController", () => {
  let req: Request;
  let res: Response;
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    req = {
      body: {},
    } as Request;

    res = {
      json: vi.fn(),
    } as unknown as Response;

    next = vi.fn();
  });

  it("should call next with MissingFieldError when url is missing", async () => {
    req.body = {
      prompt: "test",
      schema: {},
    };

    await tokenUsageController(req, res, next);

    expect(next).toHaveBeenCalled();
    const error = next.mock.calls[0][0];
    expect(error.message).toContain("Missing required field: url");
  });

  it("should call next with MissingFieldError when prompt is missing", async () => {
    req.body = {
      url: "https://example.com",
      schema: {},
    };

    await tokenUsageController(req, res, next);

    expect(next).toHaveBeenCalled();
    const error = next.mock.calls[0][0];
    expect(error.message).toContain("Missing required field: prompt");
  });

  it("should call next with MissingFieldError when schema is missing", async () => {
    req.body = {
      url: "https://example.com",
      prompt: "test",
    };

    await tokenUsageController(req, res, next);

    expect(next).toHaveBeenCalled();
    const error = next.mock.calls[0][0];
    expect(error.message).toContain("Missing required field: schema");
  });

  it("should call next with InvalidUrlError for malformed URL", async () => {
    req.body = {
      url: "not-a-url",
      prompt: "test",
      schema: {},
    };

    await tokenUsageController(req, res, next);

    expect(next).toHaveBeenCalled();
    const error = next.mock.calls[0][0];
    expect(error.message).toContain("Invalid URL");
  });

  it("should call next with InvalidUrlError for invalid URL format", async () => {
    req.body = {
      url: "://invalid",
      prompt: "test",
      schema: {},
    };

    await tokenUsageController(req, res, next);

    expect(next).toHaveBeenCalled();
    const error = next.mock.calls[0][0];
    expect(error.message).toContain("Invalid URL");
  });

  it("should validate all required fields", async () => {
    const testCases = [
      { url: undefined, prompt: "test", schema: {} },
      { url: "https://test.com", prompt: undefined, schema: {} },
      { url: "https://test.com", prompt: "test", schema: undefined },
    ];

    for (const body of testCases) {
      next.mockClear();
      req.body = body as any;
      await tokenUsageController(req, res, next);

      const error = next.mock.calls[0]?.[0];
      expect(error).toBeDefined();
      expect(error.message).toMatch(/Missing required field/);
    }
  });

  it("should accept valid URL formats", async () => {
    const validUrls = [
      "https://example.com",
      "http://test.com",
      "https://sub.domain.com/path",
      "https://example.com:8080",
    ];

    for (const url of validUrls) {
      next.mockClear();
      req.body = { url, prompt: "test", schema: {} };

      await tokenUsageController(req, res, next);

      // Should not call next with InvalidUrlError
      if (next.mock.calls.length > 0) {
        expect(next.mock.calls[0][0]).not.toBeInstanceOf(InvalidUrlError);
      }
    }
  });
});
