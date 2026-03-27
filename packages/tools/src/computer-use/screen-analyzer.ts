/**
 * Screen analyzer — captures screen and uses vision model to analyze UI elements.
 */

import type { ToolHandler } from '../registry.js';

export const screenAnalyzerTool: ToolHandler = {
  definition: {
    name: 'computer_analyze_screen',
    description: 'Capture a screenshot and analyze the screen contents using a vision model. Returns a description of visible UI elements, text, and layout.',
    input_schema: {
      type: 'object',
      properties: {
        region: {
          type: 'object',
          description: 'Optional region to analyze (x, y, width, height). If omitted, captures full screen.',
          properties: {
            x: { type: 'number' },
            y: { type: 'number' },
            width: { type: 'number' },
            height: { type: 'number' },
          },
        },
        prompt: {
          type: 'string',
          description: 'What to look for in the screenshot (e.g., "find the login button", "describe the error dialog")',
        },
      },
      required: [],
    },
  },

  async execute(input: Record<string, unknown>): Promise<string> {
    const prompt = (input['prompt'] as string) ?? 'Describe what you see on the screen, including all visible UI elements, text, and their positions.';

    try {
      const screenshot = await import('screenshot-desktop');
      const imgBuffer = await screenshot.default({ format: 'png' });
      const base64 = imgBuffer.toString('base64');

      // Use vision model to analyze via the active provider
      const visionModel = process.env['LIMINAL_VISION_MODEL'] ?? 'llava';

      const { providerRegistry } = await import('@liminal/inference') as {
        providerRegistry: { getActive(): { chat(opts: { model: string; messages: Array<{ role: string; content: string; images?: string[] }>; stream?: boolean }): Promise<{ message: { content: string } }> } };
      };

      const provider = providerRegistry.getActive();
      const response = await provider.chat({
        model: visionModel,
        messages: [{
          role: 'user',
          content: prompt,
          images: [base64],
        }],
        stream: false,
      });

      return response.message?.content ?? 'No analysis result';
    } catch (err) {
      return `Screen analysis error: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
};
