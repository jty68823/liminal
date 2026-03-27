import type { Message, ContentBlock, ToolUseBlock, ToolResultBlock } from '../types/message.js';
import type { Conversation } from '../types/project.js';

/**
 * Options that control how the context is assembled.
 */
export interface AssemblerOptions {
  /**
   * The fully-built system prompt string to prepend as the first message.
   * If omitted, no system message is added.
   */
  systemPrompt?: string;
  /**
   * When true, validates that every tool_result content block appears
   * immediately after the assistant turn that produced the matching tool_use.
   * Defaults to true.
   */
  enforceToolOrdering?: boolean;
}

/**
 * Returns true if a content block (or array thereof) contains at least one
 * tool_use block, indicating the assistant requested tool calls.
 */
function hasToolUse(content: Message['content']): boolean {
  if (typeof content === 'string') return false;
  return content.some((b) => b.type === 'tool_use');
}

/**
 * Extracts all tool_use IDs from a message's content.
 */
function extractToolUseIds(content: Message['content']): Set<string> {
  if (typeof content === 'string') return new Set();
  const ids = new Set<string>();
  for (const block of content) {
    if (block.type === 'tool_use') ids.add(block.id);
  }
  return ids;
}

/**
 * Returns true when the message carries tool results (role === 'tool' or the
 * content array contains tool_result blocks).
 */
function isToolResultMessage(msg: Message): boolean {
  if (msg.role === 'tool') return true;
  if (typeof msg.content === 'string') return false;
  return msg.content.some((b) => b.type === 'tool_result');
}

/**
 * Coerces a tool-role message into a user-role message whose content is an
 * array of tool_result blocks. This satisfies the provider API requirement
 * that tool results appear in user-role messages.
 *
 * If the content is already a structured array we pass it through; if it is a
 * plain string we wrap it in a single tool_result block.
 */
function normaliseToolMessage(msg: Message, toolUseId?: string): Message {
  let resultBlocks: ContentBlock[];

  if (typeof msg.content === 'string') {
    const block: ToolResultBlock = {
      type: 'tool_result',
      tool_use_id: toolUseId ?? msg.id,
      content: msg.content,
    };
    resultBlocks = [block];
  } else {
    // Ensure every block that is not already a tool_result is wrapped
    resultBlocks = msg.content.map((block): ContentBlock => {
      if (block.type === 'tool_result') return block;
      if (block.type === 'text') {
        const wrapped: ToolResultBlock = {
          type: 'tool_result',
          tool_use_id: toolUseId ?? msg.id,
          content: block.text,
        };
        return wrapped;
      }
      return block;
    });
  }

  return { ...msg, role: 'user', content: resultBlocks };
}

/**
 * Groups consecutive tool-result messages that follow an assistant turn
 * containing tool_use blocks into a single user message with all results.
 *
 * The inference provider API expects all tool results for a given assistant
 * turn to be batched into one user message in the same order as the
 * tool_use blocks appeared.
 */
function groupToolResults(messages: Message[]): Message[] {
  const grouped: Message[] = [];
  let i = 0;

  while (i < messages.length) {
    const msg = messages[i];

    if (msg.role === 'assistant' && hasToolUse(msg.content)) {
      grouped.push(msg);
      const toolUseIds = extractToolUseIds(msg.content);
      i++;

      // Collect all immediately following tool / user-tool-result messages
      const resultBlocks: ContentBlock[] = [];
      while (i < messages.length && isToolResultMessage(messages[i])) {
        const resultMsg = messages[i];
        const normalised = normaliseToolMessage(resultMsg);
        const blocks = Array.isArray(normalised.content)
          ? (normalised.content as ContentBlock[])
          : [];

        // Validate that each result references a known tool_use id
        for (const block of blocks) {
          if (block.type === 'tool_result') {
            if (!toolUseIds.has(block.tool_use_id)) {
              // Keep it anyway — the server-side will surface the error
            }
            resultBlocks.push(block);
          } else {
            resultBlocks.push(block);
          }
        }
        i++;
      }

      if (resultBlocks.length > 0) {
        const combinedResultMsg: Message = {
          id: `tool-results-${msg.id}`,
          role: 'user',
          content: resultBlocks,
          created_at: Date.now(),
        };
        grouped.push(combinedResultMsg);
      }
    } else {
      grouped.push(msg);
      i++;
    }
  }

  return grouped;
}

/**
 * Assembles an ordered array of messages ready to be sent to the inference
 * provider chat API.
 *
 * Steps performed:
 * 1. Optionally prepends a system message containing the fully-built system
 *    prompt.
 * 2. Filters out any raw 'system' role messages from the history (they would
 *    conflict with the prepended system turn).
 * 3. Groups tool result messages so they immediately follow the assistant turn
 *    that issued the matching tool_use blocks, batched into a single user
 *    message as required by the API.
 */
export function assembleContext(
  _conversation: Conversation,
  messages: Message[],
  options: AssemblerOptions = {},
): Message[] {
  const { systemPrompt, enforceToolOrdering = true } = options;
  const assembled: Message[] = [];

  // 1. Prepend system prompt
  if (systemPrompt) {
    const systemMessage: Message = {
      id: 'system-prompt',
      role: 'system',
      content: systemPrompt,
      created_at: Date.now(),
    };
    assembled.push(systemMessage);
  }

  // 2. Strip any system messages already in the history
  const historyMessages = messages.filter((m) => m.role !== 'system');

  // 3. Group / normalise tool call / result pairs
  const processedMessages = enforceToolOrdering
    ? groupToolResults(historyMessages)
    : historyMessages;

  assembled.push(...processedMessages);

  return assembled;
}

/**
 * Converts the internal Message array into the minimal shape expected by
 * the inference provider.
 *
 * The provider API accepts `{ role, content }` objects where content may be a
 * string or an array of blocks.
 */
export interface ProviderMessage {
  role: string;
  content: string | ContentBlock[];
  images?: string[];
}

/** @deprecated Use ProviderMessage instead. */
export type OllamaMessage = ProviderMessage;

export function toProviderMessages(messages: Message[]): ProviderMessage[] {
  return messages.map((msg) => {
    // Extract base64 image data into the top-level `images` array for
    // multimodal models, while stripping image blocks from the content array.
    if (Array.isArray(msg.content)) {
      const images: string[] = [];
      const filteredContent: ContentBlock[] = [];

      for (const block of msg.content as ContentBlock[]) {
        if (block.type === 'image') {
          if (block.source.type === 'base64') {
            images.push(block.source.data);
          }
        } else {
          filteredContent.push(block);
        }
      }

      if (images.length > 0) {
        return {
          role: msg.role,
          content: filteredContent.length === 1 && filteredContent[0].type === 'text'
            ? (filteredContent[0] as { type: 'text'; text: string }).text
            : filteredContent,
          images,
        } as ProviderMessage;
      }

      // If only one text block, unwrap to a plain string for simplicity
      if (filteredContent.length === 1 && filteredContent[0].type === 'text') {
        return {
          role: msg.role,
          content: (filteredContent[0] as { type: 'text'; text: string }).text,
        };
      }

      return { role: msg.role, content: filteredContent };
    }

    return { role: msg.role, content: msg.content };
  });
}

/** @deprecated Use toProviderMessages instead. */
export const toOllamaMessages = toProviderMessages;
