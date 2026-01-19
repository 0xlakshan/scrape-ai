import { AppError } from "./AppError";
import { ErrorCode } from "./errorCodes";

export class ScrapingError extends AppError {
  constructor(message: string, code: ErrorCode, details?: unknown) {
    super(message, code, 502, details);
  }
}

export class BrowserLaunchError extends ScrapingError {
  constructor(details?: unknown) {
    super("Failed to launch browser", ErrorCode.BROWSER_LAUNCH_FAILED, details);
  }
}

export class PageLoadError extends ScrapingError {
  constructor(url: string, details?: Record<string, unknown>) {
    super(`Failed to load page: ${url}`, ErrorCode.PAGE_LOAD_FAILED, {
      url,
      ...(details || {}),
    });
  }
}

export class PageTimeoutError extends ScrapingError {
  constructor(url: string, timeout: number) {
    super(`Page load timeout after ${timeout}ms`, ErrorCode.PAGE_TIMEOUT, {
      url,
      timeout,
    });
  }
}

export class ContentExtractionError extends ScrapingError {
  constructor(details?: unknown) {
    super(
      "Failed to extract content from page",
      ErrorCode.CONTENT_EXTRACTION_FAILED,
      details,
    );
  }
}
