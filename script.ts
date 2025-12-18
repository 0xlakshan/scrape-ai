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

async function extractMetadata(page: Page): Promise<PageMetadata> {
  const metadata = await page.evaluate(() => {
    const getMetaContent = (name: string): string => {
      const meta = document.querySelector(`meta[name="${name}"], meta[property="og:${name}"]`);
      return meta?.getAttribute('content') || '';
    };

    return {
      title: document.title || getMetaContent('title'),
      description: getMetaContent('description'),
      url: window.location.href,
    };
  });

  return {
    ...metadata,
    timestamp: new Date().toISOString(),
  };
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

function buildPrompt(content: string, options: SummaryOptions): string {
  const lengthMap = {
    short: 'one paragraph',
    medium: 'two paragraphs',
    long: 'three to four paragraphs',
  };

  const length = lengthMap[options.length || 'medium'];

  let formatInstruction = '';
  if (options.format === 'bullets') {
    formatInstruction = 'Format the summary as bullet points with 5-7 key points.';
  } else if (options.format === 'json') {
    formatInstruction =
      'Format the summary as JSON with keys: "mainTopic", "keyPoints" (array), "conclusion".';
  } else {
    formatInstruction = `Provide a concise ${length} summary.`;
  }

  return `
${formatInstruction}
Focus on the main topic, key insights, and conclusions.

Content:
${content}
  `.trim();
}

async function summarize(content: string, options: SummaryOptions): Promise<string> {
  const { text } = await generateText({
    model: MODEL,
    prompt: buildPrompt(content, options),
  });
  return text;
}

async function saveToFile(filename: string, content: string): Promise<void> {
  const outputDir = path.join(process.cwd(), 'summaries');
  await fs.mkdir(outputDir, { recursive: true });
  const filepath = path.join(outputDir, filename);
  await fs.writeFile(filepath, content, 'utf-8');
  console.log(`\nSummary saved to: ${filepath}`);
}

async function withBrowser<T>(fn: (ctx: BrowserContext) => Promise<T>): Promise<T> {
  const ctx = await createBrowserContext();
  try {
    return await fn(ctx);
  } finally {
    await ctx.browser.close();
  }
}

async function summarizeWebsite(url: string, options: SummaryOptions = {}): Promise<void> {
  await withBrowser(async ({ page }) => {
    await navigate(page, url);

    const [content, metadata] = await Promise.all([extractText(page), extractMetadata(page)]);

    if (!content) {
      throw new Error('No meaningful content extracted');
    }

    const summary = await summarize(content, options);

    let output = '\n--- Website Summary ---\n\n';

    if (options.includeMetadata) {
      output += `Title: ${metadata.title}\n`;
      output += `URL: ${metadata.url}\n`;
      output += `Date: ${new Date(metadata.timestamp).toLocaleString()}\n`;
      if (metadata.description) {
        output += `Description: ${metadata.description}\n`;
      }
      output += '\n';
    }

    output += summary;
    output += '\n\n-----------------------\n';

    console.log(output);

    if (options.saveToFile) {
      const filename = options.saveToFile.endsWith('.txt')
        ? options.saveToFile
        : `${options.saveToFile}.txt`;
      await saveToFile(filename, output);
    }
  });
}

function parseArgs(): { url: string; options: SummaryOptions } {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help')) {
    console.log(`
Usage: ts-node summarize.ts <url> [options]

Options:
  --length <short|medium|long>    Summary length (default: medium)
  --format <paragraphs|bullets|json>  Output format (default: paragraphs)
  --metadata                      Include page metadata
  --save <filename>               Save summary to file
  --help                          Show this help message

Examples:
  ts-node summarize.ts https://example.com
  ts-node summarize.ts https://example.com --length long --metadata
  ts-node summarize.ts https://example.com --format bullets --save summary
    `);
    process.exit(0);
  }

  const url = args[0];
  const options: SummaryOptions = {};

  for (let i = 1; i < args.length; i++) {
    switch (args[i]) {
      case '--length':
        options.length = args[++i] as 'short' | 'medium' | 'long';
        break;
      case '--format':
        options.format = args[++i] as 'paragraphs' | 'bullets' | 'json';
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
  console.error('Failed to summarize website:', err);
  process.exit(1);
});
