'use client';

import { useCoworkStore } from '@/store/cowork.store';

const ROLE_COLORS: Record<string, string> = {
  architect: '#6366f1',
  coder: '#22c55e',
  reviewer: '#f59e0b',
  tester: '#06b6d4',
  security: '#ef4444',
  researcher: '#8b5cf6',
};

export function CoworkSetup() {
  const { task, agents, setTask, toggleAgent } = useCoworkStore();

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--color-text-secondary)' }}>
          Task Description
        </label>
        <textarea
          value={task}
          onChange={(e) => setTask(e.target.value)}
          className="w-full glass rounded-lg px-3 py-2 text-sm resize-none"
          style={{ color: 'var(--color-text-primary)', minHeight: 80 }}
          placeholder="Describe the task for the agents..."
        />
      </div>
      <div>
        <label className="text-xs font-medium mb-2 block" style={{ color: 'var(--color-text-secondary)' }}>
          Agents
        </label>
        <div className="grid grid-cols-2 gap-2">
          {agents.map((agent) => (
            <button
              key={agent.role}
              onClick={() => toggleAgent(agent.role)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                agent.enabled ? 'glass' : 'opacity-40'
              }`}
              style={{
                borderLeft: `3px solid ${agent.enabled ? ROLE_COLORS[agent.role] ?? '#888' : 'transparent'}`,
                color: 'var(--color-text-secondary)',
              }}
            >
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                style={{
                  background: agent.enabled ? `${ROLE_COLORS[agent.role]}20` : 'transparent',
                  color: ROLE_COLORS[agent.role] ?? '#888',
                }}>
                {agent.role[0].toUpperCase()}
              </div>
              <span className="capitalize">{agent.role}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
