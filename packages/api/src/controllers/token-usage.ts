import type { Request, Response, NextFunction } from "express";
import type {
  TokenUsageRequestBody,
  TokenUsageResponse,
  ErrorResponse,
} from "../types/api";
import { ScrapeEngine } from "../scrapeEngine/scrapeEngine";
import { MissingFieldError, InvalidUrlError } from "../errors";

const scrapeEngine = new ScrapeEngine();

function validateUrl(url: string): void {
  try {
    new URL(url);
  } catch {
    throw new InvalidUrlError(url);
  }
}

export const tokenUsageController = async (
  req: Request<{}, TokenUsageResponse | ErrorResponse, TokenUsageRequestBody>,
  res: Response<TokenUsageResponse | ErrorResponse>,
  next: NextFunction,
): Promise<void> => {
  try {
    const {
      url,
      prompt,
      model = "gemini-2.0-flash-exp",
      schema,
      waitFor,
      timeout = 30000,
    } = req.body;

    if (!url) throw new MissingFieldError("url");
    if (!prompt) throw new MissingFieldError("prompt");
    if (!schema) throw new MissingFieldError("schema");

    validateUrl(url);

    const { cleanedHtml } = await scrapeEngine.scrape({
      url,
      waitFor,
      timeout,
    });

    const tokens = scrapeEngine.estimateTokenUsage(
      prompt,
      cleanedHtml,
      schema,
      model,
    );
    const pricing = scrapeEngine.getModelPricing(model);
    const estimatedCost = scrapeEngine.calculateCost(tokens.total, pricing);

    res.json({
      success: true,
      tokens,
      estimatedCost,
    });
  } catch (error) {
    next(error);
  }
};

export async function closeScraper(): Promise<void> {
  await scrapeEngine.closeBrowser();
}
