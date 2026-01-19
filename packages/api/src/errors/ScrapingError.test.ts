import { describe, it, expect } from "vitest";
import {
  ScrapingError,
  BrowserLaunchError,
  PageLoadError,
  PageTimeoutError,
  ContentExtractionError,
} from "./ScrapingError";
import { ErrorCode } from "./errorCodes";

describe("ScrapingError", () => {
  it("should create scraping error", () => {
    const error = new ScrapingError(
      "Scraping failed",
      ErrorCode.SCRAPING_FAILED,
    );

    expect(error.message).toBe("Scraping failed");
    expect(error.code).toBe(ErrorCode.SCRAPING_FAILED);
    expect(error.statusCode).toBe(502);
  });
});

describe("BrowserLaunchError", () => {
  it("should create browser launch error", () => {
    const error = new BrowserLaunchError();

    expect(error.message).toBe("Failed to launch browser");
    expect(error.code).toBe(ErrorCode.BROWSER_LAUNCH_FAILED);
    expect(error.statusCode).toBe(502);
  });

  it("should include error details", () => {
    const error = new BrowserLaunchError({ reason: "timeout" });

    expect(error.details).toEqual({ reason: "timeout" });
  });
});

describe("PageLoadError", () => {
  it("should create page load error", () => {
    const error = new PageLoadError("https://example.com");

    expect(error.message).toBe("Failed to load page: https://example.com");
    expect(error.code).toBe(ErrorCode.PAGE_LOAD_FAILED);
    expect(error.statusCode).toBe(502);
    expect(error.details).toMatchObject({ url: "https://example.com" });
  });

  it("should include additional details", () => {
    const error = new PageLoadError("https://test.com", { status: 404 });

    expect(error.details).toMatchObject({
      url: "https://test.com",
      status: 404,
    });
  });
});

describe("PageTimeoutError", () => {
  it("should create timeout error", () => {
    const error = new PageTimeoutError("https://slow.com", 30000);

    expect(error.message).toBe("Page load timeout after 30000ms");
    expect(error.code).toBe(ErrorCode.PAGE_TIMEOUT);
    expect(error.statusCode).toBe(502);
    expect(error.details).toEqual({
      url: "https://slow.com",
      timeout: 30000,
    });
  });

  it("should handle different timeout values", () => {
    const error = new PageTimeoutError("https://test.com", 5000);

    expect(error.message).toBe("Page load timeout after 5000ms");
    expect(error.details).toEqual({
      url: "https://test.com",
      timeout: 5000,
    });
  });
});

describe("ContentExtractionError", () => {
  it("should create content extraction error", () => {
    const error = new ContentExtractionError();

    expect(error.message).toBe("Failed to extract content from page");
    expect(error.code).toBe(ErrorCode.CONTENT_EXTRACTION_FAILED);
    expect(error.statusCode).toBe(502);
  });

  it("should include details", () => {
    const error = new ContentExtractionError({ reason: "empty page" });

    expect(error.details).toEqual({ reason: "empty page" });
  });
});
