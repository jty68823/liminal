'use client';

interface Props {
  role: string;
  content: string;
  sequence: number;
}

const ROLE_COLORS: Record<string, string> = {
  architect: '#6366f1',
  coder: '#22c55e',
  reviewer: '#f59e0b',
  tester: '#06b6d4',
  security: '#ef4444',
  researcher: '#8b5cf6',
};

const ROLE_LABELS: Record<string, string> = {
  architect: 'Architect',
  coder: 'Coder',
  reviewer: 'Reviewer',
  tester: 'Tester',
  security: 'Security',
  researcher: 'Researcher',
};

export function AgentCard({ role, content, sequence }: Props) {
  const color = ROLE_COLORS[role] ?? '#888';
  const label = ROLE_LABELS[role] ?? role;

  return (
    <div className="glass rounded-lg p-3 message-enter-premium" style={{ borderLeft: `3px solid ${color}` }}>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
          style={{ background: `${color}20`, color }}>
          {label[0]}
        </div>
        <span className="text-sm font-medium" style={{ color }}>{label}</span>
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>#{sequence + 1}</span>
      </div>
      <div className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--color-text-secondary)' }}>
        {content.length > 500 ? content.slice(0, 500) + '...' : content}
      </div>
    </div>
  );
}
