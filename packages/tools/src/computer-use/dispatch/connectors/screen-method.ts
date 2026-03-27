/**
 * Screen execution method — wraps existing robotjs tools as an ExecutionMethod.
 */

import type { ExecutionMethod, AppAction, ExecutionResult } from '../dispatcher.js';

export const screenMethod: ExecutionMethod = {
  type: 'screen',
  priority: 100, // lowest priority — last resort

  async available(): Promise<boolean> {
    try {
      await import('@jitsi/robotjs');
      return true;
    } catch {
      return false;
    }
  },

  async execute(action: AppAction): Promise<ExecutionResult> {
    const start = Date.now();

    try {
      const robot = await import('@jitsi/robotjs');

      switch (action.action) {
        case 'click': {
          const x = action.params['x'] as number;
          const y = action.params['y'] as number;
          const button = (action.params['button'] as string) ?? 'left';
          robot.moveMouse(x, y);
          robot.mouseClick(button as 'left' | 'right' | 'middle');
          return { success: true, method: 'screen', output: `Clicked ${button} at (${x}, ${y})`, durationMs: Date.now() - start };
        }

        case 'type': {
          const text = action.params['text'] as string;
          if (!text) return { success: false, method: 'screen', output: 'Missing text param', durationMs: Date.now() - start };
          robot.typeString(text);
          return { success: true, method: 'screen', output: `Typed: "${text}"`, durationMs: Date.now() - start };
        }

        case 'key': {
          const key = action.params['key'] as string;
          if (!key) return { success: false, method: 'screen', output: 'Missing key param', durationMs: Date.now() - start };
          if (key.includes('+')) {
            const parts = key.split('+');
            const modifiers = parts.slice(0, -1);
            const mainKey = parts[parts.length - 1];
            robot.keyTap(mainKey, modifiers);
          } else {
            robot.keyTap(key);
          }
          return { success: true, method: 'screen', output: `Pressed key: ${key}`, durationMs: Date.now() - start };
        }

        case 'scroll': {
          const x = (action.params['x'] as number) ?? 0;
          const y = (action.params['y'] as number) ?? 0;
          const direction = (action.params['direction'] as string) ?? 'down';
          const amount = (action.params['amount'] as number) ?? 3;
          robot.moveMouse(x, y);
          robot.scrollMouse(0, direction === 'down' ? -amount : amount);
          return { success: true, method: 'screen', output: `Scrolled ${direction} at (${x}, ${y})`, durationMs: Date.now() - start };
        }

        case 'screenshot': {
          const screenshot = (await import('screenshot-desktop')).default;
          const buf = await (screenshot as (opts?: Record<string, unknown>) => Promise<Buffer>)({ format: 'png' });
          const base64 = buf.toString('base64');
          return {
            success: true,
            method: 'screen',
            output: 'Screenshot captured',
            screenshotBase64: `data:image/png;base64,${base64}`,
            durationMs: Date.now() - start,
          };
        }

        default:
          return { success: false, method: 'screen', output: `Unknown screen action: ${action.action}`, durationMs: Date.now() - start };
      }
    } catch (err) {
      return {
        success: false,
        method: 'screen',
        output: `Screen control error: ${err instanceof Error ? err.message : String(err)}`,
        durationMs: Date.now() - start,
      };
    }
  },
};
