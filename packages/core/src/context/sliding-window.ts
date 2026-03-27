/**
 * Sliding Window Context Manager
 *
 * Implements a three-tier context management strategy that provides
 * effectively "unlimited" conversation length:
 *
 * Tier 1 — Active Context: Last N messages kept in full.
 * Tier 2 — Summarized History: Older messages compressed to summaries.
 * Tier 3 — Long-Term Memory: Key facts in vector-indexed memory table.
 */

import type { Message } from '../types/message.js';
import { estimateTokens } from './counter.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SlidingWindowConfig {
  /** Maximum number of recent messages to keep in full. Default: 20. */
  activeWindowSize: number;
  /** Target maximum tokens for the context window. Default: 8192. */
  maxContextTokens: number;
  /** Percentage of maxContextTokens at which to trigger compression. Default: 0.8. */
  compressionThreshold: number;
}

export interface SlidingWindowResult {
  /** Messages ready for the LLM (system + summary + recent). */
  messages: Message[];
  /** Whether any messages were compressed into summaries. */
  wasCompressed: boolean;
  /** Number of messages that were summarized. */
  summarizedCount: number;
  /** Estimated token count of the resulting context. */
  estimatedTokens: number;
}

const DEFAULT_CONFIG: SlidingWindowConfig = {
  activeWindowSize: 20,
  maxContextTokens: 8192,
  compressionThreshold: 0.8,
};

// ---------------------------------------------------------------------------
// Manager
// ---------------------------------------------------------------------------

export class SlidingWindowManager {
  private config: SlidingWindowConfig;

  constructor(config: Partial<SlidingWindowConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Prepares the message history to fit within the context window.
   *
   * If the total token count exceeds the threshold, older messages
   * are replaced with a summary message.
   *
   * @param messages      Full conversation history (including system message).
   * @param existingSummary  Optional existing summary from previous compression.
   * @returns             Compressed message array + metadata.
   */
  prepare(
    messages: Message[],
    existingSummary?: string,
  ): SlidingWindowResult {
    // Separate system messages from conversation
    const systemMessages = messages.filter((m) => m.role === 'system');
    const conversationMessages = messages.filter((m) => m.role !== 'system');

    // Estimate total tokens
    const totalTokens = messages.reduce(
      (sum, m) => sum + estimateTokens(typeof m.content === 'string' ? m.content : JSON.stringify(m.content)),
      0,
    );

    const threshold = this.config.maxContextTokens * this.config.compressionThreshold;

    // If under threshold, return as-is
    if (totalTokens <= threshold) {
      return {
        messages,
        wasCompressed: false,
        summarizedCount: 0,
        estimatedTokens: totalTokens,
      };
    }

    // Split into "old" (to summarize) and "recent" (to keep)
    const keepCount = Math.min(
      this.config.activeWindowSize,
      conversationMessages.length,
    );
    const oldMessages = conversationMessages.slice(0, conversationMessages.length - keepCount);
    const recentMessages = conversationMessages.slice(conversationMessages.length - keepCount);

    if (oldMessages.length === 0) {
      // Nothing to summarize — all messages are recent
      return {
        messages,
        wasCompressed: false,
        summarizedCount: 0,
        estimatedTokens: totalTokens,
      };
    }

    // Build summary from old messages
    const summaryText = this.buildSummary(oldMessages, existingSummary);

    const summaryMessage: Message = {
      id: 'context-summary',
      role: 'system',
      content: summaryText,
      created_at: Date.now(),
    };

    // Assemble: system messages + summary + recent messages
    const result = [...systemMessages, summaryMessage, ...recentMessages];
    const resultTokens = result.reduce(
      (sum, m) => sum + estimateTokens(typeof m.content === 'string' ? m.content : JSON.stringify(m.content)),
      0,
    );

    return {
      messages: result,
      wasCompressed: true,
      summarizedCount: oldMessages.length,
      estimatedTokens: resultTokens,
    };
  }

  /**
   * Creates a text summary from old messages.
   * This is a simple extractive summary — for best results, use the LLM
   * to generate an abstractive summary (see chat.service.ts integration).
   */
  private buildSummary(oldMessages: Message[], existingSummary?: string): string {
    const sections: string[] = [];

    if (existingSummary) {
      sections.push(`Previous conversation summary:\n${existingSummary}`);
    }

    // Extract key exchanges (user questions + assistant answers)
    const exchanges: string[] = [];
    for (let i = 0; i < oldMessages.length; i++) {
      const msg = oldMessages[i];
      const content = typeof msg.content === 'string'
        ? msg.content
        : JSON.stringify(msg.content);

      if (msg.role === 'user') {
        // Truncate long messages
        const truncated = content.length > 200
          ? content.slice(0, 200) + '...'
          : content;
        exchanges.push(`User: ${truncated}`);
      } else if (msg.role === 'assistant') {
        const truncated = content.length > 300
          ? content.slice(0, 300) + '...'
          : content;
        exchanges.push(`Assistant: ${truncated}`);
      }
    }

    if (exchanges.length > 0) {
      sections.push(
        `<conversation_history_summary>\n` +
        `The following is a summary of ${oldMessages.length} earlier messages in this conversation:\n\n` +
        exchanges.join('\n\n') +
        `\n</conversation_history_summary>`,
      );
    }

    return sections.join('\n\n');
  }

  /**
   * Generates a prompt to ask the LLM to create a better summary.
   * Use this with a fast model to produce abstractive summaries.
   */
  buildSummaryPrompt(messages: Message[]): string {
    const exchanges = messages.map((m) => {
      const content = typeof m.content === 'string'
        ? m.content
        : JSON.stringify(m.content);
      const truncated = content.length > 500 ? content.slice(0, 500) + '...' : content;
      return `${m.role}: ${truncated}`;
    }).join('\n\n');

    return `Summarize the following conversation exchange in 3-5 bullet points. Focus on key decisions, facts discovered, and the user's goals. Be concise.\n\n${exchanges}\n\nSummary:`;
  }

  /** Update configuration at runtime. */
  updateConfig(partial: Partial<SlidingWindowConfig>): void {
    Object.assign(this.config, partial);
  }
}

/** Default sliding window manager. */
export const slidingWindowManager = new SlidingWindowManager();
