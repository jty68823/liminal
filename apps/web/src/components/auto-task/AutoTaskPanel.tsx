'use client';

import { useAutoTaskStore } from '@/store/auto-task.store';
import { useAutoTask } from '@/hooks/useAutoTask';
import { AutoTaskSecurity } from './AutoTaskSecurity';
import { AutoTaskResult } from './AutoTaskResult';
import { AutoTaskTimeline } from './AutoTaskTimeline';
import type { SecurityLevel, QAVerdict } from '@/types/auto-task';
import { useEffect, useRef } from 'react';

const VERDICT_STYLES: Record<QAVerdict, { bg: string; color: string; label: string }> = {
  pass: { bg: '#22c55e15', color: '#22c55e', label: '통과' },
  warning: { bg: '#f59e0b15', color: '#f59e0b', label: '경고' },
  fail: { bg: '#ef444415', color: '#ef4444', label: '실패' },
};

const PHASE_LABELS: Record<string, { label: string; icon: string }> = {
  idle: { label: '대기 중', icon: '○' },
  planning: { label: '플래닝', icon: '◉' },
  executing: { label: '실행 중', icon: '▶' },
  qa: { label: 'QA 검토', icon: '◈' },
  completed: { label: '완료', icon: '✓' },
  failed: { label: '실패', icon: '✗' },
  cancelled: { label: '취소됨', icon: '–' },
};

