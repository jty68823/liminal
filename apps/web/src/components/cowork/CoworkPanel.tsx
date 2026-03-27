'use client';

import { useEffect, useRef } from 'react';
import { useCoworkStore } from '@/store/cowork.store';
import { AgentCard } from './AgentCard';
import { CoworkSetup } from './CoworkSetup';

export function CoworkPanel() {
  const { isOpen, status, task, agents, messages, setOpen, setWorkspaceOpen, startSession, addMessage, setStatus, reset, agentWorkStatuses } = useCoworkStore();
  const eventSourceRef = useRef<EventSource | null>(null);

  // Cleanup EventSource when panel unmounts or session ends
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  if (!isOpen) return null;

  const closeEventSource = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  };

  const handleStart = async () => {
    const enabledAgents = agents.filter((a) => a.enabled);
    if (!task.trim() || enabledAgents.length === 0) return;

    try {
      // Create session
      const res = await fetch('/api/v1/cowork', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task, agents: enabledAgents, mode: 'pipeline' }),
      });
      const data = await res.json() as { session?: { id: string } };
      if (!data.session) return;

      startSession(data.session.id);

      // Close any existing EventSource before creating a new one
      closeEventSource();

      // Start SSE stream
      const eventSource = new EventSource(`${window.location.origin}/api/v1/cowork/${data.session.id}/start`);
      eventSourceRef.current = eventSource;

      eventSource.onmessage = (event) => {
        const parsed = JSON.parse(event.data) as {
          type: string;
          agent_role?: string;
          content?: string;
          sequence?: number;
          status?: string;
          error?: string;
        };

        if (parsed.type === 'agent_message') {
          addMessage({
            agentRole: parsed.agent_role ?? 'unknown',
            content: parsed.content ?? '',
            sequence: parsed.sequence ?? 0,
            timestamp: Date.now(),
          });
        } else if (parsed.type === 'done') {
          setStatus('completed');
          const now = Date.now();
          useCoworkStore.setState((state) => ({
            agentWorkStatuses: state.agentWorkStatuses.map((ws) =>
              ws.status === 'working' || ws.status === 'idle'
                ? { ...ws, status: 'done' as const, finishedAt: now }
                : ws
            ),
          }));
          closeEventSource();
        } else if (parsed.type === 'error') {
          setStatus('failed');
          closeEventSource();
        }
      };

      eventSource.onerror = () => {
        setStatus('failed');
        closeEventSource();
      };
    } catch {
      setStatus('failed');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="glass-heavy rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col m-4" style={{ border: '1px solid var(--color-border)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Cowork — Multi-Agent Collaboration
          </h2>
          <div className="flex items-center gap-2">
            {status !== 'idle' && (
              <span className="text-xs px-2 py-0.5 rounded-full" style={{
                color: status === 'completed' ? '#4caf7d' : status === 'failed' ? '#ef4444' : 'var(--color-accent-primary)',
                background: status === 'completed' ? 'rgba(76,175,125,0.1)' : status === 'failed' ? 'rgba(239,68,68,0.1)' : 'var(--color-accent-subtle)',
              }}>
                {status}
              </span>
            )}
            {status !== 'idle' && agentWorkStatuses.length > 0 && (
              <button
                onClick={() => { setWorkspaceOpen(true); setOpen(false); }}
                className="text-xs px-2 py-0.5 rounded-full glow-hover"
                style={{
                  color: 'var(--color-accent-primary)',
                  background: 'var(--color-accent-subtle)',
                  border: '1px solid var(--color-accent-primary)33',
                }}
              >
                View Workspace
              </button>
            )}
            <button
              onClick={() => { closeEventSource(); setOpen(false); reset(); }}
              className="text-sm"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Close
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {status === 'idle' ? (
            <CoworkSetup />
          ) : (
            <div className="space-y-3">
              {messages.map((msg, i) => (
                <AgentCard key={i} role={msg.agentRole} content={msg.content} sequence={msg.sequence} />
              ))}
              {status === 'running' && messages.length > 0 && (
                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  <div className="animate-pulse-glow w-2 h-2 rounded-full" style={{ background: 'var(--color-accent-primary)' }} />
                  Agents working...
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {status === 'idle' && (
          <div className="px-4 py-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
            <button
              onClick={handleStart}
              disabled={!task.trim() || agents.filter((a) => a.enabled).length === 0}
              className="w-full glow-hover btn-ripple px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-30"
              style={{ background: 'var(--color-accent-primary)', color: '#fff' }}
            >
              Start Collaboration
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
