import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";
import { scrapeController } from "./scrape";

vi.mock("../scrapeEngine/scrapeEngine");
vi.mock("ai");
vi.mock("@ai-sdk/google");

describe("scrapeController", () => {
  let req: Request;
  let res: Response;
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    req = {
      body: {},
    } as Request;

    res = {
      json: vi.fn(),
      type: vi.fn().mockReturnThis(),
      send: vi.fn(),
    } as unknown as Response;

    next = vi.fn();
  });

  it("should call next with MissingFieldError when url is missing", async () => {
    req.body = {
      prompt: "test",
      schema: {},
      model: "gemini-2.0-flash-exp",
    };

    await scrapeController(req, res, next);

    expect(next).toHaveBeenCalled();
    const error = next.mock.calls[0][0];
    expect(error.message).toContain("Missing required field: url");
  });

  it("should call next with MissingFieldError when prompt is missing", async () => {
    req.body = {
      url: "https://example.com",
      schema: {},
      model: "gemini-2.0-flash-exp",
    };

    await scrapeController(req, res, next);

    expect(next).toHaveBeenCalled();
    const error = next.mock.calls[0][0];
    expect(error.message).toContain("Missing required field: prompt");
  });

  it("should call next with MissingFieldError when schema is missing", async () => {
    req.body = {
      url: "https://example.com",
      prompt: "test",
      model: "gemini-2.0-flash-exp",
    };

    await scrapeController(req, res, next);

    expect(next).toHaveBeenCalled();
    const error = next.mock.calls[0][0];
    expect(error.message).toContain("Missing required field: schema");
  });

  it("should call next with MissingFieldError when model is missing", async () => {
    req.body = {
      url: "https://example.com",
      prompt: "test",
      schema: {},
    };

    await scrapeController(req, res, next);

    expect(next).toHaveBeenCalled();
    const error = next.mock.calls[0][0];
    expect(error.message).toContain("Missing required field: model");
  });

  it("should call next with InvalidUrlError for malformed URL", async () => {
    req.body = {
      url: "not-a-url",
      prompt: "test",
      schema: {},
      model: "gemini-2.0-flash-exp",
    };

    await scrapeController(req, res, next);

    expect(next).toHaveBeenCalled();
    const error = next.mock.calls[0][0];
    expect(error.message).toContain("Invalid URL");
  });

  it("should call next with InvalidUrlError for invalid protocol", async () => {
    req.body = {
      url: "://invalid",
      prompt: "test",
      schema: {},
      model: "gemini-2.0-flash-exp",
    };

    await scrapeController(req, res, next);

    expect(next).toHaveBeenCalled();
    const error = next.mock.calls[0][0];
    expect(error.message).toContain("Invalid URL");
  });

  it("should validate all required fields are present", async () => {
    const testCases = [
      { url: undefined, prompt: "test", schema: {}, model: "test" },
      { url: "https://test.com", prompt: undefined, schema: {}, model: "test" },
      {
        url: "https://test.com",
        prompt: "test",
        schema: undefined,
        model: "test",
      },
      { url: "https://test.com", prompt: "test", schema: {}, model: undefined },
    ];

    for (const body of testCases) {
      next.mockClear();
      req.body = body as any;
      await scrapeController(req, res, next);

      const error = next.mock.calls[0]?.[0];
      expect(error).toBeDefined();
      expect(error.message).toMatch(/Missing required field/);
    }
  });
});
