'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useChatStore } from '@/store/chat.store';
import { useSettingsStore } from '@/store/settings.store';
import { useArtifactStore } from '@/store/artifact.store';
import { useCoworkStore } from '@/store/cowork.store';
import { useAutoTaskStore } from '@/store/auto-task.store';

interface Command {
  id: string;
  label: string;
  shortcut?: string;
  action: () => void;
  category: string;
}

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const resetChat = useChatStore((s) => s.reset);
  const loadConversations = useChatStore((s) => s.loadConversations);
  const openSettings = useSettingsStore((s) => s.openSettings);
  const closeArtifact = useArtifactStore((s) => s.close);
  const setCoworkOpen = useCoworkStore((s) => s.setOpen);
  const setAutoTaskOpen = useAutoTaskStore((s) => s.setOpen);
  const resetAutoTask = useAutoTaskStore((s) => s.reset);

  const commands: Command[] = [
    {
      id: 'new-chat',
      label: 'New Conversation',
      shortcut: 'Ctrl+K',
      category: 'Chat',
      action: () => { resetChat(); router.push('/chat'); },
    },
    {
      id: 'settings',
      label: 'Open Settings',
      category: 'App',
      action: () => openSettings(),
    },
    {
      id: 'settings-models',
      label: 'Model Settings',
      category: 'App',
      action: () => openSettings('models'),
    },
    {
      id: 'settings-providers',
      label: 'Provider Settings',
      category: 'App',
      action: () => openSettings('providers'),
    },
    {
      id: 'close-artifact',
      label: 'Close Artifact Panel',
      shortcut: 'Ctrl+.',
      category: 'Artifact',
      action: () => closeArtifact(),
    },
    {
      id: 'shortcuts',
      label: 'Keyboard Shortcuts',
      category: 'Help',
      action: () => openSettings('shortcuts'),
    },
    {
      id: 'cowork',
      label: 'Start Cowork Session',
      shortcut: 'Ctrl+Shift+C',
      category: 'Cowork',
      action: () => setCoworkOpen(true),
    },
    {
      id: 'auto-task',
      label: 'Start Auto Task',
      shortcut: 'Ctrl+Shift+A',
      category: 'Auto Task',
      action: () => setAutoTaskOpen(true),
    },
    {
      id: 'auto-task-new',
      label: 'New Auto Task',
      category: 'Auto Task',
      action: () => { resetAutoTask(); setAutoTaskOpen(true); },
    },
    {
      id: 'computer-use',
      label: 'Open Computer Use',
      category: 'Tools',
      action: () => { /* ComputerUsePanel will be wired in when created */ },
    },
  ];

  const filtered = query
    ? commands.filter(
        (c) =>
          c.label.toLowerCase().includes(query.toLowerCase()) ||
          c.category.toLowerCase().includes(query.toLowerCase()),
      )
    : commands;

  const executeCommand = useCallback(
    (cmd: Command) => {
      cmd.action();
      setIsOpen(false);
      setQuery('');
    },
    [],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Shift+P — command palette
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        setIsOpen((v) => !v);
        return;
      }

      // Ctrl+K — new conversation
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        useChatStore.getState().reset();
        router.push('/chat');
        return;
      }

      // Ctrl+. — toggle artifact
      if ((e.ctrlKey || e.metaKey) && e.key === '.') {
        e.preventDefault();
        if (useArtifactStore.getState().isOpen) {
          useArtifactStore.getState().close();
        }
        return;
      }

      // Ctrl+Shift+C — open cowork
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        useCoworkStore.getState().setOpen(true);
        return;
      }

      // Ctrl+Shift+A — open auto task
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        autoTaskStore.setOpen(true);
        return;
      }

      // Escape
      if (e.key === 'Escape') {
        setIsOpen((prev) => {
          if (prev) {
            e.preventDefault();
            return false;
          }
          return prev;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
    setSelectedIndex(0);
    setQuery('');
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        executeCommand(filtered[selectedIndex]);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
      style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
      onClick={() => setIsOpen(false)}
    >
      <div
        className="w-full max-w-lg rounded-2xl overflow-hidden glass-heavy"
        style={{
          boxShadow: 'var(--shadow-xl)',
          border: '1px solid var(--glass-border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--glass-border)' }}>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command..."
            className="w-full text-sm bg-transparent focus:outline-none"
            style={{ color: 'var(--color-text-primary)' }}
          />
        </div>

        {/* Commands list */}
        <div className="max-h-80 overflow-y-auto py-1">
          {filtered.map((cmd, i) => (
            <button
              key={cmd.id}
              onClick={() => executeCommand(cmd)}
              className="w-full text-left flex items-center justify-between px-4 py-2.5 text-sm"
              style={{
                background: i === selectedIndex ? 'var(--color-bg-active)' : 'transparent',
                color: i === selectedIndex ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              }}
            >
              <div className="flex items-center gap-3">
                <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--color-bg-elevated)', color: 'var(--color-text-muted)' }}>
                  {cmd.category}
                </span>
                <span>{cmd.label}</span>
              </div>
              {cmd.shortcut && (
                <kbd className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--color-bg-elevated)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {cmd.shortcut}
                </kbd>
              )}
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="px-4 py-4 text-sm text-center" style={{ color: 'var(--color-text-muted)' }}>
              No commands found
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
