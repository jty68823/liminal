/**
 * Slack Web API connector — send messages, list channels via API.
 */

import type { AppConnector, ExecutionMethod, AppAction, ExecutionResult } from '../dispatcher.js';

const SLACK_TOKEN = process.env['SLACK_BOT_TOKEN'] ?? '';
const SLACK_API = 'https://slack.com/api';

async function slackApi(method: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(`${SLACK_API}/${method}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SLACK_TOKEN}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<Record<string, unknown>>;
}

export const slackConnector: AppConnector = {
  appName: 'slack',
  supportedActions: ['send_message', 'list_channels'],

  toExecutionMethod(): ExecutionMethod {
    return {
      type: 'api',
      priority: 10,

      async available(): Promise<boolean> {
        return SLACK_TOKEN.length > 0;
      },

      async execute(action: AppAction): Promise<ExecutionResult> {
        const start = Date.now();

        switch (action.action) {
          case 'send_message': {
            const channel = action.params['channel'] as string;
            const text = action.params['text'] as string;
            if (!channel || !text) {
              return { success: false, method: 'api', output: 'Missing channel or text', durationMs: Date.now() - start };
            }
            const result = await slackApi('chat.postMessage', { channel, text });
            if (result['ok']) {
              return { success: true, method: 'api', output: `Message sent to ${channel}`, durationMs: Date.now() - start };
            }
            return { success: false, method: 'api', output: `Slack error: ${result['error']}`, durationMs: Date.now() - start };
          }

          case 'list_channels': {
            const result = await slackApi('conversations.list', { types: 'public_channel,private_channel', limit: 100 });
            if (result['ok']) {
              const channels = (result['channels'] as Array<{ name: string; id: string }>) ?? [];
              const list = channels.map((c) => `#${c.name} (${c.id})`).join('\n');
              return { success: true, method: 'api', output: `Channels:\n${list}`, durationMs: Date.now() - start };
            }
            return { success: false, method: 'api', output: `Slack error: ${result['error']}`, durationMs: Date.now() - start };
          }

          default:
            return { success: false, method: 'api', output: `Unsupported Slack action: ${action.action}`, durationMs: Date.now() - start };
        }
      },
    };
  },
};
