'use client';

import { useCoworkStore, type AgentWorkStatus, type AgentStatus } from '@/store/cowork.store';

const ROLE_COLORS: Record<string, string> = {
  architect: '#6366f1',
  coder: '#22c55e',
  reviewer: '#f59e0b',
  tester: '#06b6d4',
  security: '#ef4444',
  researcher: '#8b5cf6',
};

const ROLE_ICONS: Record<string, string> = {
  architect: '🏗',
  coder: '💻',
  reviewer: '🔍',
  tester: '🧪',
  security: '🔒',
  researcher: '📚',
};

function StatusDot({ status }: { status: AgentStatus }) {
  const colorMap: Record<AgentStatus, string> = {
    idle: 'var(--color-text-muted)',
    working: 'var(--color-accent-primary)',
    done: '#4caf7d',
    failed: '#ef4444',
  };
  const isAnimated = status === 'working';
  return (
    <span
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: colorMap[status],
        flexShrink: 0,
        animation: isAnimated ? 'pulse-glow 1.5s ease-in-out infinite' : undefined,
      }}
    />
  );
}

function AgentWorkCard({ agentStatus, messages }: {
  agentStatus: AgentWorkStatus;
  messages: Array<{ agentRole: string; content: string; sequence: number; timestamp: number }>;
}) {
  const color = ROLE_COLORS[agentStatus.role] ?? '#888';
  const icon = ROLE_ICONS[agentStatus.role] ?? '🤖';
  const agentMessages = messages.filter((m) => m.agentRole === agentStatus.role);
  const latestMessage = agentMessages[agentMessages.length - 1];

  const elapsed = agentStatus.startedAt
    ? agentStatus.finishedAt
      ? Math.round((agentStatus.finishedAt - agentStatus.startedAt) / 1000)
      : Math.round((Date.now() - agentStatus.startedAt) / 1000)
    : null;

  return (
    <div
      className="rounded-xl p-3 flex flex-col gap-2"
      style={{
        background: 'var(--color-bg-secondary)',
        border: `1px solid ${color}33`,
        borderLeft: `3px solid ${color}`,
      }}
    >
      {/* Agent header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 16 }}>{icon}</span>
          <span className="text-xs font-semibold capitalize" style={{ color }}>
            {agentStatus.role}
          </span>
          <StatusDot status={agentStatus.status} />
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {agentStatus.status}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {agentStatus.messageCount > 0 && (
            <span>{agentStatus.messageCount} msg{agentStatus.messageCount !== 1 ? 's' : ''}</span>
          )}
          {elapsed !== null && (
            <span>{elapsed}s</span>
          )}
        </div>
      </div>

      {/* Latest activity */}
      {latestMessage ? (
        <div
          className="text-xs rounded-lg px-2 py-1.5"
          style={{
            background: 'var(--color-bg-tertiary)',
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-mono, monospace)',
            lineHeight: 1.5,
          }}
        >
          <span style={{ color: 'var(--color-text-muted)', marginRight: 4 }}>
            #{latestMessage.sequence}
          </span>
          {latestMessage.content.length > 200
            ? latestMessage.content.slice(0, 200) + '…'
            : latestMessage.content}
        </div>
      ) : agentStatus.status === 'idle' ? (
        <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Waiting to start…
        </div>
      ) : null}

      {/* Message history preview (last 3) */}
      {agentMessages.length > 1 && (
        <div className="flex flex-col gap-1 mt-1">
          {agentMessages.slice(-3, -1).reverse().map((msg, i) => (
            <div
              key={i}
              className="text-xs px-2 py-1 rounded"
              style={{
                background: `${color}10`,
                color: 'var(--color-text-muted)',
                fontFamily: 'var(--font-mono, monospace)',
              }}
            >
              <span style={{ color: `${color}80`, marginRight: 4 }}>#{msg.sequence}</span>
              {msg.content.length > 120 ? msg.content.slice(0, 120) + '…' : msg.content}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AgentWorkspacePanel() {
  const { isWorkspaceOpen, setWorkspaceOpen, status, task, agentWorkStatuses, messages, sessionId } = useCoworkStore();

  if (!isWorkspaceOpen) return null;

  const totalMessages = messages.length;
  const workingCount = agentWorkStatuses.filter((s) => s.status === 'working').length;
  const doneCount = agentWorkStatuses.filter((s) => s.status === 'done').length;

  return (
    <div
      className="fixed inset-0 z-40 flex items-stretch justify-end"
      style={{ background: 'rgba(0,0,0,0.35)', pointerEvents: 'auto' }}
      onClick={(e) => { if (e.target === e.currentTarget) setWorkspaceOpen(false); }}
    >
      <div
        className="glass-heavy flex flex-col h-full overflow-hidden"
        style={{
          width: 'min(480px, 95vw)',
          border: '1px solid var(--color-border)',
          borderRight: 'none',
          borderRadius: '16px 0 0 16px',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--color-border)' }}
        >
          <div className="flex flex-col gap-0.5">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              Agent Workspace
            </h2>
            {task && (
              <p className="text-xs truncate max-w-[280px]" style={{ color: 'var(--color-text-muted)' }}>
                {task}
              </p>
            )}
          </div>
          <button
            onClick={() => setWorkspaceOpen(false)}
            className="text-xs px-2 py-1 rounded-lg"
            style={{
              color: 'var(--color-text-muted)',
              background: 'var(--color-bg-tertiary)',
            }}
          >
            ✕
          </button>
        </div>

        {/* Stats bar */}
        <div
          className="flex items-center gap-4 px-4 py-2 flex-shrink-0 text-xs"
          style={{
            borderBottom: '1px solid var(--color-border)',
            background: 'var(--color-bg-secondary)',
          }}
        >
          <div className="flex items-center gap-1.5">
            <span style={{ color: 'var(--color-text-muted)' }}>Status:</span>
            <span
              className="font-medium"
              style={{
                color:
                  status === 'completed' ? '#4caf7d'
                  : status === 'failed' ? '#ef4444'
                  : status === 'running' ? 'var(--color-accent-primary)'
                  : 'var(--color-text-secondary)',
              }}
            >
              {status}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span style={{ color: 'var(--color-text-muted)' }}>Messages:</span>
            <span style={{ color: 'var(--color-text-secondary)' }}>{totalMessages}</span>
          </div>
          {workingCount > 0 && (
            <div className="flex items-center gap-1.5">
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: 'var(--color-accent-primary)', animation: 'pulse-glow 1.5s ease-in-out infinite' }}
              />
              <span style={{ color: 'var(--color-accent-primary)' }}>{workingCount} active</span>
            </div>
          )}
          {doneCount > 0 && (
            <div className="flex items-center gap-1.5">
              <span style={{ color: '#4caf7d' }}>{doneCount} done</span>
            </div>
          )}
          {sessionId && (
            <span className="ml-auto font-mono" style={{ color: 'var(--color-text-muted)', fontSize: 10 }}>
              {sessionId.slice(0, 8)}…
            </span>
          )}
        </div>

        {/* Agent cards */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {agentWorkStatuses.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center h-full text-center gap-3"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <div style={{ fontSize: 32 }}>🤖</div>
              <p className="text-sm">No active agents.</p>
              <p className="text-xs">Start a cowork session to see agent progress here.</p>
            </div>
          ) : (
            agentWorkStatuses.map((agentStatus) => (
              <AgentWorkCard
                key={agentStatus.role}
                agentStatus={agentStatus}
                messages={messages}
              />
            ))
          )}
        </div>

        {/* Footer: Full transcript toggle */}
        {messages.length > 0 && (
          <div
            className="px-4 py-3 flex-shrink-0"
            style={{ borderTop: '1px solid var(--color-border)' }}
          >
            <p className="text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>
              {totalMessages} total messages across {agentWorkStatuses.length} agents
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
