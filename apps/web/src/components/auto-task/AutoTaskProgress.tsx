'use client';

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
  sub_agent: '서브에이전트',
  cowork: '코워크',
  code_execution: '코드 실행',
};

const STATUS_ICONS: Record<string, string> = {
  pending: '○',
  running: '●',
  completed: '✓',
  failed: '✗',
  skipped: '–',
};

interface Props {
  subtasks: SubtaskDisplayState[];
}

export function AutoTaskProgress({ subtasks }: Props) {
  if (subtasks.length === 0) {
    return (
      <div className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>
        <p className="text-sm">서브태스크 대기 중...</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {subtasks.map((subtask, index) => {
        const color = TYPE_COLORS[subtask.type] ?? '#d4956b';
        const isRunning = subtask.status === 'running';
        const durationText = subtask.durationMs ? `${(subtask.durationMs / 1000).toFixed(1)}s` : '';

        return (
          <div
            key={subtask.subtaskId}
            className="flex gap-3 rounded-lg p-3 glass"
            style={{
              border: isRunning ? `1px solid ${color}40` : '1px solid var(--glass-border)',
              background: isRunning ? `${color}08` : 'transparent',
            }}
          >
            {/* Timeline line */}
            <div className="flex flex-col items-center">
              <div
                className={isRunning ? 'animate-pulse' : ''}
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: subtask.status === 'completed'
                    ? '#22c55e'
                    : subtask.status === 'failed'
                      ? '#ef4444'
                      : subtask.status === 'running'
                        ? color
                        : 'var(--color-text-muted)',
                  flexShrink: 0,
                  marginTop: 3,
                }}
              />
              {index < subtasks.length - 1 && (
                <div
                  style={{
                    width: 1,
                    flex: 1,
                    minHeight: 12,
                    background: 'var(--glass-border)',
                    marginTop: 4,
                  }}
                />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  {subtask.title}
                </span>
                <span
                  className="text-xs px-1.5 py-0.5 rounded"
                  style={{
                    background: `${color}20`,
                    color,
                    fontSize: '10px',
                  }}
                >
                  {TYPE_LABELS[subtask.type]}
                </span>
                <span
                  className="text-xs ml-auto"
                  style={{ color: 'var(--color-text-muted)', fontFamily: 'monospace' }}
                >
                  {STATUS_ICONS[subtask.status]} {durationText}
                </span>
              </div>
              {subtask.result && subtask.status === 'completed' && (
                <p
                  className="mt-1 text-xs line-clamp-2"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {subtask.result.slice(0, 150)}
                </p>
              )}
              {subtask.error && (
                <p
                  className="mt-1 text-xs"
                  style={{ color: '#ef4444' }}
                >
                  {subtask.error}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
