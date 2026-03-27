/**
 * ReAct-style tool-call loop for Liminal AI.
 *
 * The loop implements the "Reason → Act → Observe" cycle:
 *
 *   1.  Call the inference provider with the current message history and
 *       available tools.
 *   2.  Stream the response through `StreamParser`, emitting typed events
 *       to the caller via `onEvent`.
 *   3.  If the model requested tool calls:
 *       a.  Append the assistant's message (with `tool_calls`) to history.
 *       b.  Execute tools (parallel for independent tools, sequential for
 *           those marked dangerous).
 *       c.  Append all tool results as tool messages.
 *       d.  Go to step 1.
 *   4.  If no tool calls were made, the loop ends and returns the final
 *       message history plus aggregate token counts.
 *
 * A hard limit of `maxIterations` (default 10) prevents infinite loops.
 */

import type { ChatStreamChunk, ChatMessage } from './providers/types.js';
import { StreamParser, ParsedEvent } from './stream-parser.js';
import type { ToolDefinition, ToolResult } from '@liminal/core';
import type { ChatStreamOptions, ChatTool } from './providers/types.js';
import type { InferenceProvider } from './providers/types.js';
import { providerRegistry } from './providers/registry.js';
import { LoopDetector, RetryStrategy, checkStopConditions } from './loop-strategies.js';
import { validateToolCall, repairToolCall } from './tool-call-validator.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Extended event that carries a tool result back to the caller. */
export interface ToolCallResultEvent {
  type: 'tool_call_result';
  id: string;
  output: string;
  is_error: boolean;
}

/** All events the loop can emit. */
export type LoopEvent = ParsedEvent | ToolCallResultEvent;

export interface ToolCallLoopOptions {
  /** Model identifier (e.g. "Meta-Llama-3.1-8B-Instruct-Q4_K_M"). */
  model: string;
  /** Conversation history.  Mutated in-place during the loop. */
  messages: ChatMessage[];
  /** Tools available to the model. */
  tools: ToolDefinition[];
  /**
   * Executes a single tool call.  Receives the tool name and its arguments;
   * must resolve with a `ToolResult`.
   */
  toolExecutor: (name: string, input: Record<string, unknown>) => Promise<ToolResult>;
  /**
   * Called for every event the loop produces (token deltas, thinking deltas,
   * tool calls, tool results, done signals).
   */
  onEvent: (event: LoopEvent) => void;
  /** Maximum number of model↔tool round-trips.  Defaults to 10. */
  maxIterations?: number;
  /** Optional sampling parameters forwarded to the provider. */
  inferenceOptions?: ChatStreamOptions['options'];
  /**
   * Optional set of tool names that must be executed sequentially (not
   * concurrently with others).  Defaults to an empty set.
   */
  dangerousTools?: Set<string>;
  /**
   * Optional: explicit InferenceProvider to use instead of the active provider.
   */
  provider?: InferenceProvider;
}

