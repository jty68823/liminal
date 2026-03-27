/**
 * AutoTask orchestrator — autonomous task execution with DAG scheduling,
 * dynamic agent lifecycle, configurable concurrency, and QA workflow.
 */

import { planAutoTask } from './planner.js';
import { executeSubtask } from './executor.js';
import { createSecurityContext } from './security.js';
import type {
  AutoTaskPlan,
  AutoTaskOptions,
  ConcurrencyStrategy,
  SecurityLevel,
  Subtask,
  SubtaskStatus,
  QAVerdict,
} from './types.js';
import { providerRegistry } from '../providers/registry.js';
import { agentRegistry } from '../cowork/agents.js';
import { dispatchSubAgentsSync } from '../agent-dispatcher.js';

/**
 * Resolve effective maxConcurrent.
 * - 'fixed' (default): use the explicit value or 3
 * - 'auto':  use the AI-recommended value from the plan, clamped [1, maxClamp]
 */
function resolveMaxConcurrent(
  strategy: ConcurrencyStrategy,
  explicit: number | undefined,
  plan: AutoTaskPlan,
  maxClamp: number,
): number {
  if (strategy === 'auto') {
    const recommended = plan.recommendedConcurrency ?? 3;
    return Math.max(1, Math.min(maxClamp, recommended));
  }
  return Math.max(1, Math.min(maxClamp, explicit ?? 3));
}

export class AutoTaskOrchestrator {
  private activeAbortControllers = new Map<string, AbortController>();

