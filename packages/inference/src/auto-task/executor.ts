/**
 * Subtask executor — dispatches individual subtasks to the appropriate handler.
 */

import type { Subtask, AutoTaskOptions } from './types.js';
import { validateCommand, runCommandWithSecurity } from './security.js';
import type { SecurityContext } from './security.js';
import { dispatchSubAgentsSync } from '../agent-dispatcher.js';
import { CoworkOrchestrator } from '../cowork/orchestrator.js';
import { agentRegistry } from '../cowork/agents.js';

function toValidAgentRole(role: string): string {
  if (agentRegistry.isValidRole(role)) return role;
  return 'researcher'; // safe fallback
}

export async function executeSubtask(
  subtask: Subtask,
  secCtx: SecurityContext,
  context: string,
  options: AutoTaskOptions,
): Promise<string> {
  const model = options.model ?? process.env['LIMINAL_DEFAULT_MODEL'] ?? 'Meta-Llama-3.1-8B-Instruct-Q4_K_M';

  const contextPrefix = context
    ? `\n\n## 이전 태스크 결과 (참고용)\n${context}\n\n---\n\n`
    : '';

  switch (subtask.type) {
    case 'web_search': {
      const query = subtask.searchQuery ?? subtask.description;
      return `Web search scheduled for: "${query}"`;
    }

    case 'code_execution': {
      const command = subtask.code ?? subtask.description;
      const validation = validateCommand(command, secCtx);
      if (!validation.allowed) {
        throw new Error(`Command blocked by security policy (L${secCtx.level}): ${validation.reason}`);
      }
      const result = await runCommandWithSecurity(command, secCtx);
      const output = result.stdout || result.stderr || `Exit code: ${result.exitCode}`;
      return output;
    }

    case 'sub_agent': {
      const tasks = (subtask.agentTasks ?? []).map((t) => ({
        role: t.role,
        prompt: `${contextPrefix}${t.prompt}`,
        model: t.model ?? model,
      }));
      if (tasks.length === 0) {
        tasks.push({ role: subtask.title, prompt: `${contextPrefix}${subtask.description}`, model });
      }
      // Build system prefix using the agent registry (supports dynamic agents)
      const systemPrefixes = tasks.map((t) => agentRegistry.getSystemPrompt(toValidAgentRole(t.role)));
      const results = await dispatchSubAgentsSync(tasks, {
        defaultModel: model,
        maxConcurrent: 3,
        systemPrefix: systemPrefixes[0],
      });
      return results
        .map((r) => `[${r.role}] (${r.status}): ${r.output}`)
        .join('\n\n---\n\n');
    }

    case 'cowork': {
      const coworkOrch = new CoworkOrchestrator();
      const agentRoles = subtask.agentTasks?.map((t) => toValidAgentRole(t.role))
        ?? ['architect', 'coder', 'reviewer'];
      const result = await coworkOrch.createSession({
        task: `${contextPrefix}${subtask.description}`,
        agents: agentRoles.map((role) => ({ role, enabled: true, model })),
        mode: subtask.coworkMode ?? 'pipeline',
      });
      return result.finalOutput ?? result.messages.map((m) => `[${m.agentRole}]: ${m.content}`).join('\n\n');
    }

    case 'tool_call':
    default: {
      const toolDesc = subtask.toolName
        ? `도구 "${subtask.toolName}" 실행 (입력: ${JSON.stringify(subtask.toolInput ?? {})})`
        : subtask.description;
      const results = await dispatchSubAgentsSync([{
        role: 'executor',
        prompt: `${contextPrefix}다음 작업을 수행하고 결과를 보고하세요:\n\n${toolDesc}`,
        model,
      }], {
        defaultModel: model,
        maxConcurrent: 1,
      });
      return results[0]?.output ?? 'No output';
    }
  }
}
