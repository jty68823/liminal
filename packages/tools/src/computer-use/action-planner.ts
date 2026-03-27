/**
 * Action planner — converts high-level goals into sequences of
 * computer use actions (click, type, scroll, etc.).
 */

import type { ToolHandler } from '../registry.js';

export interface PlannedAction {
  type: 'click' | 'type' | 'key' | 'scroll' | 'wait' | 'screenshot';
  target?: string;
  value?: string;
  x?: number;
  y?: number;
  delay?: number;
}

export const actionPlannerTool: ToolHandler = {
  definition: {
    name: 'computer_plan',
    description: 'Plan a sequence of computer actions to achieve a goal. Returns a step-by-step action plan. Does NOT execute the actions — use individual computer_* tools to execute.',
    input_schema: {
      type: 'object',
      properties: {
        goal: {
          type: 'string',
          description: 'High-level goal to achieve (e.g., "Open Chrome and navigate to google.com")',
        },
        context: {
          type: 'string',
          description: 'Optional context about current screen state',
        },
      },
      required: ['goal'],
    },
  },

  async execute(input: Record<string, unknown>): Promise<string> {
    const goal = input['goal'] as string;
    const context = (input['context'] as string) ?? '';

    // Use the LLM via the active provider to plan actions
    const model = process.env['LIMINAL_DEFAULT_MODEL'] ?? 'Meta-Llama-3.1-8B-Instruct-Q4_K_M';

    const planPrompt = `You are a computer automation planner. Given a goal, output a JSON array of actions.

Available action types:
- {"type": "click", "x": number, "y": number} — click at coordinates
- {"type": "type", "value": "text"} — type text
- {"type": "key", "value": "key_name"} — press key (enter, tab, escape, ctrl+c, etc.)
- {"type": "scroll", "value": "up|down", "x": number, "y": number} — scroll
- {"type": "wait", "delay": number} — wait milliseconds
- {"type": "screenshot"} — take screenshot to verify

Goal: ${goal}
${context ? `Current context: ${context}` : ''}

Output ONLY the JSON array of actions, no explanation:`;

    try {
      const { providerRegistry } = await import('@liminal/inference') as {
        providerRegistry: { getActive(): { chat(opts: { model: string; messages: Array<{ role: string; content: string }>; stream?: boolean }): Promise<{ message: { content: string } }> } };
      };

      const provider = providerRegistry.getActive();
      const result = await provider.chat({
        model,
        messages: [{ role: 'user', content: planPrompt }],
        stream: false,
      });

      const content = result.message?.content ?? '';

      // Try to extract JSON array from response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const actions = JSON.parse(jsonMatch[0]) as PlannedAction[];
        const formatted = actions.map((a, i) => {
          switch (a.type) {
            case 'click': return `${i + 1}. Click at (${a.x}, ${a.y})`;
            case 'type': return `${i + 1}. Type: "${a.value}"`;
            case 'key': return `${i + 1}. Press: ${a.value}`;
            case 'scroll': return `${i + 1}. Scroll ${a.value}`;
            case 'wait': return `${i + 1}. Wait ${a.delay}ms`;
            case 'screenshot': return `${i + 1}. Take screenshot`;
            default: return `${i + 1}. Unknown action`;
          }
        }).join('\n');

        return `Action Plan for: ${goal}\n\n${formatted}\n\nRaw JSON:\n${JSON.stringify(actions, null, 2)}`;
      }

      return `Could not generate a structured plan. Raw response:\n${content}`;
    } catch (err) {
      return `Planning error: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
};
