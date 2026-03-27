/**
 * Streaming response parser for Liminal AI chat completions.
 *
 * Handles two distinct model families:
 *
 * 1. **Native tool-call models** (Qwen 2.5, Llama 3.x, Mistral …)
 *    The provider returns structured `tool_calls` arrays in the chunk's
 *    `message` field. These are passed through directly as `tool_call` events.
 *
 * 2. **Reasoning models** (DeepSeek R1, etc.)
 *    The model emits a `<think>…</think>` block containing chain-of-thought
 *    reasoning before the actual response. It may also emit tool calls as
 *    raw text inside `<tool_call>…</tool_call>` XML-like tags.
 *
 * State machine:
 *   RESPONDING ──(sees "<think")──► THINKING
 *   THINKING   ──(sees "</think>")─► RESPONDING
 *   RESPONDING ──(sees "<tool_call")──► TOOL_CALLING
 *   TOOL_CALLING──(sees "</tool_call>")─► RESPONDING
 */

import type { ChatStreamChunk } from './providers/types.js';

/** Tool call structure within a stream chunk. */
interface StreamToolCall {
  function: { name: string; arguments: Record<string, unknown> };
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ParsedEvent =
  | { type: 'thinking'; delta: string }
  | { type: 'token'; delta: string }
  | { type: 'tool_call'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'done'; finish_reason: string };

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

type ParserState = 'RESPONDING' | 'THINKING' | 'TOOL_CALLING';

/** Characters that could be the start of a recognised tag. */
const TAG_TRIGGER = '<';

/** The minimum length of a look-ahead tag prefix we want to hold back. */
const MAX_TAG_PREFIX = 12; // length of "</tool_call>" = 12

/** Counter used to generate unique (within a session) tool-call IDs. */
let _toolCallCounter = 0;

function nextToolCallId(): string {
  return `tc_${Date.now()}_${_toolCallCounter++}`;
}

// ---------------------------------------------------------------------------
// StreamParser class
// ---------------------------------------------------------------------------

export class StreamParser {
  private state: ParserState = 'RESPONDING';

  /**
   * Text that may be the start of a control tag (`<think>`, `</think>`,
   * `<tool_call>`, `</tool_call>`).  We hold it back until we can confirm
   * whether it is or is not a tag boundary.
   */
  private pendingTagBuffer = '';

  /**
   * Accumulates the raw JSON text found inside a `<tool_call>…</tool_call>`
   * block so we can parse it once the closing tag is seen.
   */
  private toolCallBuffer = '';

