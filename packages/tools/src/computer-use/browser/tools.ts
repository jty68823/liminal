/**
 * Browser automation tools — 6 ToolHandlers for Playwright-based browser control.
 */

import type { ToolHandler } from '../../registry.js';
import { browserManager } from './manager.js';
import { analyzeDom } from './dom-analyzer.js';

function notAvailableError(): string {
  return 'Error: Playwright is not installed. Run: pnpm --filter @liminal/tools add playwright';
}

export const browserNavigateTool: ToolHandler = {
  definition: {
    name: 'browser_navigate',
    description: 'Navigate the browser to a URL. Opens a persistent Chromium instance.',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to navigate to' },
        wait_until: { type: 'string', enum: ['load', 'domcontentloaded', 'networkidle'], description: 'When to consider navigation complete' },
      },
      required: ['url'],
    },
  },
  async execute(input) {
    try {
      const page = await browserManager.getPage();
      const url = input['url'] as string;
      const waitUntil = (input['wait_until'] as 'load' | 'domcontentloaded' | 'networkidle') ?? 'domcontentloaded';
      await page.goto(url, { waitUntil, timeout: 30_000 });
      const snapshot = await analyzeDom(page);
      return `Navigated to ${url}\n\n${snapshot.summary}`;
    } catch (err) {
      if (String(err).includes('Cannot find module')) return notAvailableError();
      return `Browser navigate error: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
};

export const browserClickTool: ToolHandler = {
  definition: {
    name: 'browser_click',
    description: 'Click an element in the browser by CSS selector or element index from DOM analysis.',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector of the element to click' },
        index: { type: 'number', description: 'Element index from browser_extract DOM analysis (alternative to selector)' },
      },
      required: [],
    },
  },
  async execute(input) {
    try {
      const page = await browserManager.getPage();
      const selector = input['selector'] as string | undefined;
      const index = input['index'] as number | undefined;

      if (selector) {
        await page.click(selector, { timeout: 10_000 });
        await page.waitForTimeout(500);
        return `Clicked: ${selector}`;
      }

      if (index !== undefined) {
        const snapshot = await analyzeDom(page);
        const element = snapshot.elements[index];
        if (!element) return `Element index ${index} not found. Total elements: ${snapshot.elements.length}`;
        await page.click(element.selector, { timeout: 10_000 });
        await page.waitForTimeout(500);
        return `Clicked element [${index}]: <${element.tag}> "${element.text}"`;
      }

      return 'Error: Provide either selector or index parameter';
    } catch (err) {
      if (String(err).includes('Cannot find module')) return notAvailableError();
      return `Browser click error: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
};

export const browserTypeTool: ToolHandler = {
  definition: {
    name: 'browser_type',
    description: 'Type text into a form field in the browser.',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector of the input/textarea' },
        text: { type: 'string', description: 'Text to type' },
        clear: { type: 'boolean', description: 'Clear the field before typing (default: true)' },
        press_enter: { type: 'boolean', description: 'Press Enter after typing' },
      },
      required: ['selector', 'text'],
    },
  },
  async execute(input) {
    try {
      const page = await browserManager.getPage();
      const selector = input['selector'] as string;
      const text = input['text'] as string;
      const clear = (input['clear'] as boolean) ?? true;
      const pressEnter = (input['press_enter'] as boolean) ?? false;

      if (clear) {
        await page.fill(selector, text);
      } else {
        await page.click(selector);
        await page.keyboard.type(text);
      }

      if (pressEnter) {
        await page.keyboard.press('Enter');
      }

      return `Typed "${text}" into ${selector}${pressEnter ? ' and pressed Enter' : ''}`;
    } catch (err) {
      if (String(err).includes('Cannot find module')) return notAvailableError();
      return `Browser type error: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
};

export const browserExtractTool: ToolHandler = {
  definition: {
    name: 'browser_extract',
    description: 'Extract page content, DOM structure, or interactive elements from the current page.',
    input_schema: {
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          enum: ['text', 'html', 'interactive', 'full'],
          description: 'Extraction mode: text (page text), html (raw HTML), interactive (clickable elements map), full (text + interactive)',
        },
        selector: { type: 'string', description: 'CSS selector to scope extraction (default: full page)' },
      },
      required: [],
    },
  },
  async execute(input) {
    try {
      const page = await browserManager.getPage();
      const mode = (input['mode'] as string) ?? 'interactive';
      const selector = (input['selector'] as string) ?? 'body';

      switch (mode) {
        case 'text': {
          const text = await page.textContent(selector, { timeout: 10_000 });
          return text ?? 'No text content found';
        }

        case 'html': {
          const html = await page.innerHTML(selector, { timeout: 10_000 });
          // Truncate to avoid overwhelming the LLM
          return html.length > 5000 ? html.slice(0, 5000) + '\n... (truncated)' : html;
        }

        case 'interactive': {
          const snapshot = await analyzeDom(page);
          return snapshot.summary;
        }

        case 'full': {
          const text = await page.textContent(selector, { timeout: 10_000 });
          const snapshot = await analyzeDom(page);
          return `=== Page Text ===\n${(text ?? '').slice(0, 3000)}\n\n=== Interactive Elements ===\n${snapshot.summary}`;
        }

        default:
          return `Unknown mode: ${mode}`;
      }
    } catch (err) {
      if (String(err).includes('Cannot find module')) return notAvailableError();
      return `Browser extract error: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
};

export const browserScreenshotTool: ToolHandler = {
  definition: {
    name: 'browser_screenshot',
    description: 'Take a screenshot of the current browser page.',
    input_schema: {
      type: 'object',
      properties: {
        full_page: { type: 'boolean', description: 'Capture full scrollable page (default: false — viewport only)' },
        selector: { type: 'string', description: 'CSS selector to screenshot a specific element' },
      },
      required: [],
    },
  },
  async execute(input) {
    try {
      const page = await browserManager.getPage();
      const fullPage = (input['full_page'] as boolean) ?? false;
      const selector = input['selector'] as string | undefined;

      let buf: Buffer;
      if (selector) {
        const element = await page.locator(selector).first();
        buf = await element.screenshot({ type: 'png' });
      } else {
        buf = await page.screenshot({ type: 'png', fullPage });
      }

      return `data:image/png;base64,${buf.toString('base64')}`;
    } catch (err) {
      if (String(err).includes('Cannot find module')) return notAvailableError();
      return `Browser screenshot error: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
};

export const browserWaitTool: ToolHandler = {
  definition: {
    name: 'browser_wait',
    description: 'Wait for an element, navigation, or timeout in the browser.',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector to wait for' },
        state: { type: 'string', enum: ['visible', 'hidden', 'attached', 'detached'], description: 'Element state to wait for' },
        timeout: { type: 'number', description: 'Max wait time in ms (default: 10000)' },
        url: { type: 'string', description: 'Wait for navigation to URL containing this string' },
      },
      required: [],
    },
  },
  async execute(input) {
    try {
      const page = await browserManager.getPage();
      const selector = input['selector'] as string | undefined;
      const state = (input['state'] as 'visible' | 'hidden' | 'attached' | 'detached') ?? 'visible';
      const timeout = (input['timeout'] as number) ?? 10_000;
      const url = input['url'] as string | undefined;

      if (url) {
        await page.waitForURL(`**${url}**`, { timeout });
        return `Navigation complete: ${page.url()}`;
      }

      if (selector) {
        await page.waitForSelector(selector, { state, timeout });
        return `Element ${selector} is ${state}`;
      }

      // Plain timeout
      await page.waitForTimeout(timeout);
      return `Waited ${timeout}ms`;
    } catch (err) {
      if (String(err).includes('Cannot find module')) return notAvailableError();
      return `Browser wait error: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
};
