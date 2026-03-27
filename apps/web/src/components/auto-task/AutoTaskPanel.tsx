'use client';

import { useAutoTaskStore } from '@/store/auto-task.store';
import { useAutoTask } from '@/hooks/useAutoTask';
import { AutoTaskSecurity } from './AutoTaskSecurity';
import { AutoTaskProgress } from './AutoTaskProgress';
import { AutoTaskResult } from './AutoTaskResult';
import type { SecurityLevel, QAVerdict } from '@/types/auto-task';

const VERDICT_STYLES: Record<QAVerdict, { bg: string; color: string; label: string }> = {
  pass: { bg: '#22c55e15', color: '#22c55e', label: '통과' },
  warning: { bg: '#f59e0b15', color: '#f59e0b', label: '경고' },
  fail: { bg: '#ef444415', color: '#ef4444', label: '실패' },
};

export function AutoTaskPanel() {
  const store = useAutoTaskStore();
  const { start, cancel } = useAutoTask();

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

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-30"
        style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)' }}
        onClick={() => { if (!isActive) store.setOpen(false); }}
      />

      {/* Panel */}
      <div
        className="fixed top-0 right-0 h-full z-40 flex flex-col glass-heavy"
        style={{
          width: 'min(560px, 95vw)',
          boxShadow: 'var(--shadow-lg)',
          borderLeft: '1px solid var(--glass-border)',
          animation: 'slideInRight 0.2s var(--ease-spring)',
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
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: isCompleted ? '#22c55e' : isFailed ? '#ef4444' : isActive ? 'var(--color-accent-primary)' : 'var(--color-text-muted)',
              }}
            />
            <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              Auto Task
            </h2>
            {store.status !== 'idle' && (
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{
                  background: isCompleted ? '#22c55e20' : isFailed || isCancelled ? '#ef444420' : isActive ? 'var(--color-accent-primary)20' : 'var(--color-bg-secondary)',
                  color: isCompleted ? '#22c55e' : isFailed || isCancelled ? '#ef4444' : isActive ? 'var(--color-accent-primary)' : 'var(--color-text-muted)',
                }}
              >
                {store.status === 'planning' ? '플래닝 중' :
                 store.status === 'executing' ? '실행 중' :
                 store.status === 'qa' ? 'QA 검토 중' :
                 store.status === 'completed' ? '완료' :
                 store.status === 'failed' ? '실패' :
                 store.status === 'cancelled' ? '취소됨' : ''}
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
                  placeholder="달성할 목표를 입력하세요. AI가 자동으로 계획을 수립하고 실행합니다."
                  className="w-full rounded-lg p-3 text-sm resize-none glass neon-focus"
                  style={{
                    background: 'var(--color-bg-secondary)',
                    border: '1px solid var(--glass-border)',
                    color: 'var(--color-text-primary)',
                    minHeight: 100,
                  }}
                  rows={4}
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
              <div
                className="animate-spin"
                style={{
                  width: 32,
                  height: 32,
                  border: '3px solid var(--glass-border)',
                  borderTop: '3px solid var(--color-accent-primary)',
                  borderRadius: '50%',
                }}
              />
              <div className="text-center">
                <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  목표 분석 및 플래닝 중...
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                  LLM이 서브태스크 DAG를 생성하고 있습니다
                </p>
              </div>
            </div>
          )}

          {/* Dynamic Agents */}
          {activeAgents.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                동적 에이전트
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
                      transition: 'opacity 0.3s',
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

          {/* Progress — show when executing, qa, completed, or failed */}
          {(isExecuting || isQA || isCompleted || isFailed) && store.plan && (
            <div className="space-y-3">
              <div className="rounded-lg p-3 glass" style={{ border: '1px solid var(--glass-border)' }}>
                <p className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>플랜 전략</p>
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                  {store.plan.reasoning.slice(0, 200)}
                </p>
              </div>
              <AutoTaskProgress subtasks={store.subtaskStatuses} />
            </div>
          )}

          {/* QA in progress */}
          {isQA && (
            <div className="flex items-center gap-3 p-3 rounded-lg glass" style={{ border: '1px solid var(--glass-border)' }}>
              <div
                className="animate-spin"
                style={{
                  width: 16,
                  height: 16,
                  border: '2px solid var(--glass-border)',
                  borderTop: '2px solid #06b6d4',
                  borderRadius: '50%',
                  flexShrink: 0,
                }}
              />
              <div>
                <p className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>
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
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium" style={{ color: style.color }}>
                        {qa.role === 'tester' ? 'Tester' : 'Reviewer'}
                      </span>
                      <div className="flex items-center gap-2">
                        {qa.score !== undefined && (
                          <span className="text-xs font-mono" style={{ color: style.color }}>
                            {qa.score}/100
                          </span>
                        )}
                        <span
                          className="text-xs px-1.5 py-0.5 rounded"
                          style={{ background: `${style.color}20`, color: style.color }}
                        >
                          {style.label}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      {qa.findings.slice(0, 200)}
                    </p>
                  </div>
                );
              })}
              {store.qaOverallVerdict && (
                <div
                  className="rounded-lg p-2 text-center"
                  style={{
                    background: VERDICT_STYLES[store.qaOverallVerdict].bg,
                    border: `1px solid ${VERDICT_STYLES[store.qaOverallVerdict].color}30`,
                  }}
                >
                  <span className="text-xs font-semibold" style={{ color: VERDICT_STYLES[store.qaOverallVerdict].color }}>
                    종합: {VERDICT_STYLES[store.qaOverallVerdict].label}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Result */}
          {isCompleted && store.resultText && (
            <AutoTaskResult result={store.resultText} />
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
                background: store.objective.trim() ? 'var(--color-accent-primary)' : 'var(--color-bg-secondary)',
                color: store.objective.trim() ? '#fff' : 'var(--color-text-muted)',
                opacity: store.objective.trim() ? 1 : 0.5,
                cursor: store.objective.trim() ? 'pointer' : 'not-allowed',
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
                background: '#ef444420',
                color: '#ef4444',
                border: '1px solid #ef444440',
              }}
            >
              취소
            </button>
          )}
          {(isCompleted || isFailed || isCancelled) && (
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
          )}
        </div>
      </div>
    </>
  );
}
