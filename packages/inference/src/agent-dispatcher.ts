/**
 * Sub-Agent Dispatch System
 *
 * Allows the main LLM to delegate tasks to parallel sub-agents,
 * each running independent inference via the active provider.
 */

import { providerRegistry } from './providers/registry.js';
import type { ChatMessage } from './providers/types.js';

export interface SubAgentTask {
  /** Descriptive role for this sub-agent (e.g. "code-reviewer", "researcher") */
  role: string;
  /** The prompt/task to execute */
  prompt: string;
  /** Optional model override (defaults to parent model) */
  model?: string;
}

export interface SubAgentResult {
  role: string;
  status: 'success' | 'error';
  output: string;
  durationMs: number;
}

export interface SubAgentEvent {
  type: 'sub_agent_start' | 'sub_agent_result';
  role: string;
  result?: SubAgentResult;
}

export interface DispatchOptions {
  /** Default model to use when task doesn't specify one */
  defaultModel: string;
  /** Maximum concurrent agents (default: 3) */
  maxConcurrent?: number;
  /** System prompt prefix for sub-agents */
  systemPrefix?: string;
}

/**
 * Dispatches multiple sub-agent tasks in parallel and yields events
 * as each agent starts and completes.
 */
export async function* dispatchSubAgents(
  tasks: SubAgentTask[],
  options: DispatchOptions,
): AsyncGenerator<SubAgentEvent> {
  const {
    defaultModel,
    maxConcurrent = 3,
    systemPrefix = 'You are a specialized sub-agent. Complete the given task concisely and accurately.',
  } = options;

  const provider = providerRegistry.getActive();

  // Emit start events for all tasks
  for (const task of tasks) {
    yield { type: 'sub_agent_start', role: task.role };
  }

  // Process in batches of maxConcurrent
  for (let i = 0; i < tasks.length; i += maxConcurrent) {
    const batch = tasks.slice(i, i + maxConcurrent);

    const batchResults = await Promise.allSettled(
      batch.map(async (task): Promise<SubAgentResult> => {
        const startTime = Date.now();
        const model = task.model ?? defaultModel;

        const messages: ChatMessage[] = [
          { role: 'system', content: `${systemPrefix}\n\nYour role: ${task.role}` },
          { role: 'user', content: task.prompt },
        ];

        try {
          const response = await provider.chat({
            model,
            messages,
            stream: false,
          });

          return {
            role: task.role,
            status: 'success',
            output: response.message.content,
            durationMs: Date.now() - startTime,
          };
        } catch (err) {
          return {
            role: task.role,
            status: 'error',
            output: err instanceof Error ? err.message : String(err),
            durationMs: Date.now() - startTime,
          };
        }
      }),
    );

    // Yield results as they complete
    for (let j = 0; j < batchResults.length; j++) {
      const settled = batchResults[j];
      const result: SubAgentResult = settled.status === 'fulfilled'
        ? settled.value
        : {
            role: batch[j].role,
            status: 'error',
            output: settled.reason instanceof Error ? settled.reason.message : String(settled.reason),
            durationMs: 0,
          };

      yield { type: 'sub_agent_result', role: result.role, result };
    }
  }
}

/**
 * Simple synchronous dispatch that returns all results at once.
 * Useful for tool execution context.
 */
export async function dispatchSubAgentsSync(
  tasks: SubAgentTask[],
  options: DispatchOptions,
): Promise<SubAgentResult[]> {
  const results: SubAgentResult[] = [];
  for await (const event of dispatchSubAgents(tasks, options)) {
    if (event.type === 'sub_agent_result' && event.result) {
      results.push(event.result);
    }
  }
  return results;
}
