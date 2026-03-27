import { registerCommand } from './index.js';
import type { Session } from '../session/session.js';

/**
 * /clear — reset the active conversation.
 *
 * Clears the local message history and starts a fresh conversation on the
 * next user message (by nulling out conversationId on the session).
 *
 * The command returns a confirmation string; the REPL is responsible for
 * actually mutating the session object and clearing its local message buffer.
 * We signal that intent by using a well-known return value prefix.
 */
export const CLEAR_SIGNAL = '__CLEAR__';

registerCommand({
  name: 'clear',
  description: 'Reset conversation history and start fresh',
  usage: '/clear',

  async execute(_args: string[], session: Session): Promise<string> {
    // Null out the conversationId so the next message creates a new one
    session.conversationId = null;
    return CLEAR_SIGNAL;
  },
});
