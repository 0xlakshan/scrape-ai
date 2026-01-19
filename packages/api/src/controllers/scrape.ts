import type { Request, Response, NextFunction } from "express";
import { generateText, Output } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { jsonSchema } from "ai";
import type {
  ScrapeRequestBody,
  ScrapeResponse,
  ErrorResponse,
} from "../types";
import { ScrapeEngine } from "../scrapeEngine/scrapeEngine";
import jsonToXml from "../utils/jsonToXml";
import {
  MissingFieldError,
  InvalidUrlError,
  GenerationError,
  ModelError,
} from "../errors";

const scrapeEngine = new ScrapeEngine();

function validateUrl(url: string): void {
  try {
    new URL(url);
  } catch {
    throw new InvalidUrlError(url);
  }
}

export const scrapeController = async (
  req: Request<{}, ScrapeResponse | ErrorResponse, ScrapeRequestBody>,
  res: Response<ScrapeResponse | ErrorResponse>,
  next: NextFunction,
): Promise<void> => {
  try {
    const {
      url,
      prompt,
      model,
      schema,
      output = "json",
      waitFor,
      timeout = 30000,
    } = req.body;

    if (!url) throw new MissingFieldError("url");
    if (!prompt) throw new MissingFieldError("prompt");
    if (!schema) throw new MissingFieldError("schema");
    if (!model) throw new MissingFieldError("model");

    validateUrl(url);

    const { cleanedHtml } = await scrapeEngine.scrape({
      url,
      waitFor,
      timeout,
    });

    const google = createGoogleGenerativeAI({
      apiKey: process.env.GOOGLE_API_KEY,
    });

    try {
      // Write to a file for debugging
      // const fs = await import("fs/promises");
      // await fs.writeFile("debug-output.txt", cleanedHtml || "", "utf-8");
      // console.log("Output written to debug-output.txt");

      const result = await generateText({
        model: google(model),
        output: Output.object({ schema: jsonSchema(schema) }),
        prompt: `${prompt}\n\nHTML:\n${cleanedHtml}`,
      });

      if (output === "xml") {
        // TODO: Handle XML export
        // jsonToXml(result, "result")
      } else {
        res.json({ success: true, data: result });
      }
    } catch (error) {
      const err = error as Error;

      if (err.message.includes("google") || err.message.includes("model")) {
        throw new ModelError(model, { message: err.message });
      }

      throw new GenerationError({
        message: err.message,
        model,
        originalError: error,
      });
    }
  } catch (error) {
    next(error);
  }
};

export async function closeScraper(): Promise<void> {
  await scrapeEngine.closeBrowser();
}
{
  jsonToXml;
}
