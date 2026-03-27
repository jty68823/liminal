/**
 * Browser execution method — wraps Playwright browser manager as an ExecutionMethod.
 */

import type { ExecutionMethod, AppAction, ExecutionResult } from '../dispatcher.js';

export const browserMethod: ExecutionMethod = {
  type: 'browser',
  priority: 50,

  async available(): Promise<boolean> {
    try {
      const { browserManager } = await import('../../browser/manager.js');
      return browserManager.isAvailable();
    } catch {
      return false;
    }
  },

  async execute(action: AppAction): Promise<ExecutionResult> {
    const start = Date.now();

    try {
      const { browserManager } = await import('../../browser/manager.js');
      const page = await browserManager.getPage();

      // Route based on action type
      switch (action.action) {
        case 'navigate': {
          const url = action.params['url'] as string;
          if (!url) return { success: false, method: 'browser', output: 'Missing url param', durationMs: Date.now() - start };
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
          return { success: true, method: 'browser', output: `Navigated to ${url}`, durationMs: Date.now() - start };
        }

        case 'click': {
          const selector = action.params['selector'] as string;
          if (!selector) return { success: false, method: 'browser', output: 'Missing selector param', durationMs: Date.now() - start };
          await page.click(selector, { timeout: 10_000 });
          return { success: true, method: 'browser', output: `Clicked ${selector}`, durationMs: Date.now() - start };
        }

        case 'type': {
          const selector = action.params['selector'] as string;
          const text = action.params['text'] as string;
          if (!selector || !text) return { success: false, method: 'browser', output: 'Missing selector or text', durationMs: Date.now() - start };
          await page.fill(selector, text);
          return { success: true, method: 'browser', output: `Typed "${text}" into ${selector}`, durationMs: Date.now() - start };
        }

        case 'extract': {
          const selector = (action.params['selector'] as string) ?? 'body';
          const content = await page.textContent(selector, { timeout: 10_000 });
          return { success: true, method: 'browser', output: content ?? '', durationMs: Date.now() - start };
        }

        case 'screenshot': {
          const buf = await page.screenshot({ type: 'png' });
          const base64 = buf.toString('base64');
          return {
            success: true,
            method: 'browser',
            output: 'Screenshot captured',
            screenshotBase64: `data:image/png;base64,${base64}`,
            durationMs: Date.now() - start,
          };
        }

        default:
          return { success: false, method: 'browser', output: `Unknown browser action: ${action.action}`, durationMs: Date.now() - start };
      }
    } catch (err) {
      return {
        success: false,
        method: 'browser',
        output: `Browser error: ${err instanceof Error ? err.message : String(err)}`,
        durationMs: Date.now() - start,
      };
    }
  },
};
