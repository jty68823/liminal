import type { Message } from '../types/message.js';
import { countMessageTokens, getContextLimit } from './counter.js';

/**
 * Result returned by `truncateContext`.
 */
export interface TruncationResult {
  /** The trimmed message array, ready to be sent to the API. */
  messages: Message[];
  /** Number of messages that were removed during truncation. */
  removedCount: number;
}

/**
 * Returns `true` when the token estimate for `messages` exceeds the context
 * window budget for the given model.
 *
 * A safety margin of 10 % is applied so that we start trimming before the
 * model actually runs out of space — this accounts for the imprecision of the
 * `estimateTokens` heuristic.
 *
 * @param messages       The message history to evaluate.
 * @param modelContextLength  Maximum context length (in tokens) for the model.
 *                            Pass `0` to let the function look up the limit by
 *                            model name via the `modelName` parameter.
 * @param modelName      Optional model identifier used for the look-up fallback.
 */
export function needsTruncation(
  messages: Message[],
  modelContextLength: number,
  modelName?: string,
): boolean {
  const limit =
    modelContextLength > 0
      ? modelContextLength
      : getContextLimit(modelName ?? 'default');
  const safeLimit = Math.floor(limit * 0.9);
  return countMessageTokens(messages) > safeLimit;
}

/**
 * Trims a message history so that its token estimate fits within `maxTokens`.
 *
 * Strategy
 * --------
 * 1. The first message is kept unconditionally when it has role `'system'`
 *    (it contains the system prompt and must always be sent).
 * 2. Messages are removed from the **oldest non-system** end of the array
 *    until the total token count is within the budget.
 * 3. Orphaned tool-result messages whose paired assistant `tool_use` turn was
 *    removed are also dropped to keep the conversation structurally valid.
 *
 * @param messages  Full message history (may include a leading system message).
 * @param maxTokens Token budget.  The function will not remove the system
 *                  message even if it alone exceeds this budget.
 */
export function truncateContext(messages: Message[], maxTokens: number): TruncationResult {
  if (messages.length === 0) {
    return { messages: [], removedCount: 0 };
  }

  // Separate optional system message from the rest
  const hasSystem = messages[0].role === 'system';
  const systemMessages: Message[] = hasSystem ? [messages[0]] : [];
  let conversationMessages: Message[] = hasSystem ? messages.slice(1) : [...messages];

  let removedCount = 0;

  // Remove messages from the front until we fit within the token budget
  while (conversationMessages.length > 0) {
    const current = [...systemMessages, ...conversationMessages];
    if (countMessageTokens(current) <= maxTokens) break;

    conversationMessages = conversationMessages.slice(1);
    removedCount++;
  }

  // After removing messages, drop orphaned tool-result messages at the start
  // of the remaining history. A tool-result at the very beginning means its
  // paired assistant turn was removed.
  conversationMessages = pruneOrphanedToolResults(conversationMessages, removedCount);

  return {
    messages: [...systemMessages, ...conversationMessages],
    removedCount,
  };
}

/**
 * Removes tool-result messages from the beginning of `messages` when the
 * assistant turn that issued the corresponding `tool_use` has been truncated
 * away.
 *
 * This is called after the main truncation loop and only inspects messages
 * that survived. The `removedCount` parameter is used as a fast exit — if
 * nothing was removed there can be no orphans.
 */
function pruneOrphanedToolResults(messages: Message[], removedCount: number): Message[] {
  if (removedCount === 0 || messages.length === 0) return messages;

  // Collect all tool_use IDs referenced by surviving assistant messages
  const seenToolUseIds = new Set<string>();
  for (const msg of messages) {
    if (msg.role === 'assistant' && Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (block.type === 'tool_use') {
          seenToolUseIds.add(block.id);
        }
      }
    }
  }

  // Drop leading user messages that consist solely of tool_result blocks
  // whose tool_use_id is not in the surviving set
  let start = 0;
  while (start < messages.length) {
    const msg = messages[start];
    if (!isOrphanedToolResult(msg, seenToolUseIds)) break;
    start++;
  }

  return start === 0 ? messages : messages.slice(start);
}

/**
 * Returns `true` when `msg` is a user message composed entirely of
 * `tool_result` blocks that reference tool_use IDs not present in
 * `knownToolUseIds`.
 */
function isOrphanedToolResult(msg: Message, knownToolUseIds: Set<string>): boolean {
  if (msg.role !== 'user') return false;
  if (typeof msg.content === 'string') return false;

  const blocks = msg.content;
  if (blocks.length === 0) return false;

  const allAreToolResults = blocks.every((b) => b.type === 'tool_result');
  if (!allAreToolResults) return false;

  return blocks.every(
    (b) => b.type === 'tool_result' && !knownToolUseIds.has(b.tool_use_id),
  );
}

/**
 * Convenience wrapper that checks whether truncation is needed and applies it
 * when necessary.
 *
 * @param messages    Full message history.
 * @param modelName   Model identifier (used to look up context limit).
 * @param overrideMax Optional explicit token budget that overrides the looked-up limit.
 */
export function maybetruncateContext(
  messages: Message[],
  modelName: string,
  overrideMax?: number,
): TruncationResult {
  const limit = overrideMax ?? getContextLimit(modelName);
  const maxTokens = Math.floor(limit * 0.9);

  if (!needsTruncation(messages, limit, modelName)) {
    return { messages, removedCount: 0 };
  }

  return truncateContext(messages, maxTokens);
}
