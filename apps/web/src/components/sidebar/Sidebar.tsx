'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useChatStore } from '@/store/chat.store';
import { useProjectStore } from '@/store/project.store';
import { ConversationList } from './ConversationList';
import { Logo } from '@/components/ui/Logo';
import { SkillsPanel } from '@/components/skills/SkillsPanel';
import { ComputerUsePanel } from '@/components/computer-use/ComputerUsePanel';
import { useCoworkStore } from '@/store/cowork.store';
import { useAutoTaskStore } from '@/store/auto-task.store';

export function Sidebar() {
  const router = useRouter();
  const loadConversations = useChatStore((s) => s.loadConversations);
  const reset = useChatStore((s) => s.reset);
  const loadProjects = useProjectStore((s) => s.loadProjects);
  const projects = useProjectStore((s) => s.projects);
  const currentProjectId = useProjectStore((s) => s.currentProjectId);
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject);
  const createProject = useProjectStore((s) => s.createProject);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [showProjects, setShowProjects] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [showMemory, setShowMemory] = useState(false);
  const [showSkills, setShowSkills] = useState(false);
  const [showComputerUse, setComputerUseOpen] = useState(false);
  const { setOpen: setCoworkOpen } = useCoworkStore();
  const { setOpen: setAutoTaskOpen } = useAutoTaskStore();
  const [memories, setMemories] = useState<Array<{id:string;content:string}>>([]);
  const [memoriesLoaded, setMemoriesLoaded] = useState(false);
  const [modelName, setModelName] = useState('local');

  useEffect(() => {
    loadConversations();
    loadProjects();
    fetch('/api/v1/models/default')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const general = data?.defaults?.general ?? data?.general;
        if (general) {
          const short = general.split(':')[0];
          setModelName(short.length > 12 ? short.slice(0, 12) : short);
        }
      })
      .catch(() => {});
    const interval = setInterval(loadConversations, 30_000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadConversations]);

  const handleNewChat = () => {
    reset();
    router.push('/chat');
    setIsMobileOpen(false);
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-20 md:hidden"
          style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Mobile toggle button */}
      <button
        className="fixed top-4 left-4 z-30 flex items-center justify-center w-8 h-8 rounded-lg md:hidden glass"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        aria-label="Toggle sidebar"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* Sidebar */}
      <aside
        className={[
          'flex flex-col w-64 h-full flex-shrink-0 glass-heavy',
          'transition-transform duration-200',
          'fixed md:relative z-30 md:z-auto',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        ].join(' ')}
        style={{
          boxShadow: 'var(--shadow-lg)',
          borderRight: '1px solid var(--glass-border)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-4"
          style={{ borderBottom: '1px solid var(--glass-border)' }}
        >
          <Link
            href="/chat"
            className="flex items-center gap-2.5 group"
            onClick={() => setIsMobileOpen(false)}
          >
            <div
              className="flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0 animate-pulse-glow"
              style={{
                background: 'linear-gradient(135deg, var(--color-accent-primary), #b87a50)',
              }}
            >
              <Logo size={14} color="white" />
            </div>
            <span
              className="font-semibold text-sm tracking-tight"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Liminal
            </span>
          </Link>

          {/* Model badge */}
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{
              background: 'var(--color-accent-subtle)',
              color: 'var(--color-accent-primary)',
              border: '1px solid rgba(212,149,107,0.15)',
              boxShadow: '0 0 10px rgba(212,149,107,0.05)',
            }}
          >
            {modelName}
          </span>
        </div>

        {/* New Chat Button */}
        <div className="px-3 py-3">
          <button
            onClick={handleNewChat}
            className="new-chat-btn glow-hover btn-ripple w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium cursor-pointer"
            style={{
              background: 'var(--color-accent-subtle)',
              color: 'var(--color-accent-primary)',
              border: '1px solid rgba(212,149,107,0.15)',
            }}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New conversation
          </button>
        </div>

        {/* Projects */}
        <div className="px-3 pb-2">
          <button
            onClick={() => setShowProjects(s => !s)}
            className="section-toggle w-full flex items-center justify-between px-2 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-lg"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <span>Projects</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              style={{ transform: showProjects ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s var(--ease-spring)' }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {showProjects && (
            <div className="mt-1 space-y-0.5">
              <button
                onClick={() => { setCurrentProject(null); }}
                className="sidebar-item w-full text-left px-2 py-1.5 rounded-lg text-xs"
                style={{
                  background: currentProjectId === null ? 'var(--color-bg-elevated)' : 'transparent',
                  color: currentProjectId === null ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                }}
              >
                (No project)
              </button>
              {projects.map(p => (
                <button
                  key={p.id}
                  onClick={() => setCurrentProject(p.id)}
                  className="sidebar-item w-full text-left px-2 py-1.5 rounded-lg text-xs truncate"
                  style={{
                    background: currentProjectId === p.id ? 'var(--color-bg-elevated)' : 'transparent',
                    color: currentProjectId === p.id ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
                  }}
                  title={p.name}
                >
                  {p.name}
                </button>
              ))}
              {showNewProject ? (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!newProjectName.trim()) return;
                    await createProject({ name: newProjectName.trim() });
                    setNewProjectName('');
                    setShowNewProject(false);
                  }}
                  className="flex gap-1 mt-1"
                >
                  <input
                    autoFocus
                    value={newProjectName}
                    onChange={e => setNewProjectName(e.target.value)}
                    placeholder="Project name"
                    className="flex-1 text-xs px-2 py-1 rounded-lg bg-transparent border focus:outline-none neon-focus"
                    style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-primary)' }}
                  />
                  <button type="submit" className="text-xs px-2 py-1 rounded-lg btn-ripple" style={{ background: 'var(--color-accent-primary)', color: 'white' }}>+</button>
                  <button type="button" onClick={() => setShowNewProject(false)} className="text-xs px-1" style={{ color: 'var(--color-text-muted)' }}>✕</button>
                </form>
              ) : (
                <button
                  onClick={() => setShowNewProject(true)}
                  className="sidebar-item w-full text-left px-2 py-1.5 rounded-lg text-xs"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  + New project
                </button>
              )}
            </div>
          )}
        </div>

        {/* Conversations */}
        <div className="flex-1 overflow-y-auto px-2 pb-4">
          <ConversationList onSelect={() => setIsMobileOpen(false)} />
        </div>

        {/* Cowork */}
        <div className="px-3 py-2" style={{ borderTop: '1px solid var(--glass-border)' }}>
          <button
            onClick={() => setCoworkOpen(true)}
            className="section-toggle w-full flex items-center gap-2 px-2 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-lg glow-hover"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span>Cowork</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto' }}>
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        {/* Computer Use */}
        <div className="px-3 py-1">
          <button
            onClick={() => setComputerUseOpen(true)}
            className="section-toggle w-full flex items-center gap-2 px-2 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-lg glow-hover"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            <span>Computer Use</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: 'auto' }}>
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        {/* Auto Task */}
        <div className="px-3 py-1">
          <button
            onClick={() => setAutoTaskOpen(true)}
            className="section-toggle w-full flex items-center gap-2 px-2 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-lg glow-hover"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            <span>Auto Task</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: 'auto' }}>
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        {/* Skills section */}
        <div className="px-3 py-2" style={{ borderTop: '1px solid var(--glass-border)' }}>
          <button
            onClick={() => setShowSkills(s => !s)}
            className="section-toggle w-full flex items-center justify-between px-2 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-lg"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <span>Skills</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              style={{ transform: showSkills ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s var(--ease-spring)' }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {showSkills && (
            <div className="mt-1 max-h-60 overflow-y-auto">
              <SkillsPanel />
            </div>
          )}
        </div>

        {/* Memory section */}
        <div className="px-3 py-2" style={{ borderTop: '1px solid var(--glass-border)' }}>
          <button
            onClick={async () => {
              const next = !showMemory;
              setShowMemory(next);
              if (next && !memoriesLoaded) {
                try {
                  const resp = await fetch('/api/v1/memory');
                  if (resp.ok) {
                    const data = await resp.json();
                    setMemories(Array.isArray(data) ? data : []);
                    setMemoriesLoaded(true);
                  }
                } catch {
                  // ignore
                }
              }
            }}
            className="section-toggle w-full flex items-center justify-between px-2 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-lg"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <span>Memory</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              style={{ transform: showMemory ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s var(--ease-spring)' }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {showMemory && (
            <div className="mt-1 space-y-1 max-h-40 overflow-y-auto">
              {memories.length === 0 && (
                <p className="text-xs px-2 py-1" style={{ color: 'var(--color-text-muted)' }}>No memories yet</p>
              )}
              {memories.map((m) => (
                <div key={m.id} className="flex items-start gap-1 group">
                  <p className="flex-1 text-xs px-2 py-1 rounded glass" style={{ color: 'var(--color-text-secondary)' }}>
                    {m.content}
                  </p>
                  <button
                    onClick={async () => {
                      await fetch(`/api/v1/memory/${m.id}`, { method: 'DELETE' });
                      setMemories(prev => prev.filter(x => x.id !== m.id));
                    }}
                    className="opacity-0 group-hover:opacity-100 text-xs px-1 py-1 rounded flex-shrink-0"
                    style={{ color: 'var(--color-text-muted)' }}
                    title="Delete memory"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sidebar-footer-divider px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: 'white',
                boxShadow: '0 0 12px rgba(99,102,241,0.2)',
              }}
            >
              U
            </div>
            <div className="flex-1 min-w-0">
              <p
                className="text-xs font-medium truncate"
                style={{ color: 'var(--color-text-primary)' }}
              >
                User
              </p>
              <p
                className="text-xs truncate"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Free plan
              </p>
            </div>
            <Link
              href="/help"
              onClick={() => setIsMobileOpen(false)}
              className="settings-btn flex-shrink-0 p-1.5 rounded-lg"
              style={{ color: 'var(--color-text-muted)' }}
              title="Help & Guide"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </Link>
            <Link
              href="/settings"
              onClick={() => setIsMobileOpen(false)}
              className="settings-btn flex-shrink-0 p-1.5 rounded-lg"
              style={{ color: 'var(--color-text-muted)' }}
              title="Settings"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </Link>
          </div>
        </div>
      </aside>

      {/* Computer Use Panel */}
      <ComputerUsePanel isOpen={showComputerUse} onClose={() => setComputerUseOpen(false)} />
    </>
  );
}
