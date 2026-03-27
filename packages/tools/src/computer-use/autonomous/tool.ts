/**
 * computer_autonomous_task tool — goal-driven autonomous execution.
 * Takes a goal string, runs the observe→analyze→plan→act→verify loop,
 * and returns a summary.
 */

import type { ToolHandler } from '../../registry.js';
import { AutonomousAgent } from './agent-loop.js';

export const computerAutonomousTaskTool: ToolHandler = {
  definition: {
    name: 'computer_autonomous_task',
    description: 'Execute an autonomous computer task. Given a goal, the agent will observe the screen, analyze what it sees, plan the next action, execute it, and verify the result — repeating until the goal is achieved or max iterations reached.',
    input_schema: {
      type: 'object',
      properties: {
        goal: {
          type: 'string',
          description: 'High-level goal to achieve (e.g., "Open Chrome, go to github.com, and star the liminal repo")',
        },
        max_iterations: {
          type: 'number',
          description: 'Maximum number of observe-act cycles (default: 15)',
        },
        model: {
          type: 'string',
          description: 'Vision model to use for screen analysis (default: from env)',
        },
      },
      required: ['goal'],
    },
  },

  async execute(input: Record<string, unknown>): Promise<string> {
    const goal = input['goal'] as string;
    const maxIterations = (input['max_iterations'] as number) ?? 15;
    const model = input['model'] as string | undefined;

    const agent = new AutonomousAgent({ goal, maxIterations, model });

    try {
      const result = await agent.run();

      const lines = [
        `=== Autonomous Task ${result.success ? 'COMPLETED' : 'FAILED'} ===`,
        `Goal: ${goal}`,
        `Iterations: ${result.totalIterations}/${maxIterations}`,
        `Duration: ${(result.durationMs / 1000).toFixed(1)}s`,
        ``,
        `Summary: ${result.summary}`,
      ];

      if (result.history.length > 0) {
        lines.push('', '=== Action Log ===');
        for (const record of result.history.slice(-5)) {
          lines.push(`[${record.iteration}] ${record.action} → ${record.result.slice(0, 100)}`);
        }
      }

      return lines.join('\n');
    } catch (err) {
      return `Autonomous task error: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
};
