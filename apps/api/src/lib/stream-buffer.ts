/**
 * Token stream buffer for efficient SSE delivery.
 *
 * Batches small token deltas into larger chunks to reduce
 * HTTP overhead and improve perceived streaming smoothness.
 *
 * Strategy:
 * - Buffer tokens for up to `flushIntervalMs` (default: 16ms — one frame at 60fps)
 * - Flush immediately when buffer exceeds `maxBufferSize` (default: 200 chars)
 * - Always flush on explicit flush() or when stream ends
 */

export interface StreamBufferOptions {
  /** Max time to wait before flushing (ms). Default: 16 (one frame) */
  flushIntervalMs?: number;
  /** Max chars to buffer before forcing a flush. Default: 200 */
  maxBufferSize?: number;
}

export class TokenStreamBuffer {
  private buffer = '';
  private flushIntervalMs: number;
  private maxBufferSize: number;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private onFlush: (text: string) => Promise<void>;
  private closed = false;
  private pendingFlush: Promise<void> | null = null;

  constructor(onFlush: (text: string) => Promise<void>, options: StreamBufferOptions = {}) {
    this.onFlush = onFlush;
    this.flushIntervalMs = options.flushIntervalMs ?? 16;
    this.maxBufferSize = options.maxBufferSize ?? 200;
  }

  /** Add a token delta to the buffer. */
  push(delta: string): void {
    if (this.closed) return;
    this.buffer += delta;

    if (this.buffer.length >= this.maxBufferSize) {
      this.flushNow();
    } else if (!this.timer) {
      this.timer = setTimeout(() => this.flushNow(), this.flushIntervalMs);
    }
  }

  /** Flush any buffered content immediately and wait for the write to complete. */
  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    // Wait for any in-flight flush to complete before starting a new one
    if (this.pendingFlush) {
      await this.pendingFlush;
    }
    if (this.buffer.length > 0) {
      const text = this.buffer;
      this.buffer = '';
      await this.onFlush(text).catch(() => {});
    }
  }

  /** Close the buffer and flush remaining content. */
  async close(): Promise<void> {
    this.closed = true;
    await this.flush();
  }

  private flushNow(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.buffer.length === 0) return;

    const text = this.buffer;
    this.buffer = '';
    // Track the in-flight flush so close() can await it
    this.pendingFlush = this.onFlush(text).catch(() => {}).finally(() => {
      this.pendingFlush = null;
    });
  }
}
