import puppeteer, { Browser, Page } from 'puppeteer';
import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import * as fs from 'fs/promises';
import * as path from 'path';

type BrowserContext = {
  browser: Browser;
  page: Page;
};

type SummaryOptions = {
  length?: 'short' | 'medium' | 'long';
  format?: 'paragraphs' | 'bullets' | 'json';
  includeMetadata?: boolean;
  saveToFile?: string;
};

type PageMetadata = {
  title: string;
  description: string;
  url: string;
  timestamp: string;
};

type PageContent = {
  text: string;
  metadata: PageMetadata;
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

async function withBrowser<T>(fn: (ctx: BrowserContext) => Promise<T>): Promise<T> {
  const ctx = await createBrowserContext();
  try {
    return await fn(ctx);
  } finally {
    await ctx.browser.close();
  }
}

async function navigate(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
}

async function extractMetadata(page: Page): Promise<PageMetadata> {
  const metadata = await page.evaluate(() => {
    const getMeta = (name: string) =>
      document.querySelector(`meta[name="${name}"], meta[property="og:${name}"]`)
        ?.getAttribute('content') || '';

    return {
      title: document.title || getMeta('title'),
      description: getMeta('description'),
      url: window.location.href,
    };
  });

  return { ...metadata, timestamp: new Date().toISOString() };
}

function removeDuplicateLines(text: string): string {
  const seen = new Set<string>();

  return text
    .split('\n')
    .filter((line) => {
      const normalized = line.trim().toLowerCase();
      if (normalized.length < 30) return true;
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    })
    .join('\n');
}

async function extractAndCleanText(page: Page): Promise<string> {
  const text = await page.evaluate(() => {
    const NOISE = [
      'nav',
      'footer',
      'aside',
      'script',
      'style',
      'noscript',
      'iframe',
      'header',
      '[role="navigation"]',
      '.cookie',
      '.consent',
      '.ads',
      '.popup',
      '.modal',
    ];

    NOISE.forEach((s) =>
      document.querySelectorAll(s).forEach((el) => el.remove())
    );

    const CANDIDATES = [
      'article',
      'main',
      '[role="main"]',
      '.content',
      '.post',
    ];

    let best = '';

    for (const selector of CANDIDATES) {
      const el = document.querySelector(selector);
      if (!el) continue;
      const text = el.innerText.trim();
      if (text.length > best.length) best = text;
    }

    return best || document.body?.innerText || '';
  });

  return removeDuplicateLines(
    text
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim()
  );
}

const summaryStrategies = {
  paragraphs: (length: string) =>
    `Provide a concise ${length} summary in paragraph form.`,
  bullets: () =>
    'Summarize as 5–7 concise bullet points covering the key ideas.',
  json: () =>
    'Return a JSON object with keys: "mainTopic", "keyPoints", "conclusion".',
};

function buildPrompt(content: string, options: SummaryOptions): string {
  const lengthMap = {
    short: 'one paragraph',
    medium: 'two paragraphs',
    long: 'three to four paragraphs',
  };

  const length = lengthMap[options.length || 'medium'];
  const strategy =
    summaryStrategies[options.format || 'paragraphs'](length);

  return `
${strategy}
Focus on the core ideas and conclusions.

Content:
${content}
`.trim();
}

async function summarizeContent(
  content: string,
  options: SummaryOptions
): Promise<string> {
  const { text } = await generateText({
    model: MODEL,
    prompt: buildPrompt(content, options),
  });
  return text;
}

function formatOutput(
  summary: string,
  data: PageContent,
  options: SummaryOptions
): string {
  let output = '\n--- Website Summary ---\n\n';

  if (options.includeMetadata) {
    output += `Title: ${data.metadata.title}\n`;
    output += `URL: ${data.metadata.url}\n`;
    output += `Date: ${new Date(data.metadata.timestamp).toLocaleString()}\n`;
    if (data.metadata.description) {
      output += `Description: ${data.metadata.description}\n`;
    }
    output += '\n';
  }

  output += summary;
  output += '\n\n-----------------------\n';

  return output;
}

async function saveToFileIfNeeded(
  output: string,
  options: SummaryOptions
): Promise<void> {
  if (!options.saveToFile) return;

  const dir = path.join(process.cwd(), 'summaries');
  await fs.mkdir(dir, { recursive: true });

  const filename = options.saveToFile.endsWith('.txt')
    ? options.saveToFile
    : `${options.saveToFile}.txt`;

  await fs.writeFile(path.join(dir, filename), output, 'utf-8');
}

async function summarizeWebsite(url: string, options: SummaryOptions = {}) {
  await withBrowser(async ({ page }) => {
    await navigate(page, url);

    const [text, metadata] = await Promise.all([
      extractAndCleanText(page),
      extractMetadata(page),
    ]);

    if (!text) throw new Error('No meaningful content extracted');

    const summary = await summarizeContent(text, options);

    const output = formatOutput(
      summary,
      { text, metadata },
      options
    );

    console.log(output);
    await saveToFileIfNeeded(output, options);
  });
}

function parseArgs(): { url: string; options: SummaryOptions } {
  const args = process.argv.slice(2);
  if (!args.length || args.includes('--help')) process.exit(0);

  const url = args[0];
  const options: SummaryOptions = {};

  for (let i = 1; i < args.length; i++) {
    switch (args[i]) {
      case '--length':
        options.length = args[++i] as SummaryOptions['length'];
        break;
      case '--format':
        options.format = args[++i] as SummaryOptions['format'];
        break;
      case '--metadata':
        options.includeMetadata = true;
        break;
      case '--save':
        options.saveToFile = args[++i];
        break;
    }
  }

  return { url, options };
}

const { url, options } = parseArgs();

summarizeWebsite(url, options).catch((err) => {
  console.error(err);
  process.exit(1);
});
