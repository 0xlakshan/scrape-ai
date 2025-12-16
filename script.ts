import puppeteer, { Browser, Page } from 'puppeteer';
import { generateText } from 'ai';
import { google } from '@ai-sdk/google';

type BrowserContext = {
  browser: Browser;
  page: Page;
};

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

const MODEL = google('gemini-2.5-flash');

async function createBrowserContext(): Promise<BrowserContext> {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setUserAgent(USER_AGENT);
  return { browser, page };
}

async function navigate(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
}

async function extractText(page: Page): Promise<string> {
  const text = await page.evaluate(() => {
    const candidates = ['article', 'main', 'body'];
    for (const selector of candidates) {
      const node = document.querySelector(selector);
      if (node && node.innerText.length > 50) {
        return node.innerText;
      }
    }
    return document.body?.innerText ?? '';
  });

  return text.replace(/\s\s+/g, ' ').trim();
}

function buildPrompt(content: string): string {
  return `
Provide a concise two-paragraph summary of the following webpage.
Focus on the main topic, key insights, and conclusions.

Content:
${content}
`.trim();
}

async function summarize(content: string): Promise<string> {
  const { text } = await generateText({
    model: MODEL,
    prompt: buildPrompt(content),
  });

  return text;
}

async function withBrowser<T>(
  fn: (ctx: BrowserContext) => Promise<T>
): Promise<T> {
  const ctx = await createBrowserContext();
  try {
    return await fn(ctx);
  } finally {
    await ctx.browser.close();
  }
}

async function summarizeWebsite(url: string): Promise<void> {
  await withBrowser(async ({ page }) => {
    await navigate(page, url);

    const content = await extractText(page);
    if (!content) {
      throw new Error('No meaningful content extracted');
    }

    const summary = await summarize(content);

    console.log('\n--- Website Summary ---\n');
    console.log(summary);
    console.log('\n-----------------------\n');
  });
}

const url = process.argv[2];

if (!url) {
  console.error('Usage: ts-node summarize.ts <URL>');
  process.exit(1);
}

summarizeWebsite(url).catch((err) => {
  console.error('Failed to summarize website:', err);
  process.exit(1);
});
