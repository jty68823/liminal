import type { Message } from '../types/message.js';
import { estimateTokens, countMessageTokens } from './counter.js';

/**
 * Conversation summarizer — compresses old messages into a summary
 * to maintain context within token limits while preserving key information.
 */

export interface SummaryResult {
  /** The generated summary text */
  summary: string;
  /** Number of messages that were summarized */
  summarizedCount: number;
  /** Approximate token savings */
  savedTokens: number;
}

/**
 * Creates a prompt that asks the model to summarize a conversation segment.
 */
export function buildSummaryPrompt(messages: Message[]): string {
  const formatted = messages.map((m) => {
    const content = typeof m.content === 'string'
      ? m.content
      : m.content.map((b) => {
          if (b.type === 'text') return b.text;
          if (b.type === 'tool_use') return `[Tool: ${b.name}(${JSON.stringify(b.input)})]`;
          if (b.type === 'tool_result') return `[Result: ${typeof b.content === 'string' ? b.content.slice(0, 200) : '...'}]`;
          return '';
        }).join(' ');
    return `${m.role}: ${content}`;
  }).join('\n');

  return `Summarize this conversation concisely, preserving:
- Key decisions and conclusions
- Important code/file references
- Tool results and their outcomes
- User preferences expressed

Conversation:
${formatted}

Provide a brief, factual summary in 2-4 sentences:`;
}

/**
 * Extracts key information from messages for priority-based truncation.
 * Returns a relevance score (0-1) for each message.
 */
export function scoreMessageRelevance(msg: Message, index: number, total: number): number {
  let score = 0;

  // Recency bias: newer messages are more relevant
  const recencyWeight = (index + 1) / total;
  score += recencyWeight * 0.3;

  // System messages are always critical
  if (msg.role === 'system') return 1.0;

  const content = typeof msg.content === 'string' ? msg.content : '';

  // Messages with errors are important (user corrections, tool failures)
  if (content.toLowerCase().includes('error') || content.toLowerCase().includes('fix')) {
    score += 0.2;
  }

  // Tool results with errors are important
  if (typeof msg.content !== 'string') {
    for (const block of msg.content) {
      if (block.type === 'tool_result' && block.is_error) {
        score += 0.25;
      }
      if (block.type === 'tool_use') {
        score += 0.1; // tool usage context
      }
    }
  }

  // Short user messages (likely commands/corrections) are important
  if (msg.role === 'user' && content.length < 100) {
    score += 0.15;
  }

  return Math.min(score, 1.0);
}

/**
 * Splits messages into "keep" (recent + high-relevance) and "summarize" (old, low-relevance).
 *
 * @param messages Full message history (excluding system)
 * @param keepCount Number of recent messages to always keep
 * @param maxSummarize Maximum number of messages to include in summary
 */
export function partitionForSummary(
  messages: Message[],
  keepCount = 6,
  maxSummarize = 20,
): { toSummarize: Message[]; toKeep: Message[] } {
  if (messages.length <= keepCount) {
    return { toSummarize: [], toKeep: messages };
  }

  const toKeep = messages.slice(-keepCount);
  const candidates = messages.slice(0, -keepCount);

  // Take the most recent `maxSummarize` from old messages
  const toSummarize = candidates.slice(-maxSummarize);

  return { toSummarize, toKeep };
}

/**
 * Builds a system-level summary injection message.
 * This is prepended to the conversation so the model has context
 * about earlier parts of the conversation.
 */
export function buildSummaryMessage(summary: string): Message {
  return {
    id: `summary-${Date.now()}`,
    role: 'system',
    content: `[Previous conversation summary]\n${summary}`,
    created_at: Date.now(),
  };
}

/**
 * Estimates token savings from summarizing a set of messages.
 */
export function estimateSavings(messages: Message[], summaryText: string): number {
  const originalTokens = countMessageTokens(messages);
  const summaryTokens = estimateTokens(summaryText) + 20; // overhead
  return Math.max(0, originalTokens - summaryTokens);
}
