/**
 * Cowork orchestrator — high-level API for managing multi-agent sessions.
 */

import { CoworkSession } from './session.js';
import type { CoworkSessionConfig, CoworkResult } from './types.js';
import { providerRegistry } from '../providers/registry.js';

export class CoworkOrchestrator {
  private sessions: Map<string, CoworkSession> = new Map();

  /**
   * Create and run a cowork session.
   */
  async createSession(config: CoworkSessionConfig): Promise<CoworkResult> {
    const session = new CoworkSession(config);
    this.sessions.set(session.id, session);

    const provider = providerRegistry.getActive();

    const chatFn = async (opts: {
      model: string;
      systemPrompt: string;
      messages: Array<{ role: string; content: string }>;
    }): Promise<string> => {
      const providerMessages = [
        { role: 'system' as const, content: opts.systemPrompt },
        ...opts.messages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      ];

      const response = await provider.chat({
        model: opts.model,
        messages: providerMessages,
      });

      return response.message.content;
    };

    const result = await session.run(chatFn);
    return result;
  }

  /**
   * Abort a running session.
   */
  abort(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    session.abort();
    return true;
  }

  /**
   * Quick helper: run a code review pipeline.
   */
  async codeReview(code: string, model?: string): Promise<CoworkResult> {
    return this.createSession({
      task: `Review the following code:\n\`\`\`\n${code}\n\`\`\``,
      agents: [
        { role: 'reviewer', enabled: true, model },
        { role: 'security', enabled: true, model },
        { role: 'tester', enabled: true, model },
      ],
      mode: 'parallel',
    });
  }

  /**
   * Quick helper: run a feature development pipeline.
   */
  async developFeature(description: string, model?: string): Promise<CoworkResult> {
    return this.createSession({
      task: description,
      agents: [
        { role: 'architect', enabled: true, model },
        { role: 'coder', enabled: true, model },
        { role: 'reviewer', enabled: true, model },
        { role: 'tester', enabled: true, model },
      ],
      mode: 'pipeline',
    });
  }
}

export const coworkOrchestrator = new CoworkOrchestrator();
