import express from "express";
import { chromium, Browser } from "playwright";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { jsonSchema } from "ai";

const app = express();
app.use(express.json());

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

app.get("/health", (_, res) => res.json({ status: "ok" }));

app.post("/scrape", async (req, res) => {
  const { url, prompt, model = "gpt-4", schema, output = "json", waitFor, timeout = 30000 } = req.body;

  if (!url || !prompt || !schema) {
    return res.status(400).json({ error: "url, prompt, and schema are required" });
  }

  try {
    const b = await getBrowser();
    const page = await b.newPage();

    try {
      await page.goto(url, { waitUntil: "networkidle", timeout });
      if (waitFor) await page.waitForTimeout(waitFor);

      const html = await page.content();

      const { object } = await generateObject({
        model: openai(model),
        schema: jsonSchema(schema),
        prompt: `${prompt}\n\nHTML:\n${html}`,
      });

      if (output === "xml") {
        res.type("application/xml").send(jsonToXml(object, "result"));
      } else {
        res.json({ success: true, data: object });
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