export interface ToolCallLoopResult {
  /** The full message history including all assistant and tool-result turns. */
  finalMessages: ChatMessage[];
  /**
   * Approximate aggregate token usage across all iterations.
   * Summed from `prompt_eval_count` + `eval_count` fields.
   */
  totalTokens: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Represents one tool invocation collected during an assistant turn. */
interface PendingToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/**
 * Converts our internal `ToolDefinition` array to the provider wire format.
 */
function toProviderTools(defs: ToolDefinition[]): ChatTool[] {
  return defs.map((def) => ({
    type: 'function' as const,
    function: {
      name: def.name,
      description: def.description,
      parameters: def.input_schema as Record<string, unknown>,
    },
  }));
}

/**
 * Builds the tool-result messages for a single assistant turn.
 *
 * Each tool result is sent as a `role: "tool"` message whose content
 * is the result string. Multiple results produce multiple messages.
 */
function buildToolResultMessages(results: ToolResult[]): ChatMessage[] {
  return results.map((r) => ({
    role: 'tool' as const,
    content: r.output,
  }));
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

export async function runToolCallLoop(
  options: ToolCallLoopOptions,
): Promise<ToolCallLoopResult> {
  const {
    model,
    messages,
    tools,
    toolExecutor,
    onEvent,
    maxIterations = 10,
    dangerousTools = new Set<string>(),
    provider: explicitProvider,
    inferenceOptions,
  } = options;

  // Use explicit provider, or fallback to active provider from registry
  const resolvedProvider = explicitProvider ?? providerRegistry.getActive();
  const providerTools = toProviderTools(tools);

  // Strategy instances for the loop
  const loopDetector = new LoopDetector(2);
  const retryStrategy = new RetryStrategy(2);

  // We work on a mutable copy so callers can inspect the final state.
  const history: ChatMessage[] = [...messages];
  let totalTokens = 0;

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    // ── Check stop conditions ─────────────────────────────────────────────
    const stopCheck = checkStopConditions({
      iteration,
      maxIterations,
      allToolsDisabled: tools.length > 0 && tools.every((t) => retryStrategy.isDisabled(t.name)),
    });
    if (stopCheck.shouldStop) {
      console.warn(`[runToolCallLoop] Stopping: ${stopCheck.reason}`);
      break;
    }

    // Filter out disabled tools
    const activeTools = tools.filter((t) => !retryStrategy.isDisabled(t.name));
    const activeProviderTools = toProviderTools(activeTools);

    const parser = new StreamParser();
    const pendingToolCalls: PendingToolCall[] = [];

    // Accumulate the full text content the assistant emits this turn so we
    // can build the assistant history message afterwards.
    let assistantContent = '';
    let finishReason = 'stop';

    // ── 1. Stream from provider ───────────────────────────────────────────
    const streamOpts: ChatStreamOptions = {
      model,
      messages: history,
      tools: activeProviderTools.length > 0 ? activeProviderTools : undefined,
      stream: true,
      options: inferenceOptions,
    };

    for await (const chunk of resolvedProvider.chatStream(streamOpts)) {
      // Track token usage from the final chunk
      if (chunk.done) {
        const input  = chunk.prompt_eval_count ?? 0;
        const output = chunk.eval_count ?? 0;
        totalTokens += input + output;
        finishReason = chunk.done_reason ?? 'stop';
      }

      // Let the parser process the chunk into typed events
      const parsed = parser.parseChunk(chunk);

      for (const event of parsed) {
        // Accumulate text so we can reconstruct the assistant message
        if (event.type === 'token')    assistantContent += event.delta;
        if (event.type === 'thinking') { /* thinking content is not stored in history */ }

        // Collect tool calls for execution after the stream ends
        if (event.type === 'tool_call') {
          pendingToolCalls.push({ id: event.id, name: event.name, input: event.input });
        }

        // Forward every event to the caller
        onEvent(event);
      }
    }

    // ── 2. Append assistant message to history ──────────────────────────────
    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: assistantContent,
      // Carry native tool_calls if the model emitted them
      tool_calls: pendingToolCalls.length > 0
        ? pendingToolCalls.map((tc) => ({
            function: { name: tc.name, arguments: tc.input },
          }))
        : undefined,
    };
    history.push(assistantMessage);

    // ── 3. If no tool calls, we're done ────────────────────────────────────
    if (pendingToolCalls.length === 0) {
      // Update the caller's messages array in-place
      messages.splice(0, messages.length, ...history);
      return { finalMessages: history, totalTokens };
    }

    // ── 3b. Validate and repair tool calls ──────────────────────────────────
    const validatedToolCalls: PendingToolCall[] = [];
    for (const tc of pendingToolCalls) {
      // Skip disabled tools
      if (retryStrategy.isDisabled(tc.name)) {
        onEvent({
          type: 'tool_call_result',
          id: tc.id,
          output: `Tool "${tc.name}" has been disabled due to repeated failures.`,
          is_error: true,
        });
        continue;
      }

      // Loop detection
      if (loopDetector.isLoop(tc.name, tc.input)) {
        onEvent({
          type: 'tool_call_result',
          id: tc.id,
          output: `Loop detected: "${tc.name}" called with same arguments. Skipping.`,
          is_error: true,
        });
        continue;
      }

      // Validate and repair
      const repaired = repairToolCall(tc.name, tc.input, tools);
      loopDetector.record(repaired.name, repaired.input);
      validatedToolCalls.push({ id: tc.id, name: repaired.name, input: repaired.input });
    }

    if (validatedToolCalls.length === 0) {
      // All tools were filtered out — return current state
      messages.splice(0, messages.length, ...history);
      return { finalMessages: history, totalTokens };
    }

    // ── 4. Execute tools ────────────────────────────────────────────────────
    //
    // Partition into "safe" (parallelisable) and "dangerous" (sequential)
    // tool calls based on the caller-supplied `dangerousTools` set.
    const safeToolCalls    = validatedToolCalls.filter((tc) => !dangerousTools.has(tc.name));
    const dangerousCallsList = validatedToolCalls.filter((tc) =>  dangerousTools.has(tc.name));

    const results: ToolResult[] = [];

    // Run safe tools in parallel
    if (safeToolCalls.length > 0) {
      const safeResults = await Promise.all(
        safeToolCalls.map(async (tc) => {
          try {
            const result = await toolExecutor(tc.name, tc.input);
            // Ensure tool_use_id matches the tool call ID for proper correlation
            return { ...result, tool_use_id: tc.id };
          } catch (err) {
            const errorResult: ToolResult = {
              tool_use_id: tc.id,
              output: err instanceof Error ? err.message : String(err),
              is_error: true,
            };
            return errorResult;
          }
        }),
      );
      results.push(...safeResults);
    }

    // Run dangerous tools sequentially
    for (const tc of dangerousCallsList) {
      try {
        const result = await toolExecutor(tc.name, tc.input);
        // Ensure tool_use_id matches the tool call ID for proper correlation
        results.push({ ...result, tool_use_id: tc.id });
      } catch (err) {
        results.push({
          tool_use_id: tc.id,
          output: err instanceof Error ? err.message : String(err),
          is_error: true,
        });
      }
    }

    // Emit tool_call_result events for each result, in the same order as the
    // validated tool calls so the UI can correlate them.
    for (const tc of validatedToolCalls) {
      const result = results.find((r) => r.tool_use_id === tc.id)
        ?? results[validatedToolCalls.indexOf(tc)];

      if (result) {
        // Track success/failure for retry strategy
        if (result.is_error) {
          retryStrategy.recordFailure(tc.name);
        } else {
          retryStrategy.recordSuccess(tc.name);
        }

        onEvent({
          type: 'tool_call_result',
          id: tc.id,
          output: result.output,
          is_error: result.is_error,
        });
      }
    }

    // ── 5. Append tool results to history and loop ──────────────────────────
    const toolMessages = buildToolResultMessages(results);
    history.push(...toolMessages);
  }

  // Exhausted maxIterations — return whatever we have
  console.warn(
    `[runToolCallLoop] Reached maximum iterations (${maxIterations}). ` +
      'Returning current history.',
  );
  messages.splice(0, messages.length, ...history);
  return { finalMessages: history, totalTokens };
}
