import express from "express";
import { chromium, Browser } from "playwright";

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

app.get("/health", (_, res) => res.json({ status: "ok" }));

app.post("/scrape", async (req, res) => {
  const { url, selectors, waitFor, timeout = 30000 } = req.body;

  if (!url) return res.status(400).json({ error: "url is required" });

  try {
    const b = await getBrowser();
    const page = await b.newPage();

    try {
      await page.goto(url, { waitUntil: "networkidle", timeout });
      if (waitFor) await page.waitForSelector(waitFor, { timeout: 10000 });

      const data = await page.evaluate((sels?: string[]) => {
        const getMeta = (name: string) =>
          document
            .querySelector(`meta[name="${name}"], meta[property="og:${name}"]`)
            ?.getAttribute("content") || "";

        let text = "";
        if (sels?.length) {
          text = sels
            .map((s) => document.querySelector(s)?.textContent?.trim())
            .filter(Boolean)
            .join("\n\n");
        } else {
          const main = document.querySelector(
            'article, main, [role="main"], .content',
          ) as HTMLElement;
          text = main?.innerText || document.body.innerText;
        }

        return {
          html: document.documentElement.outerHTML,
          text: text.replace(/\n{3,}/g, "\n\n").trim(),
          metadata: {
            title: document.title || getMeta("title"),
            description: getMeta("description"),
            timestamp: new Date().toISOString(),
          },
        };
      }, selectors);

      res.json({ success: true, data });
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

// Auto-start when run directly
if (require.main === module) {
  startServer();
}
