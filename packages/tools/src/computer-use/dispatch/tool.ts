/**
 * computer_dispatch tool — smart dispatch layer that routes actions through
 * API → Browser → Screen fallback chain.
 */

import type { ToolHandler } from '../../registry.js';
import { dispatcher } from './dispatcher.js';
import { connectorRegistry } from './connector-registry.js';
import { browserMethod } from './connectors/browser-method.js';
import { screenMethod } from './connectors/screen-method.js';
import { slackConnector } from './connectors/slack.js';
import { googleCalendarConnector } from './connectors/google-calendar.js';

// Register all execution methods and connectors
let initialized = false;
function ensureInitialized(): void {
  if (initialized) return;
  initialized = true;

  // Register API connectors
  connectorRegistry.register(slackConnector);
  connectorRegistry.register(googleCalendarConnector);

  // Register their execution methods with the dispatcher
  for (const connector of connectorRegistry.list()) {
    dispatcher.registerConnector(connector);
  }

  // Register browser and screen fallback methods
  dispatcher.register(browserMethod);
  dispatcher.register(screenMethod);
}

export const computerDispatchTool: ToolHandler = {
  definition: {
    name: 'computer_dispatch',
    description: 'Smart execution dispatcher that routes actions through the optimal method: API connectors → Browser automation → Screen control. Tries each method in priority order.',
    input_schema: {
      type: 'object',
      properties: {
        app: {
          type: 'string',
          description: 'Target application (e.g., "slack", "google-calendar", "browser", "desktop")',
        },
        action: {
          type: 'string',
          description: 'Action to perform (e.g., "send_message", "navigate", "click", "type")',
        },
        params: {
          type: 'object',
          description: 'Action parameters (varies by action)',
          additionalProperties: true,
        },
      },
      required: ['app', 'action'],
    },
  },

  async execute(input: Record<string, unknown>): Promise<string> {
    ensureInitialized();

    const app = input['app'] as string;
    const action = input['action'] as string;
    const params = (input['params'] as Record<string, unknown>) ?? {};

    const result = await dispatcher.dispatch({ app, action, params });

    const output = [
      `Method: ${result.method}`,
      `Success: ${result.success}`,
      `Duration: ${result.durationMs}ms`,
      `Output: ${result.output}`,
    ];

    if (result.screenshotBase64) {
      output.push(`Screenshot: ${result.screenshotBase64.slice(0, 100)}...`);
    }

    return output.join('\n');
  },
};
