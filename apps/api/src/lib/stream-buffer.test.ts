/**
 * Unit tests for TokenStreamBuffer.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TokenStreamBuffer } from './stream-buffer.js';

describe('TokenStreamBuffer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('buffers tokens and flushes after interval', async () => {
    const flushed: string[] = [];
    const buf = new TokenStreamBuffer(async (text) => { flushed.push(text); }, { flushIntervalMs: 30 });

    buf.push('Hello');
    buf.push(' ');
    buf.push('world');

    expect(flushed).toHaveLength(0); // Not yet

    await vi.advanceTimersByTimeAsync(30);

    expect(flushed).toHaveLength(1);
    expect(flushed[0]).toBe('Hello world');
  });

  it('flushes immediately when buffer exceeds maxBufferSize', async () => {
    const flushed: string[] = [];
    const buf = new TokenStreamBuffer(async (text) => { flushed.push(text); }, { maxBufferSize: 5 });

    buf.push('123456'); // 6 chars > maxBufferSize of 5

    // Flush should happen synchronously (next tick)
    await Promise.resolve();

    expect(flushed).toHaveLength(1);
    expect(flushed[0]).toBe('123456');
  });

  it('flush() sends buffered content immediately', async () => {
    const flushed: string[] = [];
    const buf = new TokenStreamBuffer(async (text) => { flushed.push(text); }, { flushIntervalMs: 1000 });

    buf.push('Important');
    expect(flushed).toHaveLength(0);

    await buf.flush();
    expect(flushed).toHaveLength(1);
    expect(flushed[0]).toBe('Important');
  });

  it('close() flushes remaining content', async () => {
    const flushed: string[] = [];
    const buf = new TokenStreamBuffer(async (text) => { flushed.push(text); });

    buf.push('Final content');
    await buf.close();

    expect(flushed).toContain('Final content');
  });

  it('ignores pushes after close', async () => {
    const flushed: string[] = [];
    const buf = new TokenStreamBuffer(async (text) => { flushed.push(text); });

    await buf.close();
    buf.push('After close');

    await vi.advanceTimersByTimeAsync(100);
    expect(flushed.join('')).not.toContain('After close');
  });

  it('does not flush when buffer is empty', async () => {
    const flushed: string[] = [];
    const buf = new TokenStreamBuffer(async (text) => { flushed.push(text); });

    await buf.flush();
    expect(flushed).toHaveLength(0);
  });
});
