import express from "express";
import type { Browser, BrowserContext } from "playwright";
import { chromium } from "playwright-extra";
import stealth from "puppeteer-extra-plugin-stealth";
import { generateText, Output } from "ai";
import { google, createGoogleGenerativeAI } from "@ai-sdk/google";
import { jsonSchema } from "ai";
import { encoding_for_model, type TiktokenModel } from "tiktoken";

const app = express();
app.use(express.json());

chromium.use(stealth());

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({ headless: true });
  }
  return browser;
}

async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

function cleanHtml(html: string): string {
  return (
    html
      // Remove scripts, styles, comments with their content
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<(svg|path|iframe|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
      // Remove common boilerplate sections
      .replace(/<(header|nav|footer|aside)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
      // Strip most attributes, keep only semantic ones
      .replace(
        /\s+(class|id|style|data-[\w-]+|aria-[\w-]+|role|onclick|on\w+)="[^"]*"/gi,
        "",
      )
      // Remove empty tags
      .replace(/<(\w+)[^>]*>\s*<\/\1>/gi, "")
      // Collapse whitespace
      .replace(/\s+/g, " ")
      .replace(/>\s+</g, "><")
      .trim()
  );
}

function jsonToXml(obj: unknown, root = "root"): string {
  const convert = (data: unknown, tag: string): string => {
    if (Array.isArray(data)) {
      return data.map((item) => convert(item, "item")).join("");
    }
    if (typeof data === "object" && data !== null) {
      const inner = Object.entries(data)
        .map(([k, v]) => convert(v, k))
        .join("");
      return `<${tag}>${inner}</${tag}>`;
    }
    return `<${tag}>${String(data)}</${tag}>`;
  };
  return `<?xml version="1.0"?>${convert(obj, root)}`;
}

interface TokenUsageRequest {
  url: string;
  prompt: string;
  model?: string;
  schema: Record<string, unknown>;
  waitFor?: number;
  timeout?: number;
}

interface TokenUsageResponse {
  success: true;
  tokens: {
    prompt: number;
    schema: number;
    total: number;
  };
  estimatedCost?: {
    inputCostPer1M: number;
    outputCostPer1M: number;
    estimatedInput: string;
    estimatedOutput: string;
  };
}

function estimateTokens(text: string, model: string): number {
  try {
    // Map Gemini models to closest tiktoken equivalent
    const modelMap: Record<string, TiktokenModel> = {
      "gemini-2.0-flash-exp": "gpt-4",
      "gemini-1.5-pro": "gpt-4",
      "gemini-1.5-flash": "gpt-3.5-turbo",
    };

    const tiktokenModel = modelMap[model] || "gpt-4";
    const encoder = encoding_for_model(tiktokenModel);
    const tokens = encoder.encode(text).length;
    encoder.free();
    return tokens;
  } catch {
    // Fallback: rough estimate (1 token ≈ 4 chars)
    return Math.ceil(text.length / 4);
  }
}

function getModelPricing(model: string): { input: number; output: number } {
  // Pricing per 1M tokens (USD)
  const pricing: Record<string, { input: number; output: number }> = {
    "gemini-2.0-flash-exp": { input: 0, output: 0 }, // Free tier
    "gemini-1.5-pro": { input: 1.25, output: 5.0 },
    "gemini-1.5-flash": { input: 0.075, output: 0.3 },
  };
  return pricing[model] || { input: 0, output: 0 };
}

app.get("/health", (_, res) => res.json({ status: "ok" }));

app.post("/token-usage", async (req, res) => {
  const {
    url,
    prompt,
    model = "gemini-2.0-flash-exp",
    schema,
    waitFor,
    timeout = 30000,
  }: TokenUsageRequest = req.body;

  if (!url || !prompt || !schema) {
    return res
      .status(400)
      .json({ error: "url, prompt, and schema are required" });
  }

  try {
    const browser = await getBrowser();
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
      viewport: {
        width: 1280 + Math.floor(Math.random() * 100),
        height: 720 + Math.floor(Math.random() * 100),
      },
      locale: "en-US",
      timezoneId: "America/New_York",
    });
    const page = await context.newPage();

    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout });
      if (waitFor) await page.waitForTimeout(waitFor);

      const html = await page.content();
      const cleanedHtml = cleanHtml(html);

      // Construct the full prompt as it would be sent to AI
      const fullPrompt = `${prompt}\n\nHTML:\n${cleanedHtml}`;
      const schemaText = JSON.stringify(schema);

      // Estimate tokens
      const promptTokens = estimateTokens(fullPrompt, model);
      const schemaTokens = estimateTokens(schemaText, model);
      const totalTokens = promptTokens + schemaTokens;

      // Get pricing
      const pricing = getModelPricing(model);
      const estimatedInputCost = (totalTokens / 1_000_000) * pricing.input;
      const estimatedOutputCost = (totalTokens / 1_000_000) * pricing.output;

      const response: TokenUsageResponse = {
        success: true,
        tokens: {
          prompt: promptTokens,
          schema: schemaTokens,
          total: totalTokens,
        },
        estimatedCost: {
          inputCostPer1M: pricing.input,
          outputCostPer1M: pricing.output,
          estimatedInput: `$${estimatedInputCost.toFixed(4)}`,
          estimatedOutput: `$${estimatedOutputCost.toFixed(4)}`,
        },
      };

      res.json(response);
    } finally {
      await page.close();
    }
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post("/scrape", async (req, res) => {
  const {
    url,
    prompt,
    model,
    schema,
    output = "json",
    waitFor,
    timeout = 30000,
  } = req.body;

  if (!url || !prompt || !schema) {
    return res
      .status(400)
      .json({ error: "url, prompt, and schema are required" });
  }

  try {
    const browser = await getBrowser();
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
      viewport: {
        width: 1280 + Math.floor(Math.random() * 100), // Slight randomness helps reduce fingerprint accuracy
        height: 720 + Math.floor(Math.random() * 100),
      },
      locale: "en-US", // Match with your proxy’s geolocation
      timezoneId: "America/New_York",
    });
    const page = await context.newPage();

    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout });
      if (waitFor) await page.waitForTimeout(waitFor);

      const html = await page.content();
      // debugging
      // Write to file for debugging
      // const fs = await import("fs/promises");
      // await fs.writeFile("debug-output.txt", html || "", "utf-8");
      // console.log("Output written to debug-output.txt");
      // res.json({
      //   success: true,
      //   message: "Output written to debug-output.txt",
      // });

      const cleanedHtml = cleanHtml(html as string);

      const google = createGoogleGenerativeAI({
        apiKey: process.env.GOOGLE_API_KEY,
      });

      const result = await generateText({
        model: google(model),
        output: Output.object({ schema: jsonSchema(schema) }),
        prompt: `${prompt}\n\nHTML:\n${cleanedHtml}`,
      });

      if (output === "xml") {
        res.type("application/xml").send(jsonToXml(result, "result"));
      } else {
        res.json({ success: true, data: result });
      }
    } finally {
      await page.close();
    }
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export function startServer(port = process.env.PORT || 3000) {
  const server = app.listen(port, () =>
    console.log(`Scrape API running on port ${port}`),
  );

  const shutdown = async () => {
    console.log("\nShutting down...");
    await closeBrowser();
    server.close(() => process.exit(0));
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
  return server;
}

export { app };

if (import.meta.url === `file://${process.argv[1]}`) startServer();