  async run(
    runId: string,
    objective: string,
    securityLevel: SecurityLevel,
    options: AutoTaskOptions,
  ): Promise<void> {
    const startTime = Date.now();
    const model = options.model ?? process.env['LIMINAL_DEFAULT_MODEL'] ?? 'Meta-Llama-3.1-8B-Instruct-Q4_K_M';
    const strategy: ConcurrencyStrategy = options.concurrencyStrategy ?? 'fixed';
    const maxClamp = Math.max(1, Math.min(10, options.maxClamp ?? 5));

    const abortController = new AbortController();
    this.activeAbortControllers.set(runId, abortController);

    // Merge external abort signal
    if (options.abortSignal) {
      options.abortSignal.addEventListener('abort', () => abortController.abort());
    }

    const secCtx = createSecurityContext(securityLevel, runId);

    // Track dynamic agents created for this run (for cleanup in finally)
    let dynamicAgentsRegistered = false;

    try {
      // ── Phase 1: Planning ──────────────────────────────────────────────────
      const plan: AutoTaskPlan = await planAutoTask(objective, securityLevel, model);

      options.onEvent({
        type: 'auto_task_plan',
        runId,
        plan,
      });

      // ── Phase 1.5: Register Dynamic Agents ─────────────────────────────────
      if (plan.dynamicAgents && plan.dynamicAgents.length > 0) {
        for (const agent of plan.dynamicAgents) {
          try {
            agentRegistry.register({
              role: agent.role,
              label: agent.label,
              description: agent.description,
              systemPrompt: agent.systemPrompt,
              color: agent.color ?? '#94a3b8',
              icon: agent.icon ?? '🤖',
              createdByRunId: runId,
            });
            dynamicAgentsRegistered = true;

            options.onEvent({
              type: 'auto_task_agent_created',
              runId,
              agent: {
                role: agent.role,
                label: agent.label,
                description: agent.description,
                color: agent.color ?? '#94a3b8',
                icon: agent.icon ?? '🤖',
              },
            });
          } catch {
            // Role collision or invalid — skip silently
          }
        }
      }

      // ── Phase 1.7: Resolve concurrency ─────────────────────────────────────
      const maxConcurrent = resolveMaxConcurrent(strategy, options.maxConcurrent, plan, maxClamp);

      options.onEvent({
        type: 'auto_task_concurrency',
        runId,
        maxConcurrent,
        strategy,
        runningCount: 0,
        pendingCount: plan.subtasks.length,
      });

      // ── Phase 2: DAG Execution ─────────────────────────────────────────────
      const subtaskMap = new Map<string, Subtask>(
        plan.subtasks.map((s) => [s.id, { ...s, status: 'pending' as SubtaskStatus }]),
      );

      const completedIds = new Set<string>();
      const failedIds = new Set<string>();
      const runningIds = new Set<string>();

      let cumulativeContext = '';

      const isReady = (subtask: Subtask): boolean =>
        subtask.status === 'pending' &&
        subtask.dependsOn.every((dep) => completedIds.has(dep));

      const isDone = (): boolean => {
        for (const s of subtaskMap.values()) {
          if (s.status === 'pending' || s.status === 'running') return false;
        }
        return true;
      };

      const emitConcurrency = (): void => {
        const pendingCount = Array.from(subtaskMap.values())
          .filter((s) => s.status === 'pending').length;
        options.onEvent({
          type: 'auto_task_concurrency',
          runId,
          maxConcurrent,
          strategy,
          runningCount: runningIds.size,
          pendingCount,
        });
      };

      const runSubtask = async (subtask: Subtask): Promise<void> => {
        if (abortController.signal.aborted) {
          subtask.status = 'skipped';
          subtaskMap.set(subtask.id, subtask);
          return;
        }

        subtask.status = 'running';
        subtask.startedAt = Date.now();
        subtaskMap.set(subtask.id, subtask);
        runningIds.add(subtask.id);

        options.onEvent({
          type: 'auto_task_subtask_start',
          runId,
          subtaskId: subtask.id,
          subtask: { ...subtask },
        });

        emitConcurrency();

        const subtaskStartTime = Date.now();
        try {
          const result = await executeSubtask(subtask, secCtx, cumulativeContext, options);

          subtask.status = 'completed';
          subtask.result = result;
          subtask.finishedAt = Date.now();
          subtaskMap.set(subtask.id, subtask);
          completedIds.add(subtask.id);

          cumulativeContext += `\n### ${subtask.title}\n${result.slice(0, 1000)}\n`;

          options.onEvent({
            type: 'auto_task_subtask_done',
            runId,
            subtaskId: subtask.id,
            status: 'completed',
            result,
            durationMs: Date.now() - subtaskStartTime,
          });
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          subtask.status = 'failed';
          subtask.error = errorMsg;
          subtask.finishedAt = Date.now();
          subtaskMap.set(subtask.id, subtask);
          failedIds.add(subtask.id);

          options.onEvent({
            type: 'auto_task_subtask_done',
            runId,
            subtaskId: subtask.id,
            status: 'failed',
            error: errorMsg,
            durationMs: Date.now() - subtaskStartTime,
          });

          // Mark dependent subtasks as skipped
          for (const s of subtaskMap.values()) {
            if (s.dependsOn.includes(subtask.id) && s.status === 'pending') {
              s.status = 'skipped';
              subtaskMap.set(s.id, s);
            }
          }
        } finally {
          runningIds.delete(subtask.id);
          emitConcurrency();
        }
      };

      // DAG scheduler loop
      const runningPromises: Promise<void>[] = [];

      while (!isDone()) {
        if (abortController.signal.aborted) break;

        const readySubtasks = Array.from(subtaskMap.values()).filter(isReady);
        const toStart = readySubtasks.slice(0, maxConcurrent - runningIds.size);

        for (const subtask of toStart) {
          const promise = runSubtask(subtask).finally(() => {
            const idx = runningPromises.indexOf(promise);
            if (idx !== -1) runningPromises.splice(idx, 1);
          });
          runningPromises.push(promise);
        }

        if (runningPromises.length === 0) {
          const pending = Array.from(subtaskMap.values()).filter((s) => s.status === 'pending');
          if (pending.length > 0) {
            for (const s of pending) {
              s.status = 'skipped';
              subtaskMap.set(s.id, s);
            }
          }
          break;
        }

        await Promise.race(runningPromises);
      }

      if (runningPromises.length > 0) {
        await Promise.allSettled(runningPromises);
      }

      // ── Phase 3: Result Synthesis ────────────────────────────────────────────
      const provider = providerRegistry.getActive();
      const completedResults = Array.from(subtaskMap.values())
        .filter((s) => s.status === 'completed')
        .map((s) => `### ${s.title}\n${s.result ?? ''}`)
        .join('\n\n');

      let finalResult = '';
      try {
        const synthesis = await provider.chat({
          model,
          messages: [
            {
              role: 'system',
              content: '당신은 태스크 결과 요약 전문가입니다. 여러 서브태스크 결과를 하나의 명확하고 포괄적인 최종 결과물로 통합하세요.',
            },
            {
              role: 'user',
              content: `목표: ${objective}\n\n서브태스크 결과:\n${completedResults}\n\n최종 결과를 요약하세요.`,
            },
          ],
          stream: false,
        });
        finalResult = synthesis.message.content;
      } catch {
        finalResult = completedResults || '태스크가 완료되었지만 결과 합성에 실패했습니다.';
      }

      // ── Phase 3.5: QA Review ─────────────────────────────────────────────────
      let qaVerdict: QAVerdict | undefined;
      let qaSummary: string | undefined;

      if (options.enableQA && !abortController.signal.aborted) {
        qaVerdict = 'pass';
        qaSummary = '';

        const qaAgents = ['tester', 'reviewer'];
        options.onEvent({
          type: 'auto_task_qa_start',
          runId,
          agents: qaAgents,
        });

        const qaPromptBase = `## QA 평가 대상\n\n**목표:** ${objective}\n\n**최종 결과:**\n${finalResult.slice(0, 3000)}\n\n**서브태스크 요약:**\n${completedResults.slice(0, 2000)}`;

        const qaResults = await dispatchSubAgentsSync([
          {
            role: 'tester',
            prompt: `${qaPromptBase}\n\n위 태스크 결과를 QA 관점에서 평가하세요.\n\n반드시 다음 JSON 형식으로만 답변하세요:\n{"verdict":"pass|fail|warning","score":0-100,"findings":"상세 평가 내용"}`,
            model,
          },
          {
            role: 'reviewer',
            prompt: `${qaPromptBase}\n\n위 태스크 결과를 코드 품질/완성도 관점에서 평가하세요.\n\n반드시 다음 JSON 형식으로만 답변하세요:\n{"verdict":"pass|fail|warning","score":0-100,"findings":"상세 평가 내용"}`,
            model,
          },
        ], {
          defaultModel: model,
          maxConcurrent: 2,
          systemPrefix: '당신은 엄격한 QA 평가자입니다. 반드시 지정된 JSON 형식으로만 답변하세요.',
        });

        const verdictPriority: Record<QAVerdict, number> = { pass: 0, warning: 1, fail: 2 };
        let worstVerdict: QAVerdict = 'pass';
        const qaFindings: string[] = [];

        for (const result of qaResults) {
          let verdict: QAVerdict = 'warning';
          let findings = result.output;
          let score: number | undefined;

          try {
            const jsonStr = result.output.match(/\{[\s\S]*\}/)?.[0];
            if (jsonStr) {
              const parsed = JSON.parse(jsonStr) as { verdict?: string; score?: number; findings?: string };
              if (parsed.verdict === 'pass' || parsed.verdict === 'fail' || parsed.verdict === 'warning') {
                verdict = parsed.verdict;
              }
              findings = parsed.findings ?? result.output;
              score = typeof parsed.score === 'number' ? parsed.score : undefined;
            }
          } catch {
            // Parse failure — use raw output as findings
          }

          options.onEvent({
            type: 'auto_task_qa_result',
            runId,
            role: result.role,
            verdict,
            findings,
            score,
          });

          if (verdictPriority[verdict] > verdictPriority[worstVerdict]) {
            worstVerdict = verdict;
          }
          qaFindings.push(`[${result.role}] ${verdict}: ${findings.slice(0, 500)}`);
        }

        qaVerdict = worstVerdict;
        qaSummary = qaFindings.join('\n\n');

        options.onEvent({
          type: 'auto_task_qa_done',
          runId,
          overallVerdict: qaVerdict,
          summary: qaSummary,
        });
      }

      // ── Phase 4: Done ────────────────────────────────────────────────────────
      const successCount = Array.from(subtaskMap.values()).filter((s) => s.status === 'completed').length;

      options.onEvent({
        type: 'auto_task_done',
        runId,
        result: finalResult,
        totalTokens: 0,
        durationMs: Date.now() - startTime,
        subtaskCount: plan.subtasks.length,
        successCount,
        maxConcurrentUsed: maxConcurrent,
        qaVerdict,
        qaSummary,
      });
    } catch (err) {
      options.onEvent({
        type: 'auto_task_error',
        runId,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    } finally {
      this.activeAbortControllers.delete(runId);

      // Cleanup dynamic agents created for this run
      if (dynamicAgentsRegistered) {
        const removed = agentRegistry.cleanupByRunId(runId);
        for (const role of removed) {
          options.onEvent({
            type: 'auto_task_agent_removed',
            runId,
            role,
          });
        }
      }
    }
  }

  abort(runId: string): boolean {
    const controller = this.activeAbortControllers.get(runId);
    if (!controller) return false;
    controller.abort();
    return true;
  }
}

export const autoTaskOrchestrator = new AutoTaskOrchestrator();
