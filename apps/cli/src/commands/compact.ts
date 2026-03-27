import { registerCommand } from './index.js';
import { ApiClient } from '../api/client.js';
import type { Session } from '../session/session.js';

/**
 * /compact — summarise the current conversation and trim local history.
 *
 * Sends a special "summarise" message to the API so the model produces a
 * compact summary. The REPL then replaces the local message buffer with a
 * single synthetic message containing that summary, which keeps context
 * alive while dramatically reducing token count.
 */
export const COMPACT_SIGNAL_PREFIX = '__COMPACT__:';

registerCommand({
  name: 'compact',
  description: 'Summarise the conversation to reduce context size',
  usage: '/compact',

  async execute(_args: string[], session: Session): Promise<string> {
    if (!session.conversationId) {
      return 'No active conversation to compact.';
    }

    const client = new ApiClient(session.apiUrl);

    let summary = '';
    let done = false;
    let errorMsg = '';

    await client.sendMessage(
      {
        content:
          'Please provide a concise but complete summary of our conversation so far. ' +
          'Capture every significant decision, code change, file path, and open question. ' +
          'This summary will replace the full history to save context. ' +
          'Respond with ONLY the summary text — no preamble or metadata.',
        conversationId: session.conversationId,
        model: session.model,
      },
      {
        onToken(delta) { summary += delta; },
        onThinking() { /* ignore */ },
        onToolCallStart() { /* ignore */ },
        onToolCallResult() { /* ignore */ },
        onArtifact() { /* ignore */ },
        onDone(_msgId, _convId) { done = true; },
        onError(msg) { errorMsg = msg; },
      },
    );

    if (errorMsg) {
      return `Failed to compact: ${errorMsg}`;
    }

    if (!done || !summary.trim()) {
      return 'Compact failed: no summary received.';
    }

    // Signal to the REPL that it should replace its message buffer
    // with the summary and reset the conversation ID.
    return `${COMPACT_SIGNAL_PREFIX}${summary.trim()}`;
  },
});
