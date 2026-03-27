import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import { runChat } from '../services/chat.service.js';
import { detectAndSaveArtifacts } from '../services/artifact.service.js';
import { TokenStreamBuffer } from '../lib/stream-buffer.js';

export const messagesRouter = new Hono();

const SendMessageSchema = z.object({
  conversation_id: z.string().optional(),
  project_id: z.string().optional(),
  content: z.string().min(1, 'Message content cannot be empty'),
  model_override: z.string().optional(),
  images: z.array(z.string()).optional(),
});

/**
 * POST /api/v1/messages
 *
 * Sends a user message and streams the assistant response as Server-Sent Events.
 *
 * Request body:
 *   {
 *     conversation_id?: string   // omit to auto-create a new conversation
 *     project_id?: string
 *     content: string            // user message text
 *     model_override?: string    // e.g. "qwen2.5-coder:7b"
 *   }
 *
 * SSE event types:
 *   { type: "token",            delta: string }
 *   { type: "thinking",         delta: string }
 *   { type: "tool_call_start",  id: string, name: string, input: object }
 *   { type: "tool_call_result", id: string, output: string, is_error: boolean }
 *   { type: "artifact",         id: string, action: "create", artifact: object }
 *   { type: "done",             message_id: string, conversation_id: string }
 *   { type: "error",            message: string }
 */
messagesRouter.post('/', async (c) => {
  // Parse and validate request body
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const parseResult = SendMessageSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json(
      { error: 'Validation failed', details: parseResult.error.flatten() },
      400,
    );
  }

  const { conversation_id, project_id, content, model_override, images } = parseResult.data;

  return streamSSE(c, async (stream) => {
    // Abort controller so we can stop the LLM loop if the client disconnects
    const abortController = new AbortController();

    // Hono SSE streams have an onAbort hook
    stream.onAbort(() => {
      abortController.abort();
      // Close the token buffer to stop any pending flush timers
      tokenBuffer.close().catch(() => {});
    });

    // Track the full assistant text so we can run artifact detection post-loop
    let fullAssistantText = '';
    let finalConversationId = conversation_id ?? '';
    let finalAssistantMessageId = '';

    // Buffer token deltas: batch every 30ms or 200 chars to reduce SSE frame overhead
    const tokenBuffer = new TokenStreamBuffer(
      async (batchedText) => {
        await stream.writeSSE({ event: 'token', data: JSON.stringify({ type: 'token', delta: batchedText }) });
      },
      { flushIntervalMs: 30, maxBufferSize: 200 },
    );

    try {
      console.log('[messages] Starting runChat...');
      await runChat(
      {
        conversationId: conversation_id,
        projectId: project_id,
        content,
        modelOverride: model_override,
        images,
      },
      {
        signal: abortController.signal,

        onToken: async (delta) => {
          fullAssistantText += delta;
          tokenBuffer.push(delta);
        },

        onThinking: async (delta) => {
          await stream.writeSSE({
            event: 'thinking',
            data: JSON.stringify({ type: 'thinking', delta }),
          });
        },

        onToolCallStart: async (id, name, input) => {
          await stream.writeSSE({
            event: 'tool_call_start',
            data: JSON.stringify({ type: 'tool_call_start', id, name, input }),
          });
        },

        onToolCallResult: async (id, output, isError) => {
          await stream.writeSSE({
            event: 'tool_call_result',
            data: JSON.stringify({
              type: 'tool_call_result',
              id,
              output,
              is_error: isError,
            }),
          });
        },

        onDone: async (conversationId, userMessageId, assistantMessageId, _tokensIn, _tokensOut) => {
          // Flush any buffered tokens before sending done event
          await tokenBuffer.close();
          finalConversationId = conversationId;
          finalAssistantMessageId = assistantMessageId;

          // Detect and save artifacts from the completed assistant response
          if (fullAssistantText && assistantMessageId) {
            try {
              const detectedArtifacts = detectAndSaveArtifacts(
                fullAssistantText,
                conversationId,
                assistantMessageId,
              );

              for (const artifact of detectedArtifacts) {
                await stream.writeSSE({
                  event: 'artifact',
                  data: JSON.stringify({
                    type: 'artifact',
                    id: artifact.id,
                    action: 'create',
                    artifact: {
                      id: artifact.id,
                      type: artifact.type,
                      language: artifact.language ?? null,
                      title: artifact.title ?? null,
                      content: artifact.content,
                      version: artifact.version,
                      conversation_id: artifact.conversationId,
                      message_id: artifact.messageId ?? null,
                      created_at: artifact.createdAt,
                      updated_at: artifact.updatedAt,
                    },
                  }),
                });
              }
            } catch (artifactErr) {
              // Artifact detection failure is non-fatal — log and continue
              console.error('[messages] Artifact detection error:', artifactErr);
            }
          }

          await stream.writeSSE({
            event: 'done',
            data: JSON.stringify({
              type: 'done',
              message_id: assistantMessageId,
              user_message_id: userMessageId,
              assistant_message_id: assistantMessageId,
              conversation_id: conversationId,
            }),
          });
        },

        onError: async (message) => {
          await stream.writeSSE({
            event: 'error',
            data: JSON.stringify({ type: 'error', message }),
          });
        },
      },
    );
    } catch (fatalErr) {
      const msg = fatalErr instanceof Error ? fatalErr.message : String(fatalErr);
      console.error('[messages] Fatal error in stream:', msg, fatalErr);
      await stream.writeSSE({
        event: 'error',
        data: JSON.stringify({ type: 'error', message: `Fatal: ${msg}` }),
      });
    }
    console.log('[messages] streamSSE handler complete');
  });
});
