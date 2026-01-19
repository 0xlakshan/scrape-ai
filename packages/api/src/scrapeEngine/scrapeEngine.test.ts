import { describe, it, expect } from "vitest";
import {
  BrowserLaunchError,
  PageLoadError,
  PageTimeoutError,
  ContentExtractionError,
} from "../errors";
import { ErrorCode } from "../errors/errorCodes";

describe("ScrapeEngine - Error Classes", () => {
  describe("BrowserLaunchError", () => {
    it("should create browser launch error", () => {
      const error = new BrowserLaunchError({ reason: "timeout" });

      expect(error.message).toBe("Failed to launch browser");
      expect(error.code).toBe(ErrorCode.BROWSER_LAUNCH_FAILED);
      expect(error.statusCode).toBe(502);
      expect(error.details).toEqual({ reason: "timeout" });
    });

    it("should work without details", () => {
      const error = new BrowserLaunchError();

      expect(error.message).toBe("Failed to launch browser");
      expect(error.details).toBeUndefined();
    });
  });

  describe("PageLoadError", () => {
    it("should create page load error with URL", () => {
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

    it("should handle different URLs", () => {
      const urls = [
        "https://example.com",
        "http://test.com/path",
        "https://sub.domain.com:8080",
      ];

      for (const url of urls) {
        const error = new PageLoadError(url);
        expect(error.message).toContain(url);
        expect(error.details).toMatchObject({ url });
      }
    });
  });

  describe("PageTimeoutError", () => {
    it("should create timeout error with URL and timeout", () => {
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
      const timeouts = [5000, 10000, 30000, 60000];

      for (const timeout of timeouts) {
        const error = new PageTimeoutError("https://test.com", timeout);
        expect(error.message).toContain(`${timeout}ms`);
        expect(error.details).toMatchObject({ timeout });
      }
    });

    it("should include URL in details", () => {
      const error = new PageTimeoutError("https://example.com", 5000);

      expect(error.details).toEqual({
        url: "https://example.com",
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

    it("should include details when provided", () => {
      const error = new ContentExtractionError({ reason: "empty page" });

      expect(error.details).toEqual({ reason: "empty page" });
    });

    it("should work without details", () => {
      const error = new ContentExtractionError();

      expect(error.details).toBeUndefined();
    });

    it("should handle different error scenarios", () => {
      const scenarios = [
        { reason: "empty page" },
        { reason: "no content", url: "https://test.com" },
        { reason: "parsing failed", selector: ".content" },
      ];

      for (const details of scenarios) {
        const error = new ContentExtractionError(details);
        expect(error.details).toEqual(details);
      }
    });
  });
});
