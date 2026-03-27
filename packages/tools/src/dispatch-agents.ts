import type { ToolHandler } from './registry.js';

export const dispatchAgentsTool: ToolHandler = {
  definition: {
    name: 'dispatch_agents',
    description: 'Dispatch multiple sub-tasks to parallel AI agents. Each agent runs independently and returns results. Use this for complex tasks that can be broken into independent parallel subtasks.',
    input_schema: {
      type: 'object',
      properties: {
        tasks: {
          type: 'array',
          description: 'Array of tasks to dispatch to sub-agents',
          items: {
            type: 'object',
            properties: {
              role: {
                type: 'string',
                description: 'Descriptive role for this agent (e.g. "code-reviewer", "researcher", "summarizer")',
              },
              prompt: {
                type: 'string',
                description: 'The task/prompt for this agent to execute',
              },
              model: {
                type: 'string',
                description: 'Optional model override for this specific agent',
              },
            },
            required: ['role', 'prompt'],
          },
        },
      },
      required: ['tasks'],
    },
  },

  async execute(input: Record<string, unknown>): Promise<string> {
    const tasks = input['tasks'] as Array<{ role: string; prompt: string; model?: string }>;

    if (!Array.isArray(tasks) || tasks.length === 0) {
      return 'Error: No tasks provided';
    }

    if (tasks.length > 5) {
      return 'Error: Maximum 5 concurrent sub-agents allowed';
    }

    try {
      // Dynamic import to avoid circular dependency with inference package
      const inferenceModule = await import('@liminal/inference') as {
        dispatchSubAgentsSync: (
          tasks: Array<{ role: string; prompt: string; model?: string }>,
          options: { defaultModel: string; maxConcurrent?: number }
        ) => Promise<Array<{ role: string; status: string; output: string; durationMs: number }>>;
      };

      const defaultModel = process.env['LIMINAL_DEFAULT_MODEL'] ?? 'Meta-Llama-3.1-8B-Instruct-Q4_K_M';

      const results = await inferenceModule.dispatchSubAgentsSync(tasks, {
        defaultModel,
        maxConcurrent: 3,
      });

      const output = results.map((r: { role: string; status: string; output: string; durationMs: number }) => {
        const statusIcon = r.status === 'success' ? '[OK]' : '[ERROR]';
        return `## ${statusIcon} Agent: ${r.role} (${r.durationMs}ms)\n${r.output}`;
      }).join('\n\n---\n\n');

      return output;
    } catch (err) {
      return `Error dispatching agents: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
};
