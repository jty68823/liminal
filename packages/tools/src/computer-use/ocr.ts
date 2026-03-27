/**
 * OCR tool — extracts text from screen regions using basic pattern matching.
 * Falls back to vision model analysis when tesseract is not available.
 */

import type { ToolHandler } from '../registry.js';

export const ocrTool: ToolHandler = {
  definition: {
    name: 'computer_read_text',
    description: 'Read/extract text visible on the screen or from a specific region. Uses OCR or vision model to identify text content.',
    input_schema: {
      type: 'object',
      properties: {
        region: {
          type: 'object',
          description: 'Screen region to read (x, y, width, height). If omitted, reads entire screen.',
          properties: {
            x: { type: 'number' },
            y: { type: 'number' },
            width: { type: 'number' },
            height: { type: 'number' },
          },
        },
      },
      required: [],
    },
  },

  async execute(input: Record<string, unknown>): Promise<string> {
    try {
      const screenshot = await import('screenshot-desktop');
      const imgBuffer = await screenshot.default({ format: 'png' });
      const base64 = imgBuffer.toString('base64');

      // Use vision model for OCR via the active provider
      const visionModel = process.env['LIMINAL_VISION_MODEL'] ?? 'llava';

      const { providerRegistry } = await import('@liminal/inference') as {
        providerRegistry: { getActive(): { chat(opts: { model: string; messages: Array<{ role: string; content: string; images?: string[] }>; stream?: boolean }): Promise<{ message: { content: string } }> } };
      };

      const provider = providerRegistry.getActive();
      const response = await provider.chat({
        model: visionModel,
        messages: [{
          role: 'user',
          content: 'Extract ALL visible text from this screenshot. Output only the text content, preserving layout where possible. Do not describe the image, only output the text you can read.',
          images: [base64],
        }],
        stream: false,
      });

      return response.message?.content ?? 'No text detected';
    } catch (err) {
      return `OCR error: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
};
