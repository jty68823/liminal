import { describe, it, expect, beforeEach } from 'vitest';
import { StreamParser } from './stream-parser.js';

/**
 * Helper to create a minimal ChatStreamChunk object.
 */
function makeChunk(
  content: string,
  done = false,
  done_reason?: string,
  tool_calls?: Array<{ function: { name: string; arguments: Record<string, unknown> } }>,
): any {
  return {
    message: { content, tool_calls },
    done,
    done_reason,
  };
}

describe('StreamParser', () => {
  let parser: StreamParser;

  beforeEach(() => {
    parser = new StreamParser();
  });

  // ── 1. Basic token emission ──────────────────────────────────────────────

  describe('basic token emission', () => {
    it('emits a token event for plain text', () => {
      const events = parser.parseChunk(makeChunk('Hello world'));
      expect(events).toEqual([{ type: 'token', delta: 'Hello world' }]);
    });

    it('emits multiple token events across chunks', () => {
      const e1 = parser.parseChunk(makeChunk('Hello '));
      const e2 = parser.parseChunk(makeChunk('world'));
      expect(e1).toEqual([{ type: 'token', delta: 'Hello ' }]);
      expect(e2).toEqual([{ type: 'token', delta: 'world' }]);
    });

    it('returns no token events for empty content', () => {
      const events = parser.parseChunk(makeChunk(''));
      expect(events).toEqual([]);
    });
  });

  // ── 2. Thinking block parsing ────────────────────────────────────────────

  describe('thinking block parsing', () => {
    it('parses a complete <think>...</think> block in one chunk', () => {
      const events = parser.parseChunk(makeChunk('<think>reasoning here</think>'));
      expect(events).toEqual([{ type: 'thinking', delta: 'reasoning here' }]);
    });

    it('parses <think> block split across multiple chunks', () => {
      const e1 = parser.parseChunk(makeChunk('<think>part one'));
      const e2 = parser.parseChunk(makeChunk(' part two</think>'));

      expect(e1).toEqual([{ type: 'thinking', delta: 'part one' }]);
      expect(e2).toEqual([{ type: 'thinking', delta: ' part two' }]);
    });

    it('transitions back to token mode after </think>', () => {
      const e1 = parser.parseChunk(makeChunk('<think>thought</think>answer'));
      expect(e1).toEqual([
        { type: 'thinking', delta: 'thought' },
        { type: 'token', delta: 'answer' },
      ]);
    });
  });

  // ── 3. Tool call parsing (XML-style) ────────────────────────────────────

  describe('tool call parsing (XML tags)', () => {
    it('parses a complete <tool_call>...</tool_call> block', () => {
      const json = JSON.stringify({ name: 'bash', arguments: { command: 'ls' } });
      const events = parser.parseChunk(makeChunk(`<tool_call>${json}</tool_call>`));

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('tool_call');
      if (events[0].type === 'tool_call') {
        expect(events[0].name).toBe('bash');
        expect(events[0].input).toEqual({ command: 'ls' });
        expect(events[0].id).toMatch(/^tc_/);
      }
    });

    it('parses tool_call split across multiple chunks', () => {
      const json = JSON.stringify({ name: 'bash', arguments: { command: 'pwd' } });
      const half = Math.floor(json.length / 2);

      parser.parseChunk(makeChunk(`<tool_call>${json.slice(0, half)}`));
      const e2 = parser.parseChunk(makeChunk(`${json.slice(half)}</tool_call>`));

      expect(e2).toHaveLength(1);
      expect(e2[0].type).toBe('tool_call');
      if (e2[0].type === 'tool_call') {
        expect(e2[0].name).toBe('bash');
        expect(e2[0].input).toEqual({ command: 'pwd' });
      }
    });

    it('handles "parameters" key as an alternative to "arguments"', () => {
      const json = JSON.stringify({ name: 'read_file', parameters: { path: '/tmp/test' } });
      const events = parser.parseChunk(makeChunk(`<tool_call>${json}</tool_call>`));

      expect(events).toHaveLength(1);
      if (events[0].type === 'tool_call') {
        expect(events[0].input).toEqual({ path: '/tmp/test' });
      }
    });
  });

  // ── 4. Native tool calls ────────────────────────────────────────────────

  describe('native tool calls (chunk.message.tool_calls)', () => {
    it('emits tool_call events from native provider tool_calls', () => {
      const events = parser.parseChunk(
        makeChunk('', false, undefined, [
          { function: { name: 'bash', arguments: { command: 'echo hi' } } },
        ]),
      );

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('tool_call');
      if (events[0].type === 'tool_call') {
        expect(events[0].name).toBe('bash');
        expect(events[0].input).toEqual({ command: 'echo hi' });
      }
    });

    it('emits multiple native tool calls', () => {
      const events = parser.parseChunk(
        makeChunk('', false, undefined, [
          { function: { name: 'bash', arguments: { command: 'ls' } } },
          { function: { name: 'read_file', arguments: { path: '/tmp/x' } } },
        ]),
      );

      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('tool_call');
      expect(events[1].type).toBe('tool_call');
    });

    it('appends done event when native tool call chunk has done=true', () => {
      const events = parser.parseChunk(
        makeChunk('', true, 'tool_calls', [
          { function: { name: 'bash', arguments: { command: 'ls' } } },
        ]),
      );

      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('tool_call');
      expect(events[1]).toEqual({ type: 'done', finish_reason: 'tool_calls' });
    });
  });

  // ── 5. Partial tags spanning multiple chunks ────────────────────────────

  describe('partial tags across chunks', () => {
    it('handles <think> tag split across chunks', () => {
      const e1 = parser.parseChunk(makeChunk('<thi'));
      // The partial tag should be buffered, no events yet
      expect(e1).toEqual([]);

      const e2 = parser.parseChunk(makeChunk('nk>deep thought</think>'));
      expect(e2).toEqual([{ type: 'thinking', delta: 'deep thought' }]);
    });

    it('handles </think> tag split across chunks', () => {
      parser.parseChunk(makeChunk('<think>'));
      const e1 = parser.parseChunk(makeChunk('thought</thi'));
      // 'thought' should be emitted, partial '</thi' buffered
      expect(e1).toEqual([{ type: 'thinking', delta: 'thought' }]);

      const e2 = parser.parseChunk(makeChunk('nk>after'));
      expect(e2).toEqual([{ type: 'token', delta: 'after' }]);
    });
  });

  // ── 6. Done event emission ──────────────────────────────────────────────

  describe('done event', () => {
    it('emits done event when chunk.done is true', () => {
      const events = parser.parseChunk(makeChunk('', true, 'stop'));
      expect(events).toEqual([{ type: 'done', finish_reason: 'stop' }]);
    });

    it('uses "stop" as default finish_reason when done_reason is undefined', () => {
      const events = parser.parseChunk(makeChunk('', true));
      expect(events).toEqual([{ type: 'done', finish_reason: 'stop' }]);
    });

    it('emits both final token and done in the same chunk', () => {
      const events = parser.parseChunk(makeChunk('final', true, 'stop'));
      expect(events).toEqual([
        { type: 'token', delta: 'final' },
        { type: 'done', finish_reason: 'stop' },
      ]);
    });

    it('flushes pending tag buffer on done', () => {
      // Send a partial tag that looks like it could start a tag
      parser.parseChunk(makeChunk('<thi'));
      // Now send done — should flush '<thi' as token
      const events = parser.parseChunk(makeChunk('', true, 'stop'));
      expect(events).toContainEqual({ type: 'token', delta: '<thi' });
      expect(events).toContainEqual({ type: 'done', finish_reason: 'stop' });
    });
  });

  // ── 7. Mixed content: text + thinking + tool calls ──────────────────────

  describe('mixed content', () => {
    it('handles text then thinking then text', () => {
      const events = parser.parseChunk(
        makeChunk('Hello <think>reasoning</think> Goodbye'),
      );
      expect(events).toEqual([
        { type: 'token', delta: 'Hello ' },
        { type: 'thinking', delta: 'reasoning' },
        { type: 'token', delta: ' Goodbye' },
      ]);
    });

    it('handles thinking then tool call across multiple chunks', () => {
      const e1 = parser.parseChunk(makeChunk('<think>let me think</think>'));
      expect(e1).toEqual([{ type: 'thinking', delta: 'let me think' }]);

      const json = JSON.stringify({ name: 'bash', arguments: { command: 'ls' } });
      const e2 = parser.parseChunk(makeChunk(`<tool_call>${json}</tool_call>`));
      expect(e2).toHaveLength(1);
      expect(e2[0].type).toBe('tool_call');
    });

    it('handles text + thinking + tool call in a single chunk', () => {
      const json = JSON.stringify({ name: 'bash', arguments: { command: 'ls' } });
      const content = `Analyzing...<think>hmm</think>Calling tool<tool_call>${json}</tool_call>`;
      const events = parser.parseChunk(makeChunk(content));

      const types = events.map((e) => e.type);
      expect(types).toContain('token');
      expect(types).toContain('thinking');
      expect(types).toContain('tool_call');
    });
  });

  // ── Reset ───────────────────────────────────────────────────────────────

  describe('reset', () => {
    it('resets parser state cleanly', () => {
      parser.parseChunk(makeChunk('<think>partial'));
      parser.reset();
      // After reset, parser should be in RESPONDING state
      const events = parser.parseChunk(makeChunk('clean text'));
      expect(events).toEqual([{ type: 'token', delta: 'clean text' }]);
    });
  });
});
