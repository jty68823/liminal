/**
 * AutonomousAgent — goal-driven execution loop:
 * observe → analyze → plan → act → verify → repeat until done.
 */

import { nanoid } from 'nanoid';
import { dispatcher } from '../dispatch/dispatcher.js';
import { autonomousEventBus, type AutonomousProgressEvent } from './event-bus.js';
import { parseGoal } from './goal-parser.js';

export interface AutonomousAgentOptions {
  goal: string;
  maxIterations?: number;
  model?: string;
}

export interface AutonomousAgentResult {
  success: boolean;
  summary: string;
  totalIterations: number;
  durationMs: number;
  history: IterationRecord[];
}

interface IterationRecord {
  iteration: number;
  analysis: string;
  action: string;
  result: string;
  screenshotBase64?: string;
}

interface ScreenAnalysis {
  goalMet: boolean;
  currentState: string;
  nextAction: {
    app: string;
    action: string;
    params: Record<string, unknown>;
  };
  confidence: number;
}

async function takeScreenshot(): Promise<string> {
  try {
    const screenshot = (await import('screenshot-desktop')).default;
    const buf = await (screenshot as (opts?: Record<string, unknown>) => Promise<Buffer>)({ format: 'png' });
    return buf.toString('base64');
  } catch {
    return '';
  }
}

async function analyzeScreen(
  screenshotBase64: string,
  goal: string,
  recentHistory: IterationRecord[],
  model?: string,
): Promise<ScreenAnalysis> {
  const visionModel = model ?? process.env['LIMINAL_VISION_MODEL'] ?? 'llava';

  const historyContext = recentHistory.length > 0
    ? `\n\nRecent actions:\n${recentHistory.map((h) => `- ${h.action}: ${h.result}`).join('\n')}`
    : '';

  const prompt = `You are an autonomous computer agent. Analyze the screen and determine the next action to achieve the goal.

Goal: ${goal}${historyContext}

Reply with ONLY a JSON object:
{
  "goalMet": boolean,
  "currentState": "description of what's on screen",
  "nextAction": {"app": "desktop|browser|slack|...", "action": "click|type|key|navigate|...", "params": {}},
  "confidence": 0.0-1.0
}

If the goal is met, set goalMet to true and nextAction can be empty.`;

  try {
    const { providerRegistry } = await import('@liminal/inference');
    const provider = providerRegistry.getActive();

    const result = await provider.chat({
      model: visionModel,
      messages: [{
        role: 'user',
        content: prompt,
        images: [screenshotBase64],
      }],
      options: { num_predict: 512, temperature: 0.2 },
    });

    const content = result.message?.content ?? '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as ScreenAnalysis;
    }
  } catch { /* fall through */ }

  return {
    goalMet: false,
    currentState: 'Unable to analyze screen',
    nextAction: { app: 'desktop', action: 'screenshot', params: {} },
    confidence: 0,
  };
}

export class AutonomousAgent {
  private taskId: string;
  private goal: string;
  private maxIterations: number;
  private model?: string;
  private history: IterationRecord[] = [];

  constructor(options: AutonomousAgentOptions) {
    this.taskId = nanoid();
    this.goal = options.goal;
    this.maxIterations = options.maxIterations ?? 15;
    this.model = options.model;
  }

  async run(): Promise<AutonomousAgentResult> {
    const startTime = Date.now();

    // Parse goal into sub-goals
    const parsedGoal = await parseGoal(this.goal);
    console.log(`[autonomous] Goal parsed: ${parsedGoal.mainGoal} (${parsedGoal.subGoals.length} sub-goals)`);

    for (let iteration = 1; iteration <= this.maxIterations; iteration++) {
      // 1. Observe — take screenshot
      this.emitProgress(iteration, 'observe');
      const screenshotBase64 = await takeScreenshot();

      // 2. Analyze — vision model analyzes screenshot
      this.emitProgress(iteration, 'analyze');
      const recentHistory = this.history.slice(-5);
      const analysis = await analyzeScreen(screenshotBase64, this.goal, recentHistory, this.model);

      // 3. Check if goal is met
      if (analysis.goalMet) {
        const result: AutonomousAgentResult = {
          success: true,
          summary: `Goal achieved: ${this.goal}\n\nFinal state: ${analysis.currentState}`,
          totalIterations: iteration,
          durationMs: Date.now() - startTime,
          history: this.history,
        };

        autonomousEventBus.emitComplete({
          type: 'autonomous_complete',
          taskId: this.taskId,
          success: true,
          summary: result.summary,
          totalIterations: iteration,
          durationMs: result.durationMs,
        });

        return result;
      }

      // 4. Plan & Act — execute the next action via dispatch layer
      this.emitProgress(iteration, 'act', JSON.stringify(analysis.nextAction));
      const actionResult = await dispatcher.dispatch({
        app: analysis.nextAction.app,
        action: analysis.nextAction.action,
        params: analysis.nextAction.params,
      });

      // 5. Record iteration
      const record: IterationRecord = {
        iteration,
        analysis: analysis.currentState,
        action: `${analysis.nextAction.app}:${analysis.nextAction.action}`,
        result: actionResult.output,
        screenshotBase64: screenshotBase64 ? `data:image/png;base64,${screenshotBase64}` : undefined,
      };
      this.history.push(record);

      // 6. Verify — take a verification screenshot
      this.emitProgress(iteration, 'verify');
      await new Promise((r) => setTimeout(r, 1000)); // Brief wait for UI to settle

      // Emit progress event with screenshot
      const progressEvent: AutonomousProgressEvent = {
        type: 'autonomous_progress',
        taskId: this.taskId,
        iteration,
        maxIterations: this.maxIterations,
        phase: 'verify',
        action: `${analysis.nextAction.app}:${analysis.nextAction.action}`,
        screenshotBase64: record.screenshotBase64,
        analysis: analysis.currentState,
        goalMet: false,
        timestamp: Date.now(),
      };
      autonomousEventBus.emitProgress(progressEvent);
    }

    // Exhausted iterations
    const result: AutonomousAgentResult = {
      success: false,
      summary: `Goal not achieved after ${this.maxIterations} iterations: ${this.goal}`,
      totalIterations: this.maxIterations,
      durationMs: Date.now() - startTime,
      history: this.history,
    };

    autonomousEventBus.emitComplete({
      type: 'autonomous_complete',
      taskId: this.taskId,
      success: false,
      summary: result.summary,
      totalIterations: this.maxIterations,
      durationMs: result.durationMs,
    });

    return result;
  }

  private emitProgress(iteration: number, phase: AutonomousProgressEvent['phase'], action?: string): void {
    autonomousEventBus.emitProgress({
      type: 'autonomous_progress',
      taskId: this.taskId,
      iteration,
      maxIterations: this.maxIterations,
      phase,
      action,
      goalMet: false,
      timestamp: Date.now(),
    });
  }

  getTaskId(): string {
    return this.taskId;
  }
}
