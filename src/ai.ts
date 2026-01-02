import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { SummaryOptions, BatchResult, SummarizerError, ContentChunk } from './types';
import { RateLimiter, retryWithBackoff } from './utils';

const MODEL = google('gemini-2.5-flash');
const rateLimiter = new RateLimiter(2, 1000);

const CHARS_PER_TOKEN = 4;
const MAX_CHUNK_TOKENS = 8000;
const MAX_CHUNK_CHARS = MAX_CHUNK_TOKENS * CHARS_PER_TOKEN;

const summaryStrategies = {
  paragraphs: (length: string) => `Provide a concise ${length} summary in paragraph form.`,
  bullets: () => 'Summarize as 5–7 concise bullet points covering the key ideas.',
  json: () => 'Return a JSON object with keys: "mainTopic", "keyPoints", "conclusion".',
};

function buildPrompt(content: string, options: SummaryOptions): string {
  const lengthMap = {
    short: 'one paragraph',
    medium: 'two paragraphs',
    long: 'three to four paragraphs',
  };

  const length = lengthMap[options.length || 'medium'];
  const strategy = summaryStrategies[options.format || 'paragraphs'](length);

  return `
${strategy}
Focus on the core ideas and conclusions.

Content:
${content}
  `.trim();
}

function buildChunkPrompt(content: string, chunkIndex: number, totalChunks: number): string {
  return `
You are summarizing part ${chunkIndex + 1} of ${totalChunks} from a longer document.
Extract and summarize the key information from this section in 2-3 paragraphs.
Focus on main ideas, important details, and conclusions.
Maintain context awareness that this is part of a larger document.

Content:
${content}
  `.trim();
}

function buildSynthesisPrompt(chunkSummaries: string[], options: SummaryOptions): string {
  const lengthMap = {
    short: 'one paragraph',
    medium: 'two paragraphs',
    long: 'three to four paragraphs',
  };

  const length = lengthMap[options.length || 'medium'];
  const strategy = summaryStrategies[options.format || 'paragraphs'](length);

  const summaries = chunkSummaries
    .map((summary, i) => `Section ${i + 1}:\n${summary}`)
    .join('\n\n---\n\n');

  return `
You are synthesizing summaries from multiple sections of a single document.
${strategy}
Create a coherent, unified summary that captures the document's overall message.

Section Summaries:
${summaries}
  `.trim();
}

function buildComparativePrompt(results: BatchResult[]): string {
  const contents = results.map((r, i) =>
    `Source ${i + 1} (${r.metadata.title || r.url}):\n${r.summary}`
  ).join('\n\n---\n\n');

  return `
Compare and contrast the following summaries from different web pages. Identify:
1. Common themes and overlapping topics
2. Unique perspectives or information in each source
3. Contradictions or differing viewpoints
4. Overall synthesis of the information

Sources:
${contents}

Provide a comparative analysis in clear paragraphs.
  `.trim();
}

export function createContentChunks(content: string): ContentChunk[] {
  if (content.length <= MAX_CHUNK_CHARS) {
    return [{
      content,
      index: 0,
      total: 1,
      startChar: 0,
      endChar: content.length
    }];
  }

  const chunks: ContentChunk[] = [];
  const paragraphs = content.split(/\n\n+/);
  let currentChunk = '';
  let currentStartChar = 0;
  let chunkIndex = 0;

  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i];
    const potentialChunk = currentChunk
      ? `${currentChunk}\n\n${paragraph}`
      : paragraph;

    if (potentialChunk.length > MAX_CHUNK_CHARS && currentChunk) {
      chunks.push({
        content: currentChunk,
        index: chunkIndex,
        total: 0,
        startChar: currentStartChar,
        endChar: currentStartChar + currentChunk.length
      });

      currentStartChar += currentChunk.length;
      currentChunk = paragraph;
      chunkIndex++;
    } else {
      currentChunk = potentialChunk;
    }

    if (currentChunk.length > MAX_CHUNK_CHARS) {
      const sentences = currentChunk.split(/(?<=[.!?])\s+/);
      let sentenceChunk = '';

      for (const sentence of sentences) {
        if ((sentenceChunk + sentence).length > MAX_CHUNK_CHARS && sentenceChunk) {
          chunks.push({
            content: sentenceChunk,
            index: chunkIndex,
            total: 0,
            startChar: currentStartChar,
            endChar: currentStartChar + sentenceChunk.length
          });
          currentStartChar += sentenceChunk.length;
          sentenceChunk = sentence;
          chunkIndex++;
        } else {
          sentenceChunk = sentenceChunk ? `${sentenceChunk} ${sentence}` : sentence;
        }
      }
      currentChunk = sentenceChunk;
    }
  }

  if (currentChunk) {
    chunks.push({
      content: currentChunk,
      index: chunkIndex,
      total: 0,
      startChar: currentStartChar,
      endChar: currentStartChar + currentChunk.length
    });
  }

  const totalChunks = chunks.length;
  chunks.forEach(chunk => chunk.total = totalChunks);

  return chunks;
}

