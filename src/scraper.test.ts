import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Scraper } from './scraper';
import { EngineError, ConfigError } from './errors';

// Mock engines
const mockEngine = {
  scrape: vi.fn(),
  dispose: vi.fn()
};

vi.mock('./engines', () => ({
  PuppeteerEngine: vi.fn(() => mockEngine),
  FirecrawlEngine: vi.fn(() => mockEngine)
}));

describe('Scraper - Retry Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('succeeds on first attempt', async () => {
    const scraper = new Scraper();
    mockEngine.scrape.mockResolvedValueOnce({
      html: '<div>content</div>',
      text: 'content',
      metadata: { title: 'Test', description: '', timestamp: '2024-01-01' }
    });

    const result = await scraper.scrape('https://example.com');
    
    expect(mockEngine.scrape).toHaveBeenCalledTimes(1);
    expect(result.url).toBe('https://example.com');
  });

  it('retries with exponential backoff', async () => {
    const scraper = new Scraper({ retry: { attempts: 3, delay: 100, backoff: 'exponential' } });
    
    mockEngine.scrape
      .mockRejectedValueOnce(new Error('Fail 1'))
      .mockRejectedValueOnce(new Error('Fail 2'))
      .mockResolvedValueOnce({
        html: '<div>success</div>',
        text: 'success',
        metadata: { title: 'Test', description: '', timestamp: '2024-01-01' }
      });

    const start = Date.now();
    await scraper.scrape('https://example.com');
    const duration = Date.now() - start;

    expect(mockEngine.scrape).toHaveBeenCalledTimes(3);
    expect(duration).toBeGreaterThan(300); // 100ms + 200ms delays
  });

  it('throws EngineError after max attempts', async () => {
    const scraper = new Scraper({ retry: { attempts: 2 } });
    
    mockEngine.scrape.mockRejectedValue(new Error('Persistent failure'));

    await expect(scraper.scrape('https://example.com'))
      .rejects.toThrow(EngineError);
    
    expect(mockEngine.scrape).toHaveBeenCalledTimes(2);
  });
});

describe('Scraper - Engine Selection', () => {
  it('throws ConfigError for firecrawl without API key', () => {
    expect(() => new Scraper({ engine: 'firecrawl' }))
      .toThrow(ConfigError);
  });

  it('uses puppeteer as default engine', async () => {
    const scraper = new Scraper();
    mockEngine.scrape.mockResolvedValueOnce({
      html: '<div>test</div>',
      text: 'test',
      metadata: { title: 'Test', description: '', timestamp: '2024-01-01' }
    });

    await scraper.scrape('https://example.com');
    
    const { PuppeteerEngine } = await import('./engines');
    expect(PuppeteerEngine).toHaveBeenCalled();
  });
});
