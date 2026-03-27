/**
 * Dispatch service — orchestrates task execution.
 * Creates a conversation, runs chat, and forwards events to WebSocket clients.
 */

import {
  createDispatchTask,
  getDispatchTask,
  updateDispatchTask,
  appendDispatchEvent,
  type DispatchTask,
} from '@liminal/db';
import { runChat, type ChatServiceCallbacks } from './chat.service.js';
import { wsManager } from '../lib/ws-manager.js';
import { notifyTaskComplete } from './push.service.js';

export interface DispatchRequest {
  instruction: string;
  source?: string;
  model?: string;
}

/**
 * Create and execute a dispatch task.
 * The task runs asynchronously — returns the task ID immediately.
 */
export function dispatchTask(request: DispatchRequest): DispatchTask {
  const task = createDispatchTask({
    instruction: request.instruction,
    source: request.source,
    model: request.model,
  });

  // Run the task asynchronously
  executeTask(task.id).catch((err) => {
    console.error(`[dispatch] Fatal error for task ${task.id}:`, err);
    updateDispatchTask(task.id, {
      status: 'failed',
      errorMessage: err instanceof Error ? err.message : String(err),
      completedAt: Date.now(),
    });
  });

  return task;
}

async function executeTask(taskId: string): Promise<void> {
  const task = getDispatchTask(taskId);
  if (!task) return;

  updateDispatchTask(taskId, { status: 'running' });
  wsManager.broadcastToTask(taskId, { type: 'task_progress', taskId, status: 'running', progress: 0 });

  let fullText = '';

  const callbacks: ChatServiceCallbacks = {
    onToken: async (delta) => {
      fullText += delta;
      wsManager.broadcastToTask(taskId, { type: 'task_token', taskId, delta });

      // Update progress estimate based on token count
      const progress = Math.min(90, Math.floor(fullText.length / 20));
      updateDispatchTask(taskId, { progress });
    },

    onThinking: async (delta) => {
      wsManager.broadcastToTask(taskId, { type: 'task_thinking', taskId, delta });
    },

    onToolCallStart: async (id, name, input) => {
      wsManager.broadcastToTask(taskId, { type: 'task_tool_call', taskId, toolCallId: id, name, input });
      appendDispatchEvent({ taskId, type: 'tool_call_start', payload: JSON.stringify({ id, name, input }) });
    },

    onToolCallResult: async (id, output, isError) => {
      wsManager.broadcastToTask(taskId, { type: 'task_tool_result', taskId, toolCallId: id, output: output.slice(0, 500), isError });
      appendDispatchEvent({ taskId, type: 'tool_call_result', payload: JSON.stringify({ id, output: output.slice(0, 1000), isError }) });
    },

    onDone: async (conversationId, _userMessageId, _assistantMessageId, _tokensIn, _tokensOut) => {
      updateDispatchTask(taskId, {
        status: 'completed',
        result: fullText,
        progress: 100,
        conversationId,
        completedAt: Date.now(),
      });

      wsManager.broadcastToTask(taskId, {
        type: 'task_complete',
        taskId,
        result: fullText,
        conversationId,
      });

      appendDispatchEvent({ taskId, type: 'task_complete', payload: JSON.stringify({ result: fullText.slice(0, 2000) }) });

      // Send push notification (fire and forget)
      notifyTaskComplete(taskId, task.instruction, true).catch(() => {});
    },

    onError: async (message) => {
      updateDispatchTask(taskId, {
        status: 'failed',
        errorMessage: message,
        completedAt: Date.now(),
      });

      wsManager.broadcastToTask(taskId, { type: 'task_error', taskId, error: message });
      appendDispatchEvent({ taskId, type: 'task_error', payload: JSON.stringify({ error: message }) });

      notifyTaskComplete(taskId, task.instruction, false).catch(() => {});
    },
  };

  await runChat(
    {
      content: task.instruction,
      modelOverride: task.model ?? undefined,
    },
    callbacks,
  );
}

/**
 * Cancel a running task.
 */
export function cancelDispatchTask(taskId: string): boolean {
  const task = getDispatchTask(taskId);
  if (!task || task.status !== 'running') return false;

  updateDispatchTask(taskId, {
    status: 'cancelled',
    completedAt: Date.now(),
  });

  wsManager.broadcastToTask(taskId, { type: 'task_cancelled', taskId });
  return true;
}
