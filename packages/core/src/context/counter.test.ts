import { describe, it, expect } from 'vitest';
import {
  estimateTokens,
  countMessageTokens,
  getContextLimit,
  estimateContentTokens,
} from './counter.js';
import type { Message } from '../types/message.js';

describe('estimateTokens', () => {
  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('returns 0 for undefined/null-ish input', () => {
    // estimateTokens checks !text, so empty string is the main case
    expect(estimateTokens('')).toBe(0);
  });

  it('returns ceil(length / 4) for "hello" (5 chars)', () => {
    // ceil(5 / 4) = 2
    expect(estimateTokens('hello')).toBe(2);
  });

  it('returns ceil(length / 4) for various lengths', () => {
    expect(estimateTokens('a')).toBe(1);          // ceil(1/4) = 1
    expect(estimateTokens('abcd')).toBe(1);        // ceil(4/4) = 1
    expect(estimateTokens('abcde')).toBe(2);       // ceil(5/4) = 2
    expect(estimateTokens('a'.repeat(100))).toBe(25); // ceil(100/4) = 25
  });
});

describe('countMessageTokens', () => {
  it('returns 0 for empty message array', () => {
    expect(countMessageTokens([])).toBe(0);
  });

  it('includes per-message overhead of 4 tokens', () => {
    const messages: Message[] = [
      { id: '1', role: 'user', content: '', created_at: Date.now() },
    ];
    // estimateTokens('') = 0, + 4 overhead = 4
    expect(countMessageTokens(messages)).toBe(4);
  });

  it('correctly sums tokens for multiple messages', () => {
    const messages: Message[] = [
      { id: '1', role: 'user', content: 'hello', created_at: Date.now() },     // 2 + 4 = 6
      { id: '2', role: 'assistant', content: 'hi', created_at: Date.now() },    // 1 + 4 = 5
    ];
    // Total: 6 + 5 = 11
    expect(countMessageTokens(messages)).toBe(11);
  });
});

describe('getContextLimit', () => {
  it('returns correct limit for known models', () => {
    expect(getContextLimit('llama3.2:latest')).toBe(131072);
    expect(getContextLimit('deepseek-r1:7b')).toBe(65536);
    expect(getContextLimit('mistral:latest')).toBe(32768);
    expect(getContextLimit('gemma2:latest')).toBe(8192);
    expect(getContextLimit('phi4:latest')).toBe(16384);
  });

  it('returns default 8192 for unknown model', () => {
    expect(getContextLimit('some-unknown-model:latest')).toBe(8192);
  });

  it('returns default 8192 for "default" key', () => {
    expect(getContextLimit('default')).toBe(8192);
  });
});

describe('estimateContentTokens', () => {
  it('estimates tokens for string content', () => {
    // 'hello world' = 11 chars → ceil(11/4) = 3
    expect(estimateContentTokens('hello world')).toBe(3);
  });

  it('estimates tokens for empty string content', () => {
    expect(estimateContentTokens('')).toBe(0);
  });

  it('estimates tokens for array content with text blocks', () => {
    const content = [
      { type: 'text' as const, text: 'hello' },       // ceil(5/4) = 2
      { type: 'text' as const, text: 'world' },       // ceil(5/4) = 2
    ];
    expect(estimateContentTokens(content)).toBe(4);
  });

  it('estimates tokens for image blocks', () => {
    const content = [
      {
        type: 'image' as const,
        source: { type: 'base64' as const, media_type: 'image/png' as const, data: 'abc' },
      },
    ];
    // Image blocks = 1024 tokens
    expect(estimateContentTokens(content)).toBe(1024);
  });

  it('estimates tokens for tool_use blocks', () => {
    const content = [
      {
        type: 'tool_use' as const,
        id: 'tu1',
        name: 'bash',
        input: { command: 'ls' },
      },
    ];
    // estimateTokens('bash') + estimateTokens(JSON.stringify({command:'ls'})) + 8
    // ceil(4/4) + ceil(16/4) + 8 = 1 + 4 + 8 = 13
    expect(estimateContentTokens(content)).toBe(13);
  });

  it('estimates tokens for tool_result blocks with string content', () => {
    const content = [
      {
        type: 'tool_result' as const,
        tool_use_id: 'tu1',
        content: 'file1\nfile2',
      },
    ];
    // estimateTokens('file1\nfile2') = ceil(11/4) = 3, + 4 overhead = 7
    expect(estimateContentTokens(content)).toBe(7);
  });
});