  /**
   * Process one streaming chunk and return the typed events it
   * produces.
   */
  parseChunk(chunk: ChatStreamChunk): ParsedEvent[] {
    const events: ParsedEvent[] = [];

    // ── Native tool calls (Qwen 2.5 / Llama 3.x / Mistral) ────────────────
    // When the provider returns structured tool_calls we emit them immediately
    // and do not attempt to process the (empty) content string.
    if (
      chunk.message?.tool_calls &&
      chunk.message.tool_calls.length > 0
    ) {
      for (const tc of chunk.message.tool_calls) {
        events.push(
          this._makeToolCallEvent(tc),
        );
      }
      if (chunk.done) {
        events.push({ type: 'done', finish_reason: chunk.done_reason ?? 'tool_calls' });
      }
      return events;
    }

    // ── Text content ────────────────────────────────────────────────────────
    const text = chunk.message?.content ?? '';
    if (text) {
      const produced = this._processText(text);
      events.push(...produced);
    }

    // ── Done ────────────────────────────────────────────────────────────────
    if (chunk.done) {
      // Flush anything left in the pending-tag buffer as a normal token or
      // thinking delta, depending on current state.
      if (this.pendingTagBuffer) {
        events.push(this._makeTextEvent(this.pendingTagBuffer));
        this.pendingTagBuffer = '';
      }
      // If we're still mid-tool-call on done (shouldn't happen normally),
      // attempt to parse whatever we have.
      if (this.state === 'TOOL_CALLING' && this.toolCallBuffer.trim()) {
        const tc = this._tryParseToolCallJson(this.toolCallBuffer);
        if (tc) events.push(tc);
        this.toolCallBuffer = '';
        this.state = 'RESPONDING';
      }
      events.push({ type: 'done', finish_reason: chunk.done_reason ?? 'stop' });
    }

    return events;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /**
   * Feeds `text` through the state machine character-by-character (actually
   * segment-by-segment using indexOf for efficiency).
   */
  private _processText(text: string): ParsedEvent[] {
    const events: ParsedEvent[] = [];
    // Combine any previously buffered tag prefix with the new text
    let remaining = this.pendingTagBuffer + text;
    this.pendingTagBuffer = '';

    while (remaining.length > 0) {
      switch (this.state) {
        case 'THINKING': {
          const closeIdx = remaining.indexOf('</think>');
          if (closeIdx === -1) {
            // Check if remaining ends with a partial '</think>' prefix
            const partial = this._trailingTagPrefix(remaining, '</think>');
            if (partial > 0) {
              // Emit everything before the partial prefix as thinking
              const safe = remaining.slice(0, remaining.length - partial);
              if (safe) events.push({ type: 'thinking', delta: safe });
              this.pendingTagBuffer = remaining.slice(remaining.length - partial);
              remaining = '';
            } else {
              events.push({ type: 'thinking', delta: remaining });
              remaining = '';
            }
          } else {
            // Emit text before </think> as thinking, then switch state
            if (closeIdx > 0) events.push({ type: 'thinking', delta: remaining.slice(0, closeIdx) });
            this.state = 'RESPONDING';
            remaining = remaining.slice(closeIdx + '</think>'.length);
          }
          break;
        }

        case 'TOOL_CALLING': {
          const closeIdx = remaining.indexOf('</tool_call>');
          if (closeIdx === -1) {
            // May end with partial closing tag
            const partial = this._trailingTagPrefix(remaining, '</tool_call>');
            if (partial > 0) {
              this.toolCallBuffer += remaining.slice(0, remaining.length - partial);
              this.pendingTagBuffer = remaining.slice(remaining.length - partial);
              remaining = '';
            } else {
              this.toolCallBuffer += remaining;
              remaining = '';
            }
          } else {
            this.toolCallBuffer += remaining.slice(0, closeIdx);
            const tc = this._tryParseToolCallJson(this.toolCallBuffer.trim());
            if (tc) events.push(tc);
            this.toolCallBuffer = '';
            this.state = 'RESPONDING';
            remaining = remaining.slice(closeIdx + '</tool_call>'.length);
          }
          break;
        }

        case 'RESPONDING':
        default: {
          const tagIdx = remaining.indexOf(TAG_TRIGGER);
          if (tagIdx === -1) {
            // No tag start in sight — check for partial tag at end
            const partial = this._trailingTagPrefix(remaining, '<think>', '</think>', '<tool_call>', '</tool_call>');
            if (partial > 0) {
              const safe = remaining.slice(0, remaining.length - partial);
              if (safe) events.push({ type: 'token', delta: safe });
              this.pendingTagBuffer = remaining.slice(remaining.length - partial);
              remaining = '';
            } else {
              if (remaining) events.push({ type: 'token', delta: remaining });
              remaining = '';
            }
          } else {
            // Emit text before the '<'
            if (tagIdx > 0) events.push({ type: 'token', delta: remaining.slice(0, tagIdx) });
            remaining = remaining.slice(tagIdx);

            // Identify which tag starts here
            if (remaining.startsWith('<think>')) {
              this.state = 'THINKING';
              remaining = remaining.slice('<think>'.length);
            } else if (remaining.startsWith('<tool_call>')) {
              this.state = 'TOOL_CALLING';
              remaining = remaining.slice('<tool_call>'.length);
            } else if (remaining.startsWith('</think>') || remaining.startsWith('</tool_call>')) {
              // Orphaned closing tag — skip it and continue
              const end = remaining.indexOf('>') + 1;
              remaining = remaining.slice(end);
            } else {
              // Check if this might be the start of a recognised tag (partial)
              const partial = this._trailingTagPrefix(remaining,
                '<think>', '</think>', '<tool_call>', '</tool_call>');
              if (partial === remaining.length) {
                // The entire remainder is a potential tag prefix — hold back
                this.pendingTagBuffer = remaining;
                remaining = '';
              } else {
                // Just a regular '<' that isn't a known tag — emit it
                events.push({ type: 'token', delta: remaining[0] });
                remaining = remaining.slice(1);
              }
            }
          }
          break;
        }
      }
    }

    return events;
  }

  /**
   * Returns the length of the longest suffix of `text` that is a prefix of
   * any of the `tags`.  Returns 0 if no tag starts match.
   *
   * Used to detect partial tags at the end of a chunk so we can hold them
   * back in `pendingTagBuffer` and wait for the next chunk before deciding
   * what they are.
   */
  private _trailingTagPrefix(text: string, ...tags: string[]): number {
    let maxMatch = 0;
    for (const tag of tags) {
      for (let len = Math.min(tag.length - 1, text.length); len > 0; len--) {
        if (tag.startsWith(text.slice(text.length - len))) {
          maxMatch = Math.max(maxMatch, len);
          break;
        }
      }
    }
    return maxMatch;
  }

  /** Returns the appropriate text event for the current state. */
  private _makeTextEvent(text: string): ParsedEvent {
    if (this.state === 'THINKING') return { type: 'thinking', delta: text };
    return { type: 'token', delta: text };
  }

  /**
   * Converts a native tool call into a `tool_call` ParsedEvent.
   */
  private _makeToolCallEvent(tc: StreamToolCall): ParsedEvent {
    return {
      type: 'tool_call',
      id: nextToolCallId(),
      name: tc.function.name,
      input: tc.function.arguments,
    };
  }

  /**
   * Attempts to parse the JSON content found inside a `<tool_call>` block.
   *
   * Expected format:
   * ```json
   * { "name": "bash", "arguments": { … } }
   * ```
   * or (alternate form used by some models):
   * ```json
   * { "name": "bash", "parameters": { … } }
   * ```
   */
  private _tryParseToolCallJson(json: string): ParsedEvent | null {
    try {
      const parsed = JSON.parse(json) as {
        name?: string;
        arguments?: Record<string, unknown>;
        parameters?: Record<string, unknown>;
      };

      if (!parsed.name) return null;

      return {
        type: 'tool_call',
        id: nextToolCallId(),
        name: parsed.name,
        input: parsed.arguments ?? parsed.parameters ?? {},
      };
    } catch {
      return null;
    }
  }

  /** Resets parser state, useful between turns. */
  reset(): void {
    this.state = 'RESPONDING';
    this.pendingTagBuffer = '';
    this.toolCallBuffer = '';
  }
}
