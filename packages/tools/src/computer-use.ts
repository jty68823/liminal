import type { ToolHandler } from './registry.js';

function notInstalledError(pkg: string): string {
  return `Error: ${pkg} is not available. Computer use requires native packages. Run: pnpm --filter @liminal/tools add ${pkg}`;
}

export const screenshotTool: ToolHandler = {
  definition: {
    name: 'computer_screenshot',
    description: 'Take a screenshot of the current screen. Returns base64-encoded PNG image.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  async execute(_input) {
    try {
      const screenshot = (await import('screenshot-desktop')).default;
      const buf = await (screenshot as (opts?: Record<string,unknown>) => Promise<Buffer>)({ format: 'png' });
      return `data:image/png;base64,${buf.toString('base64')}`;
    } catch (err) {
      if (String(err).includes('Cannot find module')) return notInstalledError('screenshot-desktop');
      return `Error taking screenshot: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
};

export const clickTool: ToolHandler = {
  definition: {
    name: 'computer_click',
    description: 'Click the mouse at a specific screen position.',
    input_schema: {
      type: 'object',
      properties: {
        x: { type: 'number', description: 'X coordinate in pixels' },
        y: { type: 'number', description: 'Y coordinate in pixels' },
        button: { type: 'string', enum: ['left', 'right', 'middle'], description: 'Mouse button to click' },
      },
      required: ['x', 'y'],
    },
  },
  async execute(input) {
    try {
      const robot = await import('@jitsi/robotjs');
      const x = input['x'] as number;
      const y = input['y'] as number;
      const button = (input['button'] as string) ?? 'left';
      robot.moveMouse(x, y);
      robot.mouseClick(button as 'left' | 'right' | 'middle');
      return `Clicked ${button} at (${x}, ${y})`;
    } catch (err) {
      if (String(err).includes('Cannot find module')) return notInstalledError('@jitsi/robotjs');
      return `Error clicking: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
};

export const typeTool: ToolHandler = {
  definition: {
    name: 'computer_type',
    description: 'Type text using the keyboard.',
    input_schema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to type' },
      },
      required: ['text'],
    },
  },
  async execute(input) {
    try {
      const robot = await import('@jitsi/robotjs');
      const text = input['text'] as string;
      robot.typeString(text);
      return `Typed: "${text}"`;
    } catch (err) {
      if (String(err).includes('Cannot find module')) return notInstalledError('@jitsi/robotjs');
      return `Error typing: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
};

export const keyTool: ToolHandler = {
  definition: {
    name: 'computer_key',
    description: 'Press a keyboard key or combination.',
    input_schema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Key name (e.g. "enter", "escape", "ctrl+c", "alt+tab")' },
      },
      required: ['key'],
    },
  },
  async execute(input) {
    try {
      const robot = await import('@jitsi/robotjs');
      const key = input['key'] as string;
      if (key.includes('+')) {
        const parts = key.split('+');
        const modifiers = parts.slice(0, -1);
        const mainKey = parts[parts.length - 1];
        robot.keyTap(mainKey, modifiers);
      } else {
        robot.keyTap(key);
      }
      return `Pressed key: ${key}`;
    } catch (err) {
      if (String(err).includes('Cannot find module')) return notInstalledError('@jitsi/robotjs');
      return `Error pressing key: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
};

export const scrollTool: ToolHandler = {
  definition: {
    name: 'computer_scroll',
    description: 'Scroll the mouse wheel.',
    input_schema: {
      type: 'object',
      properties: {
        x: { type: 'number', description: 'X position to scroll at' },
        y: { type: 'number', description: 'Y position to scroll at' },
        direction: { type: 'string', enum: ['up', 'down'], description: 'Scroll direction' },
        amount: { type: 'number', description: 'Number of scroll steps', default: 3 },
      },
      required: ['x', 'y', 'direction'],
    },
  },
  async execute(input) {
    try {
      const robot = await import('@jitsi/robotjs');
      const x = input['x'] as number;
      const y = input['y'] as number;
      const direction = input['direction'] as string;
      const amount = (input['amount'] as number) ?? 3;
      robot.moveMouse(x, y);
      robot.scrollMouse(0, direction === 'down' ? -amount : amount);
      return `Scrolled ${direction} at (${x}, ${y})`;
    } catch (err) {
      if (String(err).includes('Cannot find module')) return notInstalledError('@jitsi/robotjs');
      return `Error scrolling: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
};
