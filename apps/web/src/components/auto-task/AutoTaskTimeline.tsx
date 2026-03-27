'use client';

import { useState } from 'react';
import type { SubtaskDisplayState, SubtaskType } from '@/types/auto-task';

const TYPE_COLORS: Record<SubtaskType, string> = {
  tool_call: '#d4956b',
  web_search: '#8b5cf6',
  sub_agent: '#6366f1',
  cowork: '#22c55e',
  code_execution: '#06b6d4',
};

const TYPE_LABELS: Record<SubtaskType, string> = {
  tool_call: '도구',
  web_search: '검색',
  sub_agent: '에이전트',
  cowork: '코워크',
  code_execution: '실행',
};

const TYPE_ICONS: Record<SubtaskType, string> = {
  tool_call: '⚙',
  web_search: '🔍',
  sub_agent: '◆',
  cowork: '◇',
  code_execution: '▸',
};

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}

interface Props {
  subtasks: SubtaskDisplayState[];
}

export function AutoTaskTimeline({ subtasks }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (subtasks.length === 0) {
    return (
      <div className="text-center py-6" style={{ color: 'var(--color-text-muted)' }}>
        <p className="text-xs">서브태스크 대기 중...</p>
      </div>
    );
  }

  // Detect parallel groups: subtasks that could run concurrently (same dependencies)
  const parallelGroups: SubtaskDisplayState[][] = [];
  let currentGroup: SubtaskDisplayState[] = [];

  for (let i = 0; i < subtasks.length; i++) {
    const current = subtasks[i];
    if (currentGroup.length === 0) {
      currentGroup.push(current);
    } else {
      // Check if running simultaneously with previous (both running or overlapping times)
      const prev = currentGroup[0];
      const isParallel =
        (current.status === 'running' && prev.status === 'running') ||
        (current.startedAt && prev.startedAt && !prev.finishedAt);
      if (isParallel) {
        currentGroup.push(current);
      } else {
        parallelGroups.push(currentGroup);
        currentGroup = [current];
      }
    }
  }
  if (currentGroup.length > 0) {
    parallelGroups.push(currentGroup);
  }

  return (
    <div className="space-y-1">
      {subtasks.map((subtask, index) => {
        const color = TYPE_COLORS[subtask.type] ?? '#d4956b';
        const isRunning = subtask.status === 'running';
        const isCompleted = subtask.status === 'completed';
        const isFailed = subtask.status === 'failed';
        const isSkipped = subtask.status === 'skipped';
        const isPending = subtask.status === 'pending';
        const isExpanded = expandedId === subtask.subtaskId;

        const durationText = subtask.durationMs ? formatMs(subtask.durationMs) : '';
        const estimatedText = subtask.estimatedDurationMs && isPending ? `~${formatMs(subtask.estimatedDurationMs)}` : '';

        // Live elapsed for running tasks
        const liveElapsed = isRunning && subtask.startedAt
          ? formatMs(Date.now() - subtask.startedAt)
          : '';

        const statusColor = isCompleted ? '#22c55e'
          : isFailed ? '#ef4444'
          : isRunning ? color
          : isSkipped ? 'var(--color-text-muted)'
          : 'var(--glass-border)';

        return (
          <div key={subtask.subtaskId}>
            <button
              onClick={() => setExpandedId(isExpanded ? null : subtask.subtaskId)}
              className="w-full flex gap-2.5 rounded-lg p-2.5 text-left transition-all duration-150"
              style={{
                border: isRunning ? `1px solid ${color}30` : '1px solid transparent',
                background: isRunning ? `${color}06` : isExpanded ? 'var(--color-bg-secondary)' : 'transparent',
              }}
            >
              {/* Timeline dot + line */}
              <div className="flex flex-col items-center" style={{ width: 14, flexShrink: 0 }}>
                {/* Status dot */}
                <div
                  style={{
                    width: isRunning ? 12 : 8,
                    height: isRunning ? 12 : 8,
                    borderRadius: '50%',
                    background: statusColor,
                    flexShrink: 0,
                    marginTop: 3,
                    transition: 'all 0.2s',
                    boxShadow: isRunning ? `0 0 8px ${color}60` : 'none',
                  }}
                  className={isRunning ? 'animate-pulse' : ''}
                />
                {/* Connecting line */}
                {index < subtasks.length - 1 && (
                  <div
                    style={{
                      width: 1,
                      flex: 1,
                      minHeight: 8,
                      background: isCompleted ? '#22c55e30' : 'var(--glass-border)',
                      marginTop: 2,
                      transition: 'background 0.3s',
                    }}
                  />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* Type icon + title */}
                  <span style={{ fontSize: '10px', opacity: 0.7 }}>
                    {TYPE_ICONS[subtask.type]}
                  </span>
                  <span
                    className="text-xs font-medium truncate"
                    style={{
                      color: isPending || isSkipped ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
                      maxWidth: '65%',
                    }}
                  >
                    {subtask.title}
                  </span>

                  {/* Type badge */}
                  <span
                    className="text-xs px-1.5 py-0.5 rounded"
                    style={{
                      background: `${color}15`,
                      color: isPending ? 'var(--color-text-muted)' : color,
                      fontSize: '9px',
                      fontWeight: 600,
                      letterSpacing: '0.03em',
                    }}
                  >
                    {TYPE_LABELS[subtask.type]}
                  </span>

                  {/* Weight indicator */}
                  {subtask.weight && subtask.weight > 1 && (
                    <span
                      className="text-xs"
                      style={{ color: 'var(--color-text-muted)', fontSize: '9px' }}
                      title={`가중치: ${subtask.weight}`}
                    >
                      {'●'.repeat(subtask.weight)}
                    </span>
                  )}

                  {/* Status + timing on right */}
                  <span
                    className="text-xs ml-auto flex items-center gap-1.5 font-mono tabular-nums"
                    style={{ color: statusColor, flexShrink: 0 }}
                  >
                    {isRunning && liveElapsed && (
                      <span className="animate-pulse">{liveElapsed}</span>
                    )}
                    {isCompleted && durationText && (
                      <span>{durationText}</span>
                    )}
                    {isPending && estimatedText && (
                      <span style={{ color: 'var(--color-text-muted)', opacity: 0.6 }}>{estimatedText}</span>
                    )}
                    {isCompleted && <span>✓</span>}
                    {isFailed && <span>✗</span>}
                    {isSkipped && <span>–</span>}
                  </span>
                </div>
              </div>
            </button>

            {/* Expanded detail */}
            {isExpanded && (subtask.result || subtask.error) && (
              <div
                className="ml-7 mb-2 rounded-lg p-2.5 text-xs"
                style={{
                  background: 'var(--color-bg-secondary)',
                  border: '1px solid var(--glass-border)',
                  color: subtask.error ? '#ef4444' : 'var(--color-text-muted)',
                  maxHeight: 120,
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  lineHeight: 1.5,
                }}
              >
                {subtask.error ?? subtask.result?.slice(0, 500)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
