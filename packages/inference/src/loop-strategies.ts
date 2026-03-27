/**
 * Loop strategies for the enhanced ReAct loop.
 *
 * - Planning: validates tool calls before execution
 * - Reflection: summarizes results after tool execution
 * - Loop detection: prevents repeating the same tool call
 * - Retry: retries failed tool calls with backoff
 * - Token budget: stops when context is getting too full
 */

import type { ToolResult } from '@liminal/core';

// ---------------------------------------------------------------------------
// Loop Detection
// ---------------------------------------------------------------------------

interface ToolCallSignature {
  name: string;
  inputHash: string;
}

export class LoopDetector {
  private history: ToolCallSignature[] = [];
  private readonly maxRepeats: number;

  constructor(maxRepeats = 2) {
    this.maxRepeats = maxRepeats;
  }

  /** Returns true if this exact tool call has been seen too many times. */
  isLoop(name: string, input: Record<string, unknown>): boolean {
    const hash = this.hashInput(input);
    const sig: ToolCallSignature = { name, inputHash: hash };

    const repeats = this.history.filter(
      (h) => h.name === sig.name && h.inputHash === sig.inputHash,
    ).length;

    return repeats >= this.maxRepeats;
  }

  /** Record a tool call. */
  record(name: string, input: Record<string, unknown>): void {
    this.history.push({ name, inputHash: this.hashInput(input) });
  }

  private hashInput(input: Record<string, unknown>): string {
    try {
      return JSON.stringify(input, Object.keys(input).sort());
    } catch {
      return String(input);
    }
  }
}

// ---------------------------------------------------------------------------
// Retry Strategy
// ---------------------------------------------------------------------------

export class RetryStrategy {
  private failureCounts = new Map<string, number>();
  private readonly maxRetries: number;
  private disabledTools = new Set<string>();

  constructor(maxRetries = 2) {
    this.maxRetries = maxRetries;
  }

  /** Record a tool failure. Returns true if the tool should be retried. */
  recordFailure(toolName: string): boolean {
    const count = (this.failureCounts.get(toolName) ?? 0) + 1;
    this.failureCounts.set(toolName, count);

    if (count > this.maxRetries) {
      this.disabledTools.add(toolName);
      return false;
    }

    return true;
  }

  /** Check if a tool has been disabled due to repeated failures. */
  isDisabled(toolName: string): boolean {
    return this.disabledTools.has(toolName);
  }

  /** Get list of disabled tools. */
  getDisabledTools(): string[] {
    return Array.from(this.disabledTools);
  }

  /** Record a success (resets failure counter). */
  recordSuccess(toolName: string): void {
    this.failureCounts.delete(toolName);
  }
}

// ---------------------------------------------------------------------------
// Token Budget
// ---------------------------------------------------------------------------

export class TokenBudget {
  private readonly maxTokens: number;
  private usedTokens: number;

  constructor(maxTokens: number, initialUsed = 0) {
    this.maxTokens = maxTokens;
    this.usedTokens = initialUsed;
  }

  /** Add tokens from a completed iteration. */
  addTokens(count: number): void {
    this.usedTokens += count;
  }

  /** Check if we have budget for another iteration. */
  hasRemaining(estimatedNext = 2000): boolean {
    return this.usedTokens + estimatedNext < this.maxTokens;
  }

  /** Get remaining budget. */
  remaining(): number {
    return Math.max(0, this.maxTokens - this.usedTokens);
  }

  /** Get usage ratio (0..1). */
  usageRatio(): number {
    return this.usedTokens / this.maxTokens;
  }
}

// ---------------------------------------------------------------------------
// Reflection (observation summary)
// ---------------------------------------------------------------------------

/**
 * Summarizes tool results into a concise observation for the model.
 * Truncates long outputs and highlights errors.
 */
export function summarizeToolResults(
  results: Array<{ name: string; result: ToolResult }>,
  maxCharsPerResult = 2000,
): string {
  if (results.length === 0) return '';

  const summaries = results.map(({ name, result }) => {
    const status = result.is_error ? 'ERROR' : 'SUCCESS';
    let output = result.output;

    if (output.length > maxCharsPerResult) {
      output = output.slice(0, maxCharsPerResult) + `\n... (truncated, ${output.length} chars total)`;
    }

    return `[${name}] ${status}: ${output}`;
  });

  return summaries.join('\n\n');
}

// ---------------------------------------------------------------------------
// Stopping conditions
// ---------------------------------------------------------------------------

export interface StopCondition {
  shouldStop: boolean;
  reason?: string;
}

export function checkStopConditions(opts: {
  iteration: number;
  maxIterations: number;
  tokenBudget?: TokenBudget;
  loopDetected?: boolean;
  allToolsDisabled?: boolean;
}): StopCondition {
  if (opts.iteration >= opts.maxIterations) {
    return { shouldStop: true, reason: `Max iterations reached (${opts.maxIterations})` };
  }

  if (opts.tokenBudget && !opts.tokenBudget.hasRemaining()) {
    return { shouldStop: true, reason: 'Token budget exhausted' };
  }

  if (opts.loopDetected) {
    return { shouldStop: true, reason: 'Loop detected — same tool call repeated' };
  }

  if (opts.allToolsDisabled) {
    return { shouldStop: true, reason: 'All available tools have been disabled due to errors' };
  }

  return { shouldStop: false };
}
