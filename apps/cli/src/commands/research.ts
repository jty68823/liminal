import { registerCommand } from './index.js';
import { ApiClient } from '../api/client.js';
import type { Session } from '../session/session.js';

/**
 * /research <query> — web research via the chat API.
 *
 * Sends a structured prompt asking the assistant to use its web_search and
 * fetch_page tools, then streams the answer back as a normal conversation.
 * The conversation ID is stored on the session so follow-up turns work.
 *
 *   /research what is the latest LTS version of Node.js
 */

export const RESEARCH_SIGNAL_PREFIX = '__RESEARCH__:';

registerCommand({
  name: 'research',
  description: 'Search the web and summarise findings',
  usage: '/research <query>',

  async execute(args: string[], session: Session): Promise<string> {
    const query = args.join(' ').trim();
    if (!query) {
      return 'Usage: /research <query>';
    }

    const client = new ApiClient(session.apiUrl);

    const prompt =
      `Please search the web for: ${query}\n\n` +
      `Use the web_search tool to find results, then use fetch_page to read the ` +
      `top 2 results. Summarise the findings in a clear, concise answer.`;

    let result = '';
    let errorMsg = '';

    await client.sendMessage(
      {
        content: prompt,
        conversationId: session.conversationId ?? undefined,
        model: session.model,
      },
      {
        onToken(delta)         { result += delta; },
        onThinking()           { /* ignore thinking blocks */ },
        onToolCallStart()      { /* tool progress shown in REPL live view */ },
        onToolCallResult()     { /* handled above */ },
        onArtifact()           { /* ignore */ },
        onDone(_msgId, convId) { session.conversationId = convId; },
        onError(msg)           { errorMsg = msg; },
      },
    );

    if (errorMsg) {
      return `Research failed: ${errorMsg}`;
    }

    if (!result.trim()) {
      return 'Research returned no results.';
    }

    return result.trim();
  },
});
