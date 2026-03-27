/**
 * Goal parser — uses LLM to decompose a high-level goal into sub-goals
 * and determine success criteria.
 */

export interface SubGoal {
  description: string;
  verificationPrompt: string;
}

export interface ParsedGoal {
  mainGoal: string;
  subGoals: SubGoal[];
  successCriteria: string;
}

export async function parseGoal(goal: string): Promise<ParsedGoal> {
  try {
    const { providerRegistry } = await import('@liminal/inference');
    const provider = providerRegistry.getActive();
    const model = process.env['LIMINAL_DEFAULT_MODEL'] ?? 'Meta-Llama-3.1-8B-Instruct-Q4_K_M';

    const prompt = `You are a computer automation planner. Break this goal into concrete sub-goals.

Goal: ${goal}

Reply with ONLY a JSON object in this exact format:
{
  "mainGoal": "restatement of goal",
  "subGoals": [
    {"description": "step description", "verificationPrompt": "what to look for on screen to verify this step is done"}
  ],
  "successCriteria": "how to know the overall goal is achieved"
}`;

    const result = await provider.chat({
      model,
      messages: [{ role: 'user', content: prompt }],
      options: { num_predict: 512, temperature: 0.3 },
    });

    const content = result.message?.content ?? '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as ParsedGoal;
    }
  } catch { /* fall through to default */ }

  // Fallback: single-step goal
  return {
    mainGoal: goal,
    subGoals: [{ description: goal, verificationPrompt: `Has "${goal}" been completed?` }],
    successCriteria: `The goal "${goal}" has been achieved`,
  };
}
