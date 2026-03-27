import { describe, it, expect } from 'vitest';
import { truncateContext, needsTruncation, maybetruncateContext } from './truncator.js';
import type { Message } from '../types/message.js';

/**
 * Helper to create a simple text message.
 */
function makeMessage(
  role: Message['role'],
  content: string,
  id = 'msg-' + Math.random().toString(36).slice(2, 8),
): Message {
  return { id, role, content, created_at: Date.now() };
}

/**
 * Helper to create a message with a known token cost.
 * Using estimateTokens: ceil(text.length / 4) + 4 overhead per message.
 * So a message with text of length N costs ceil(N/4) + 4 tokens.
 *
 * To get a message that costs ~T tokens total:
 *   content length = (T - 4) * 4  characters
 */
function makeMessageWithTokenCost(
  role: Message['role'],
  totalTokens: number,
  id?: string,
): Message {
  const contentTokens = totalTokens - 4; // subtract per-message overhead
  const charCount = Math.max(0, contentTokens * 4); // each token ≈ 4 chars
  const content = 'x'.repeat(charCount);
  return makeMessage(role, content, id);
}

describe('truncateContext', () => {
  it('returns empty array for empty messages', () => {
    const result = truncateContext([], 1000);
    expect(result.messages).toEqual([]);
    expect(result.removedCount).toBe(0);
  });

  it('does not truncate when messages fit within budget', () => {
    const messages = [
      makeMessage('user', 'hi'),       // ceil(2/4)+4 = 5 tokens
      makeMessage('assistant', 'hello'), // ceil(5/4)+4 = 6 tokens
    ];
    // Total ≈ 11 tokens, budget is 1000 — should not truncate
    const result = truncateContext(messages, 1000);
    expect(result.messages).toHaveLength(2);
    expect(result.removedCount).toBe(0);
  });

  it('truncates oldest messages when exceeding budget', () => {
    // Each message ≈ 100 tokens total (96 content + 4 overhead)
    const messages = [
      makeMessageWithTokenCost('user', 100, 'msg1'),
      makeMessageWithTokenCost('assistant', 100, 'msg2'),
      makeMessageWithTokenCost('user', 100, 'msg3'),
      makeMessageWithTokenCost('assistant', 100, 'msg4'),
    ];
    // Total ≈ 400 tokens, budget = 250 → should remove oldest messages
    const result = truncateContext(messages, 250);
    expect(result.removedCount).toBeGreaterThan(0);
    expect(result.messages.length).toBeLessThan(4);
    // The most recent messages should survive
    const ids = result.messages.map((m) => m.id);
    expect(ids).toContain('msg4');
  });

  it('preserves system message during truncation', () => {
    const messages: Message[] = [
      makeMessageWithTokenCost('system', 50, 'sys'),
      makeMessageWithTokenCost('user', 100, 'msg1'),
      makeMessageWithTokenCost('assistant', 100, 'msg2'),
      makeMessageWithTokenCost('user', 100, 'msg3'),
    ];
    // Budget = 200, total ≈ 350 → must truncate but keep system
    const result = truncateContext(messages, 200);
    expect(result.messages[0].role).toBe('system');
    expect(result.messages[0].id).toBe('sys');
  });

  it('prunes orphaned tool results', () => {
    const messages: Message[] = [
      makeMessage('system', 'You are helpful'),
      {
        id: 'ast1',
        role: 'assistant',
        content: [
          { type: 'tool_use', id: 'tu1', name: 'bash', input: { command: 'ls' } },
        ],
        created_at: Date.now(),
      },
      {
        id: 'tr1',
        role: 'user',
        content: [
          { type: 'tool_result', tool_use_id: 'tu1', content: 'file1\nfile2' },
        ],
        created_at: Date.now(),
      },
      makeMessageWithTokenCost('assistant', 100, 'final'),
    ];

    // Set a tight budget that forces removal of the tool_use assistant message
    // System ≈ ~8 tokens, final ≈ 100, so budget ~120 forces removal of middle messages
    const result = truncateContext(messages, 120);

    // The orphaned tool_result (whose tool_use was removed) should be pruned
    const hasOrphanedToolResult = result.messages.some(
      (m) =>
        m.role === 'user' &&
        Array.isArray(m.content) &&
        m.content.every((b) => b.type === 'tool_result'),
    );
    // If the assistant tool_use message was removed, the tool_result should also be gone
    const hasToolUse = result.messages.some((m) => m.id === 'ast1');
    if (!hasToolUse) {
      expect(hasOrphanedToolResult).toBe(false);
    }
  });
});

describe('needsTruncation', () => {
  it('returns false when messages fit within 90% of context limit', () => {
    const messages = [makeMessage('user', 'hi')]; // ≈ 5 tokens
    expect(needsTruncation(messages, 1000)).toBe(false);
  });

  it('returns true when messages exceed 90% of context limit', () => {
    // Each 100-token message; 4 messages = 400 tokens; 90% of 400 = 360
    const messages = [
      makeMessageWithTokenCost('user', 100),
      makeMessageWithTokenCost('assistant', 100),
      makeMessageWithTokenCost('user', 100),
      makeMessageWithTokenCost('assistant', 100),
    ];
    // Context limit = 400, safeLimit = 360. Total = 400 > 360 → true
    expect(needsTruncation(messages, 400)).toBe(true);
  });

  it('returns false when messages equal exactly the safe limit', () => {
    // 1 message of 10 tokens → needs limit where floor(limit*0.9) >= 10
    const messages = [makeMessageWithTokenCost('user', 10)];
    // limit = 12, safeLimit = floor(12*0.9) = 10. Total = 10. 10 > 10 is false.
    expect(needsTruncation(messages, 12)).toBe(false);
  });
});

describe('maybetruncateContext', () => {
  it('returns messages unchanged when no truncation needed', () => {
    const messages = [makeMessage('user', 'hi')];
    const result = maybetruncateContext(messages, 'default');
    // default context limit = 8192, safe = ~7372 — 'hi' ≈ 5 tokens, no truncation
    expect(result.messages).toEqual(messages);
    expect(result.removedCount).toBe(0);
  });

  it('truncates when messages exceed model context', () => {
    // Create messages that exceed even the smallest model limit
    const messages: Message[] = [];
    // gemma2 has 8192 limit, safe = 7372. We need > 7372 tokens.
    // Each message ≈ 1000 tokens → 8 messages = 8000 > 7372
    for (let i = 0; i < 8; i++) {
      messages.push(
        makeMessageWithTokenCost(i % 2 === 0 ? 'user' : 'assistant', 1000, `msg${i}`),
      );
    }
    const result = maybetruncateContext(messages, 'gemma2:latest');
    expect(result.removedCount).toBeGreaterThan(0);
    expect(result.messages.length).toBeLessThan(messages.length);
  });

  it('respects overrideMax parameter', () => {
    const messages = [
      makeMessageWithTokenCost('user', 50, 'msg1'),
      makeMessageWithTokenCost('assistant', 50, 'msg2'),
    ];
    // Total = 100 tokens. Override max = 80, safe = 72. 100 > 72 → should truncate
    const result = maybetruncateContext(messages, 'default', 80);
    expect(result.removedCount).toBeGreaterThan(0);
  });
});
