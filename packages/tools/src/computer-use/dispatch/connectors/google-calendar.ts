/**
 * Google Calendar REST connector — list events, create events.
 */

import type { AppConnector, ExecutionMethod, AppAction, ExecutionResult } from '../dispatcher.js';

const GCAL_API_KEY = process.env['GOOGLE_CALENDAR_API_KEY'] ?? '';
const GCAL_TOKEN = process.env['GOOGLE_CALENDAR_TOKEN'] ?? '';
const GCAL_BASE = 'https://www.googleapis.com/calendar/v3';

async function gcalApi(path: string, opts: { method?: string; body?: Record<string, unknown> } = {}): Promise<Record<string, unknown>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (GCAL_TOKEN) {
    headers['Authorization'] = `Bearer ${GCAL_TOKEN}`;
  }

  const url = GCAL_API_KEY
    ? `${GCAL_BASE}${path}${path.includes('?') ? '&' : '?'}key=${GCAL_API_KEY}`
    : `${GCAL_BASE}${path}`;

  const res = await fetch(url, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  return res.json() as Promise<Record<string, unknown>>;
}

export const googleCalendarConnector: AppConnector = {
  appName: 'google-calendar',
  supportedActions: ['list_events', 'create_event'],

  toExecutionMethod(): ExecutionMethod {
    return {
      type: 'api',
      priority: 10,

      async available(): Promise<boolean> {
        return (GCAL_TOKEN.length > 0) || (GCAL_API_KEY.length > 0);
      },

      async execute(action: AppAction): Promise<ExecutionResult> {
        const start = Date.now();

        switch (action.action) {
          case 'list_events': {
            const calendarId = (action.params['calendar_id'] as string) ?? 'primary';
            const timeMin = (action.params['time_min'] as string) ?? new Date().toISOString();
            const maxResults = (action.params['max_results'] as number) ?? 10;

            const result = await gcalApi(
              `/calendars/${encodeURIComponent(calendarId)}/events?timeMin=${encodeURIComponent(timeMin)}&maxResults=${maxResults}&singleEvents=true&orderBy=startTime`,
            );

            if (result['error']) {
              return { success: false, method: 'api', output: `Calendar error: ${JSON.stringify(result['error'])}`, durationMs: Date.now() - start };
            }

            const items = (result['items'] as Array<{ summary: string; start: { dateTime?: string; date?: string } }>) ?? [];
            const list = items.map((e) => `- ${e.summary} (${e.start.dateTime ?? e.start.date})`).join('\n');
            return { success: true, method: 'api', output: `Events:\n${list || 'No upcoming events'}`, durationMs: Date.now() - start };
          }

          case 'create_event': {
            const calendarId = (action.params['calendar_id'] as string) ?? 'primary';
            const summary = action.params['summary'] as string;
            const startTime = action.params['start'] as string;
            const endTime = action.params['end'] as string;

            if (!summary || !startTime || !endTime) {
              return { success: false, method: 'api', output: 'Missing summary, start, or end time', durationMs: Date.now() - start };
            }

            const result = await gcalApi(`/calendars/${encodeURIComponent(calendarId)}/events`, {
              method: 'POST',
              body: {
                summary,
                start: { dateTime: startTime },
                end: { dateTime: endTime },
              },
            });

            if (result['id']) {
              return { success: true, method: 'api', output: `Event created: ${summary}`, durationMs: Date.now() - start };
            }
            return { success: false, method: 'api', output: `Calendar error: ${JSON.stringify(result['error'] ?? result)}`, durationMs: Date.now() - start };
          }

          default:
            return { success: false, method: 'api', output: `Unsupported Calendar action: ${action.action}`, durationMs: Date.now() - start };
        }
      },
    };
  },
};
