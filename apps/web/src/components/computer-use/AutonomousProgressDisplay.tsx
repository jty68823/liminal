'use client';

import React, { useState, useEffect, useRef } from 'react';

export interface AutonomousProgress {
  taskId: string;
  iteration: number;
  maxIterations: number;
  phase: 'observe' | 'analyze' | 'plan' | 'act' | 'verify';
  action?: string;
  screenshotBase64?: string;
  analysis?: string;
  goalMet: boolean;
}

interface Props {
  progress: AutonomousProgress;
}

const PHASE_LABELS: Record<string, string> = {
  observe: 'Observing screen',
  analyze: 'Analyzing',
  plan: 'Planning',
  act: 'Executing',
  verify: 'Verifying',
};

const PHASE_COLORS: Record<string, string> = {
  observe: '#56b6c2',
  analyze: '#c678dd',
  plan: '#e5c07b',
  act: '#61afef',
  verify: '#98c379',
};

export function AutonomousProgressDisplay({ progress }: Props) {
  const [showScreenshot, setShowScreenshot] = useState(false);
  const [logs, setLogs] = useState<Array<{ iteration: number; action: string; phase: string }>>([]);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (progress.action) {
      setLogs((prev) => {
        const next = [...prev, {
          iteration: progress.iteration,
          action: progress.action ?? '',
          phase: progress.phase,
        }];
        return next.slice(-10); // Keep last 10 entries
      });
    }
  }, [progress.iteration, progress.action, progress.phase]);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  const pct = Math.round((progress.iteration / progress.maxIterations) * 100);

  return (
    <div
      className="rounded-xl overflow-hidden glass mb-3"
      style={{ maxWidth: '480px' }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3.5 py-2.5"
        style={{ borderBottom: '1px solid var(--glass-border)' }}
      >
        <div
          className="w-2 h-2 rounded-full animate-pulse"
          style={{ background: PHASE_COLORS[progress.phase] ?? '#d4956b' }}
        />
        <span className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>
          Autonomous Task
        </span>
        <span className="text-xs ml-auto" style={{ color: 'var(--color-text-muted)' }}>
          {progress.iteration}/{progress.maxIterations}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="px-3.5 pt-2.5">
        <div
          className="h-1.5 rounded-full overflow-hidden"
          style={{ background: 'var(--color-bg-surface)' }}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${pct}%`,
              background: `linear-gradient(90deg, ${PHASE_COLORS[progress.phase] ?? '#d4956b'}, var(--color-accent-primary))`,
              transition: 'width 0.3s var(--ease-smooth)',
            }}
          />
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-xs" style={{ color: PHASE_COLORS[progress.phase] ?? '#d4956b' }}>
            {PHASE_LABELS[progress.phase] ?? progress.phase}
          </span>
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {pct}%
          </span>
        </div>
      </div>

      {/* Analysis */}
      {progress.analysis && (
        <div className="px-3.5 pt-2">
          <p
            className="text-xs leading-relaxed"
            style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic' }}
          >
            {progress.analysis.slice(0, 200)}
          </p>
        </div>
      )}

      {/* Action Log */}
      {logs.length > 0 && (
        <div
          ref={logRef}
          className="px-3.5 pt-2 max-h-28 overflow-y-auto"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {logs.map((log, idx) => (
            <div key={idx} className="flex items-start gap-1.5 py-0.5">
              <span className="text-xs flex-shrink-0" style={{ color: 'var(--color-text-muted)' }}>
                [{log.iteration}]
              </span>
              <span
                className="text-xs flex-shrink-0"
                style={{ color: PHASE_COLORS[log.phase] ?? '#abb2bf' }}
              >
                {log.phase}
              </span>
              <span className="text-xs truncate" style={{ color: 'var(--color-text-secondary)' }}>
                {log.action}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Screenshot Thumbnail */}
      {progress.screenshotBase64 && (
        <div className="px-3.5 pt-2 pb-3">
          <button
            onClick={() => setShowScreenshot(!showScreenshot)}
            className="text-xs glow-hover rounded-lg px-2 py-1"
            style={{
              color: 'var(--color-accent-primary)',
              border: '1px solid var(--color-border-subtle)',
            }}
          >
            {showScreenshot ? 'Hide Screenshot' : 'Show Screenshot'}
          </button>
          {showScreenshot && (
            <img
              src={progress.screenshotBase64}
              alt="Screen capture"
              className="mt-2 rounded-lg w-full"
              style={{
                border: '1px solid var(--color-border-subtle)',
                maxHeight: '200px',
                objectFit: 'contain',
              }}
            />
          )}
        </div>
      )}

      {/* Bottom padding when no screenshot */}
      {!progress.screenshotBase64 && <div className="pb-3" />}
    </div>
  );
}
