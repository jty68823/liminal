/**
 * CoworkSession — manages a multi-agent collaboration session.
 */

import type { AgentConfig, AgentMessage, CoworkResult, CoworkSessionConfig } from './types.js';
import { agentRegistry } from './agents.js';
import { nanoid } from 'nanoid';

export class CoworkSession {
  readonly id: string;
  private config: CoworkSessionConfig;
  private messages: AgentMessage[] = [];
  private sequence = 0;
  private aborted = false;

  constructor(config: CoworkSessionConfig) {
    this.id = nanoid();
    this.config = config;
  }

  /**
   * Run the cowork session with a provider function.
   * The chatFn handles the actual LLM calls.
   */
  async run(chatFn: (opts: {
    model: string;
    systemPrompt: string;
    messages: Array<{ role: string; content: string }>;
  }) => Promise<string>): Promise<CoworkResult> {
    const start = Date.now();

    try {
      const { mode, agents, task } = this.config;
      const enabledAgents = agents.filter((a) => a.enabled);

      let finalOutput = '';

      switch (mode) {
        case 'pipeline':
          finalOutput = await this.runPipeline(enabledAgents, task, chatFn);
          break;
        case 'parallel':
          finalOutput = await this.runParallel(enabledAgents, task, chatFn);
          break;
        case 'discussion':
          finalOutput = await this.runDiscussion(enabledAgents, task, chatFn);
          break;
      }

      return {
        sessionId: this.id,
        status: this.aborted ? 'failed' : 'completed',
        messages: this.messages,
        finalOutput,
        totalTokens: 0,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      return {
        sessionId: this.id,
        status: 'failed',
        messages: this.messages,
        finalOutput: `Error: ${err instanceof Error ? err.message : String(err)}`,
        totalTokens: 0,
        durationMs: Date.now() - start,
      };
    }
  }

  abort(): void {
    this.aborted = true;
  }

  /**
   * Pipeline mode: agents run sequentially, each building on previous output.
   */
  private async runPipeline(
    agents: AgentConfig[],
    task: string,
    chatFn: (opts: { model: string; systemPrompt: string; messages: Array<{ role: string; content: string }> }) => Promise<string>,
  ): Promise<string> {
    let context = task;

    for (const agent of agents) {
      if (this.aborted) break;

      const systemPrompt = agent.systemPrompt ?? agentRegistry.getSystemPrompt(agent.role);
      const model = agent.model ?? process.env['LIMINAL_DEFAULT_MODEL'] ?? 'Meta-Llama-3.1-8B-Instruct-Q4_K_M';

      const prompt = agents.indexOf(agent) === 0
        ? `Task: ${task}`
        : `Task: ${task}\n\nPrevious agent output:\n${context}\n\nBuild on the above and contribute your perspective as ${agent.role}.`;

      const response = await chatFn({
        model,
        systemPrompt,
        messages: [{ role: 'user', content: prompt }],
      });

      this.addMessage(agent.role, response);
      context = response;
    }

    return context;
  }

  /**
   * Parallel mode: all agents run simultaneously on the same task.
   */
  private async runParallel(
    agents: AgentConfig[],
    task: string,
    chatFn: (opts: { model: string; systemPrompt: string; messages: Array<{ role: string; content: string }> }) => Promise<string>,
  ): Promise<string> {
    const results = await Promise.all(
      agents.map(async (agent) => {
        if (this.aborted) return { role: agent.role, content: 'Aborted' };

        const systemPrompt = agent.systemPrompt ?? agentRegistry.getSystemPrompt(agent.role);
        const model = agent.model ?? process.env['LIMINAL_DEFAULT_MODEL'] ?? 'Meta-Llama-3.1-8B-Instruct-Q4_K_M';

        const response = await chatFn({
          model,
          systemPrompt,
          messages: [{ role: 'user', content: `Task: ${task}` }],
        });

        this.addMessage(agent.role, response);
        return { role: agent.role, content: response };
      }),
    );

    return results.map((r) => `## ${r.role}\n${r.content}`).join('\n\n---\n\n');
  }

  /**
   * Discussion mode: agents take turns discussing, building on each other's input.
   */
  private async runDiscussion(
    agents: AgentConfig[],
    task: string,
    chatFn: (opts: { model: string; systemPrompt: string; messages: Array<{ role: string; content: string }> }) => Promise<string>,
  ): Promise<string> {
    const maxRounds = this.config.maxRounds ?? 3;
    const sharedHistory: Array<{ role: string; content: string }> = [
      { role: 'user', content: `Task for discussion: ${task}` },
    ];

    for (let round = 0; round < maxRounds; round++) {
      for (const agent of agents) {
        if (this.aborted) break;

        const systemPrompt = agent.systemPrompt ?? agentRegistry.getSystemPrompt(agent.role);
        const model = agent.model ?? process.env['LIMINAL_DEFAULT_MODEL'] ?? 'Meta-Llama-3.1-8B-Instruct-Q4_K_M';

        const response = await chatFn({
          model,
          systemPrompt,
          messages: sharedHistory,
        });

        this.addMessage(agent.role, response);
        sharedHistory.push({
          role: 'assistant',
          content: `[${agent.role}]: ${response}`,
        });
      }
    }

    // Final synthesis
    return this.messages.map((m) => `## ${m.agentRole} (seq ${m.sequence})\n${m.content}`).join('\n\n');
  }

  private addMessage(role: string, content: string): void {
    this.messages.push({
      agentRole: role as AgentMessage['agentRole'],
      content,
      timestamp: Date.now(),
      sequence: this.sequence++,
    });
  }
}