async function summarizeChunk(chunk: ContentChunk, options: SummaryOptions): Promise<string> {
  return rateLimiter.execute(async () => {
    return retryWithBackoff(
      async () => {
        const { text } = await generateText({
          model: MODEL,
          prompt: buildChunkPrompt(chunk.content, chunk.index, chunk.total),
        });

        if (!text || text.trim().length === 0) {
          throw new SummarizerError(
            `AI model returned empty response for chunk ${chunk.index + 1}`,
            'EMPTY_SUMMARY',
            true
          );
        }

        return text;
      },
      {
        maxRetries: options.maxRetries || 3,
        baseDelay: options.retryDelay || 1000,
        operation: `Summarizing chunk ${chunk.index + 1}/${chunk.total}`
      }
    );
  });
}

async function synthesizeChunkSummaries(
  chunkSummaries: string[],
  options: SummaryOptions
): Promise<string> {
  return rateLimiter.execute(async () => {
    return retryWithBackoff(
      async () => {
        const { text } = await generateText({
          model: MODEL,
          prompt: buildSynthesisPrompt(chunkSummaries, options),
        });

        if (!text || text.trim().length === 0) {
          throw new SummarizerError(
            'AI model returned empty synthesis',
            'EMPTY_SUMMARY',
            true
          );
        }

        return text;
      },
      {
        maxRetries: options.maxRetries || 3,
        baseDelay: options.retryDelay || 1000,
        operation: 'Synthesizing chunk summaries'
      }
    );
  });
}

export async function summarizeContent(
  content: string,
  options: SummaryOptions
): Promise<string> {
  const chunks = createContentChunks(content);

  // Single chunk - use direct summarization
  if (chunks.length === 1) {
    return rateLimiter.execute(async () => {
      return retryWithBackoff(
        async () => {
          const { text } = await generateText({
            model: MODEL,
            prompt: buildPrompt(content, options),
          });

          if (!text || text.trim().length === 0) {
            throw new SummarizerError(
              'AI model returned empty response',
              'EMPTY_SUMMARY',
              true
            );
          }

          return text;
        },
        {
          maxRetries: options.maxRetries || 3,
          baseDelay: options.retryDelay || 1000,
          operation: 'Summarization'
        }
      );
    });
  }

  console.log(`Content is large (${content.length} chars). Processing in ${chunks.length} chunks...`);

  const chunkSummaries: string[] = [];
  for (const chunk of chunks) {
    console.log(`   Processing chunk ${chunk.index + 1}/${chunk.total}...`);
    const summary = await summarizeChunk(chunk, options);
    chunkSummaries.push(summary);
  }

  console.log(`   Synthesizing final summary from ${chunks.length} chunks...`);
  return synthesizeChunkSummaries(chunkSummaries, options);
}

export async function generateComparativeSummary(
  results: BatchResult[],
  options: SummaryOptions
): Promise<string> {
  return rateLimiter.execute(async () => {
    return retryWithBackoff(
      async () => {
        const { text } = await generateText({
          model: MODEL,
          prompt: buildComparativePrompt(results),
        });

        if (!text || text.trim().length === 0) {
          throw new SummarizerError(
            'AI model returned empty comparative summary',
            'EMPTY_SUMMARY',
            true
          );
        }

        return text;
      },
      {
        maxRetries: options.maxRetries || 3,
        baseDelay: options.retryDelay || 1000,
        operation: 'Comparative summary'
      }
    );
  });
}
