import puppeteer from 'puppeteer';
import { generateText } from 'ai';
import { google } from '@ai-sdk/google';

async function summarizeWebsite(url: string) {
  let browser;
  try {
    console.log(`Launching browser and navigating to: ${url}`);
     browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    
     await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

     await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
    
    console.log('Page loaded. Extracting main text content...');

    const pageText = await page.evaluate(() => {
      const selectors = ['article', 'main', 'body'];
      let content = '';

      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
          content = element.innerText;
          break; // Use the most specific selector found
        }
      }

       if (!content || content.length < 50) {
        content = document.body.innerText;
      }

       return content.replace(/\s\s+/g, ' ').trim();
    });

    if (!pageText) {
        throw new Error('Could not extract meaningful text from the page.');
    }
    
    console.log(`Extracted content size: ${pageText.length} characters.`);
    console.log('Sending content to AI model for summarization...');

    const prompt = `Please provide a concise, two-paragraph summary of the following web page content. Focus on the main topic, key takeaways, and any conclusions presented. Content: ${pageText}`;

    const { text: summary } = await generateText({
      model: google('gemini-2.5-flash'), 
      prompt: prompt,
    });

    console.log('\n--- Website Summary ---');
    console.log(summary);
    console.log('-----------------------\n');

  } catch (error) {
    console.error('An error occurred during the process:', error);
  } finally {
    if (browser) {
      await browser.close();
      console.log('Browser closed.');
    }
  }
}

const targetUrl = process.argv[2];

if (!targetUrl) {
  console.error('Usage: ts-node summarize.ts <URL_TO_SUMMARIZE>');
  process.exit(1);
}

summarizeWebsite(targetUrl);