function formatDuration(ms: number): string {
  if (ms < 1000) return '< 1s';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}m ${remaining}s`;
}

export function AutoTaskPanel() {
  const store = useAutoTaskStore();
  const { start, cancel } = useAutoTask();
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Refresh progress every second while executing for live time tracking
  useEffect(() => {
    if (store.status === 'executing' || store.status === 'qa') {
      progressIntervalRef.current = setInterval(() => {
        store.refreshProgress();
      }, 1000);
    }
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
  }, [store.status, store]);

  if (!store.isOpen) return null;

  const isIdle = store.status === 'idle';
  const isPlanning = store.status === 'planning';
  const isExecuting = store.status === 'executing';
  const isQA = store.status === 'qa';
  const isCompleted = store.status === 'completed';
  const isFailed = store.status === 'failed';
  const isCancelled = store.status === 'cancelled';
  const isActive = isPlanning || isExecuting || isQA;

  const handleStart = async () => {
    if (!store.objective.trim()) return;
    await start(store.objective, store.securityLevel);
  };

  const handleReset = () => {
    store.reset();
  };

  const activeAgents = store.dynamicAgents.filter((a) => a.status === 'active');
  const progress = store.progress;
  const phase = PHASE_LABELS[store.status] ?? PHASE_LABELS.idle;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-30"
        style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(6px)' }}
        onClick={() => { if (!isActive) store.setOpen(false); }}
      />

      {/* Panel */}
      <div
        className="fixed top-0 right-0 h-full z-40 flex flex-col glass-heavy"
        style={{
          width: 'min(620px, 95vw)',
          boxShadow: 'var(--shadow-lg)',
          borderLeft: '1px solid var(--glass-border)',
          animation: 'slideInRight 0.25s var(--ease-spring)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--glass-border)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className={isActive ? 'animate-pulse' : ''}
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: isCompleted ? '#22c55e'
                  : isFailed ? '#ef4444'
                  : isQA ? '#06b6d4'
                  : isActive ? 'var(--color-accent-primary)'
                  : 'var(--color-text-muted)',
                boxShadow: isActive
                  ? `0 0 12px ${isQA ? '#06b6d480' : 'var(--color-accent-primary)80'}`
                  : 'none',
              }}
            />
            <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              Auto Task
            </h2>
            {store.status !== 'idle' && (
              <span
                className="text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1.5"
                style={{
                  background: isCompleted ? '#22c55e15' : isFailed || isCancelled ? '#ef444415' : isQA ? '#06b6d415' : isActive ? 'var(--color-accent-primary)15' : 'var(--color-bg-secondary)',
                  color: isCompleted ? '#22c55e' : isFailed || isCancelled ? '#ef4444' : isQA ? '#06b6d4' : isActive ? 'var(--color-accent-primary)' : 'var(--color-text-muted)',
                  border: `1px solid ${isCompleted ? '#22c55e20' : isFailed || isCancelled ? '#ef444420' : isQA ? '#06b6d420' : isActive ? 'var(--color-accent-primary)20' : 'var(--glass-border)'}`,
                }}
              >
                <span style={{ fontSize: '10px' }}>{phase.icon}</span>
                {phase.label}
              </span>
            )}
          </div>
          <button
            onClick={() => { if (!isActive) store.setOpen(false); }}
            disabled={isActive}
            className="rounded-lg p-1.5 transition-colors"
            style={{
              color: isActive ? 'var(--color-text-muted)' : 'var(--color-text-secondary)',
              opacity: isActive ? 0.4 : 1,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Progress Overview Bar — show during active phases */}
        {(isExecuting || isQA || isCompleted || isFailed) && progress && (
          <div
            className="px-5 py-3 flex-shrink-0"
            style={{ borderBottom: '1px solid var(--glass-border)', background: 'var(--color-bg-secondary)' }}
          >
            {/* Progress bar */}
            <div className="flex items-center gap-3 mb-2">
              <div
                className="flex-1 rounded-full overflow-hidden"
                style={{ height: 6, background: 'var(--glass-border)' }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${isCompleted ? 100 : progress.progressPercent}%`,
                    background: isFailed ? '#ef4444'
                      : isCompleted ? '#22c55e'
                      : isQA ? 'linear-gradient(90deg, var(--color-accent-primary), #06b6d4)'
                      : 'linear-gradient(90deg, var(--color-accent-primary), var(--color-accent-hover))',
                    borderRadius: 'inherit',
                    transition: 'width 0.5s var(--ease-smooth)',
                    boxShadow: isActive ? '0 0 8px var(--color-accent-primary)40' : 'none',
                  }}
                />
              </div>
              <span
                className="text-xs font-mono font-semibold tabular-nums"
                style={{
                  color: isCompleted ? '#22c55e'
                    : isFailed ? '#ef4444'
                    : 'var(--color-accent-primary)',
                  minWidth: 36,
                  textAlign: 'right',
                }}
              >
                {isCompleted ? '100' : progress.progressPercent}%
              </span>
            </div>

            {/* Stats row */}
            <div className="flex items-center justify-between text-xs" style={{ color: 'var(--color-text-muted)' }}>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span style={{ color: '#22c55e' }}>●</span>
                  {progress.completedSubtasks}/{progress.totalSubtasks}
                </span>
                {progress.failedSubtasks > 0 && (
                  <span className="flex items-center gap-1">
                    <span style={{ color: '#ef4444' }}>●</span>
                    {progress.failedSubtasks} 실패
                  </span>
                )}
                {progress.runningSubtasks > 0 && (
                  <span className="flex items-center gap-1">
                    <span style={{ color: 'var(--color-accent-primary)' }} className="animate-pulse">●</span>
                    {progress.runningSubtasks} 실행 중
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 font-mono tabular-nums">
                <span title="경과 시간">
                  {formatDuration(progress.elapsedMs)}
                </span>
                {progress.estimatedRemainingMs !== null && isActive && (
                  <span style={{ color: 'var(--color-accent-primary)' }} title="예상 남은 시간">
                    ~{formatDuration(progress.estimatedRemainingMs)}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Setup form — show when idle or cancelled */}
          {(isIdle || isCancelled) && (
            <>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                  목표 (Objective)
                </label>
                <textarea
                  value={store.objective}
                  onChange={(e) => store.setObjective(e.target.value)}
                  placeholder="달성할 목표를 입력하세요. AI가 자동으로 계획을 수립하고 실행합니다.&#10;&#10;예: React 프로젝트에 다크모드를 추가하세요"
                  className="w-full rounded-lg p-3 text-sm resize-none glass neon-focus"
                  style={{
                    background: 'var(--color-bg-secondary)',
                    border: '1px solid var(--glass-border)',
                    color: 'var(--color-text-primary)',
                    minHeight: 120,
                  }}
                  rows={5}
                />
              </div>
              <AutoTaskSecurity
                value={store.securityLevel}
                onChange={(level: SecurityLevel) => store.setSecurityLevel(level)}
              />
            </>
          )}

          {/* Planning spinner */}
          {isPlanning && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              {/* Animated planning orb */}
              <div style={{ position: 'relative', width: 48, height: 48 }}>
                <div
                  className="animate-spin"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    border: '2px solid transparent',
                    borderTop: '2px solid var(--color-accent-primary)',
                    borderRight: '2px solid var(--color-accent-primary)60',
                    borderRadius: '50%',
                  }}
                />
                <div
                  className="animate-spin"
                  style={{
                    position: 'absolute',
                    inset: 6,
                    border: '2px solid transparent',
                    borderBottom: '2px solid #6366f1',
                    borderLeft: '2px solid #6366f180',
                    borderRadius: '50%',
                    animationDirection: 'reverse',
                    animationDuration: '1.5s',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    inset: 16,
                    borderRadius: '50%',
                    background: 'var(--color-accent-primary)',
                    opacity: 0.6,
                  }}
                  className="animate-pulse"
                />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  목표 분석 및 플래닝 중...
                </p>
                <p className="text-xs mt-1.5" style={{ color: 'var(--color-text-muted)' }}>
                  LLM이 서브태스크 DAG를 생성하고 있습니다
                </p>
                {store.startedAt && (
                  <p className="text-xs mt-1 font-mono tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
                    {formatDuration(Date.now() - store.startedAt)}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Dynamic Agents */}
          {activeAgents.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                동적 에이전트 ({activeAgents.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {store.dynamicAgents.map((agent) => (
                  <div
                    key={agent.role}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs"
                    style={{
                      background: agent.status === 'active' ? `${agent.color}15` : 'var(--color-bg-secondary)',
                      border: `1px solid ${agent.status === 'active' ? `${agent.color}40` : 'var(--glass-border)'}`,
                      color: agent.status === 'active' ? agent.color : 'var(--color-text-muted)',
                      opacity: agent.status === 'removed' ? 0.4 : 1,
                      transition: 'all 0.3s var(--ease-smooth)',
                    }}
                  >
                    <span>{agent.icon}</span>
                    <span className="font-medium">{agent.label}</span>
                    {agent.status === 'removed' && (
                      <span className="text-xs" style={{ fontSize: '9px' }}>삭제됨</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Plan Strategy — show when executing, qa, completed, or failed */}
          {(isExecuting || isQA || isCompleted || isFailed) && store.plan && (
            <div className="space-y-3">
              <div className="rounded-lg p-3 glass" style={{ border: '1px solid var(--glass-border)' }}>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>플랜 전략</p>
                  <span className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>
                    {store.plan.subtasks.length}단계
                  </span>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  {store.plan.reasoning.slice(0, 300)}
                </p>
              </div>
              <AutoTaskTimeline subtasks={store.subtaskStatuses} />
            </div>
          )}

          {/* QA in progress */}
          {isQA && (
            <div className="flex items-center gap-3 p-3 rounded-lg glass" style={{ border: '1px solid #06b6d430', background: '#06b6d408' }}>
              <div style={{ position: 'relative', width: 20, height: 20, flexShrink: 0 }}>
                <div
                  className="animate-spin"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    border: '2px solid transparent',
                    borderTop: '2px solid #06b6d4',
                    borderRadius: '50%',
                  }}
                />
              </div>
              <div>
                <p className="text-xs font-medium" style={{ color: '#06b6d4' }}>
                  QA 검토 진행 중
                </p>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  tester + reviewer 에이전트가 결과를 평가하고 있습니다
                </p>
              </div>
            </div>
          )}

          {/* QA Results */}
          {store.qaResults.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                QA 평가 결과
              </p>
              {store.qaResults.map((qa) => {
                const style = VERDICT_STYLES[qa.verdict];
                return (
                  <div
                    key={qa.role}
                    className="rounded-lg p-3"
                    style={{ background: style.bg, border: `1px solid ${style.color}30` }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold" style={{ color: style.color }}>
                        {qa.role === 'tester' ? 'Tester' : 'Reviewer'}
                      </span>
                      <div className="flex items-center gap-2">
                        {qa.score !== undefined && (
                          <div className="flex items-center gap-1.5">
                            <div
                              className="rounded-full overflow-hidden"
                              style={{ width: 40, height: 4, background: `${style.color}20` }}
                            >
                              <div
                                style={{
                                  height: '100%',
                                  width: `${qa.score}%`,
                                  background: style.color,
                                  borderRadius: 'inherit',
                                }}
                              />
                            </div>
                            <span className="text-xs font-mono" style={{ color: style.color }}>
                              {qa.score}
                            </span>
                          </div>
                        )}
                        <span
                          className="text-xs px-1.5 py-0.5 rounded font-medium"
                          style={{ background: `${style.color}20`, color: style.color }}
                        >
                          {style.label}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                      {qa.findings.slice(0, 300)}
                    </p>
                  </div>
                );
              })}
              {store.qaOverallVerdict && (
                <div
                  className="rounded-lg p-2.5 text-center"
                  style={{
                    background: VERDICT_STYLES[store.qaOverallVerdict].bg,
                    border: `1px solid ${VERDICT_STYLES[store.qaOverallVerdict].color}30`,
                  }}
                >
                  <span className="text-xs font-semibold" style={{ color: VERDICT_STYLES[store.qaOverallVerdict].color }}>
                    종합 평가: {VERDICT_STYLES[store.qaOverallVerdict].label}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Result */}
          {isCompleted && store.resultText && (
            <AutoTaskResult result={store.resultText} durationMs={store.totalDurationMs ?? undefined} />
          )}

          {/* Error */}
          {isFailed && store.error && (
            <div
              className="rounded-lg p-4"
              style={{
                background: '#ef444410',
                border: '1px solid #ef444430',
              }}
            >
              <p className="text-xs font-semibold mb-1" style={{ color: '#ef4444' }}>오류 발생</p>
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{store.error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center gap-3 px-5 py-4 flex-shrink-0"
          style={{ borderTop: '1px solid var(--glass-border)' }}
        >
          {isIdle && (
            <button
              onClick={() => { void handleStart(); }}
              disabled={!store.objective.trim()}
              className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold btn-ripple glow-hover"
              style={{
                background: store.objective.trim()
                  ? 'linear-gradient(135deg, var(--color-accent-primary), var(--color-accent-hover))'
                  : 'var(--color-bg-secondary)',
                color: store.objective.trim() ? '#fff' : 'var(--color-text-muted)',
                opacity: store.objective.trim() ? 1 : 0.5,
                cursor: store.objective.trim() ? 'pointer' : 'not-allowed',
                boxShadow: store.objective.trim() ? '0 0 20px var(--color-accent-primary)20' : 'none',
              }}
            >
              Auto Task 시작
            </button>
          )}
          {isActive && (
            <button
              onClick={() => { void cancel(); }}
              className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium"
              style={{
                background: '#ef444415',
                color: '#ef4444',
                border: '1px solid #ef444430',
              }}
            >
              취소
            </button>
          )}
          {(isCompleted || isFailed || isCancelled) && (
            <>
              <button
                onClick={handleReset}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium glow-hover"
                style={{
                  background: 'var(--color-bg-secondary)',
                  color: 'var(--color-text-secondary)',
                  border: '1px solid var(--glass-border)',
                }}
              >
                새 태스크
              </button>
              {isCompleted && store.totalDurationMs && (
                <span className="text-xs font-mono tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
                  {formatDuration(store.totalDurationMs)}
                </span>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
