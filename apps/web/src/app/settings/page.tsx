'use client';

import React, { useEffect, useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Section = 'general' | 'models' | 'providers' | 'appearance' | 'shortcuts';

interface NavItem {
  id: Section;
  label: string;
  icon: React.JSX.Element;
}

interface ModelInfo {
  name: string;
  size: number;
  modified_at?: string;
  display_name: string;
  context_length: number | null;
  is_default: boolean;
  task_types: string[];
  provider: string;
}

interface ProviderInfo {
  id: string;
  displayName: string;
  isActive: boolean;
}

interface SettingEntry {
  key: string;
  value: unknown;
  updatedAt?: string;
}

type ConnectionState = 'idle' | 'checking' | 'ok' | 'error';
type FontSize = 'small' | 'medium' | 'large';

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconSettings() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}

function IconCpu() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="9" y="9" width="6" height="6" />
      <line x1="9" y1="1" x2="9" y2="4" />
      <line x1="15" y1="1" x2="15" y2="4" />
      <line x1="9" y1="20" x2="9" y2="23" />
      <line x1="15" y1="20" x2="15" y2="23" />
      <line x1="20" y1="9" x2="23" y2="9" />
      <line x1="20" y1="14" x2="23" y2="14" />
      <line x1="1" y1="9" x2="4" y2="9" />
      <line x1="1" y1="14" x2="4" y2="14" />
    </svg>
  );
}

function IconLayers() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

function IconPalette() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
      <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
      <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
      <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 011.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
    </svg>
  );
}

function IconKeyboard() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <line x1="6" y1="10" x2="6" y2="10" strokeWidth="2" strokeLinecap="round" />
      <line x1="10" y1="10" x2="10" y2="10" strokeWidth="2" strokeLinecap="round" />
      <line x1="14" y1="10" x2="14" y2="10" strokeWidth="2" strokeLinecap="round" />
      <line x1="18" y1="10" x2="18" y2="10" strokeWidth="2" strokeLinecap="round" />
      <line x1="6" y1="14" x2="6" y2="14" strokeWidth="2" strokeLinecap="round" />
      <line x1="18" y1="14" x2="18" y2="14" strokeWidth="2" strokeLinecap="round" />
      <line x1="10" y1="14" x2="14" y2="14" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconSpinner() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M21 12a9 9 0 11-6.219-8.56" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function IconChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ width, height = 16, className = '' }: { width?: string | number; height?: number; className?: string }) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{
        width: width ?? '100%',
        height,
        borderRadius: 'var(--radius-md)',
      }}
    />
  );
}

// ─── Section: General ─────────────────────────────────────────────────────────

interface SettingsMap {
  ollama_host?: string;
  default_model?: string;
  [key: string]: unknown;
}

function GeneralSection() {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<SettingsMap>({});
  const [ollamaHost, setOllamaHost] = useState('');
  const [defaultModel, setDefaultModel] = useState('');
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [connectionMsg, setConnectionMsg] = useState('');
  const [version] = useState('0.1.0');

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch('/api/v1/settings');
      if (resp.ok) {
        const data = await resp.json() as { settings: SettingEntry[] };
        const map: SettingsMap = {};
        for (const s of data.settings ?? []) {
          map[s.key] = s.value;
        }
        setSettings(map);
        setOllamaHost(typeof map.ollama_host === 'string' ? map.ollama_host : 'http://localhost:11434');
        setDefaultModel(typeof map.default_model === 'string' ? map.default_model : '');
      }
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, []);

  const loadModels = useCallback(async () => {
    setModelsLoading(true);
    try {
      const resp = await fetch('/api/v1/models');
      if (resp.ok) {
        const data = await resp.json() as { models: ModelInfo[] };
        setModels(data.models ?? []);
      }
    } catch {
      // non-fatal
    } finally {
      setModelsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
    loadModels();
  }, [loadSettings, loadModels]);

  const saveSetting = async (key: string, value: string) => {
    try {
      await fetch('/api/v1/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });
      setSettings((prev) => ({ ...prev, [key]: value }));
    } catch {
      // non-fatal
    }
  };

  const checkConnection = async () => {
    setConnectionState('checking');
    setConnectionMsg('');
    try {
      const resp = await fetch('/api/v1/models');
      if (resp.ok) {
        const data = await resp.json() as { models: ModelInfo[]; provider: string };
        const count = data.models?.length ?? 0;
        setConnectionState('ok');
        setConnectionMsg(`Connected · ${count} model${count !== 1 ? 's' : ''} available`);
        setModels(data.models ?? []);
      } else {
        setConnectionState('error');
        setConnectionMsg(`Error ${resp.status}: ${resp.statusText}`);
      }
    } catch (err) {
      setConnectionState('error');
      setConnectionMsg(err instanceof Error ? err.message : 'Connection failed');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton width={120} height={14} />
          <Skeleton height={80} />
        </div>
        <div className="space-y-2">
          <Skeleton width={160} height={14} />
          <Skeleton height={44} />
        </div>
        <div className="space-y-2">
          <Skeleton width={140} height={14} />
          <Skeleton height={44} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* App info */}
      <div
        className="glass rounded-2xl p-5"
        style={{ border: '1px solid var(--color-border-subtle)' }}
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-semibold text-gradient" style={{ marginBottom: 4 }}>
              Liminal
            </h3>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Local AI assistant powered by Ollama
            </p>
          </div>
          <span
            className="text-xs px-2.5 py-1 rounded-full font-mono"
            style={{
              background: 'var(--color-accent-subtle)',
              color: 'var(--color-accent-primary)',
              border: '1px solid rgba(212,149,107,0.2)',
            }}
          >
            v{version}
          </span>
        </div>
        <div
          className="mt-4 pt-4 grid grid-cols-2 gap-3 text-xs"
          style={{
            borderTop: '1px solid var(--color-border-subtle)',
            color: 'var(--color-text-muted)',
          }}
        >
          <div>
            <span style={{ color: 'var(--color-text-secondary)' }}>API</span>
            <span className="ml-2 font-mono">http://localhost:3001</span>
          </div>
          <div>
            <span style={{ color: 'var(--color-text-secondary)' }}>UI</span>
            <span className="ml-2 font-mono">http://localhost:3000</span>
          </div>
        </div>
      </div>

      {/* Ollama host */}
      <div className="space-y-2">
        <label
          className="block text-sm font-medium"
          style={{ color: 'var(--color-text-primary)' }}
          htmlFor="ollama-host"
        >
          Ollama Host
        </label>
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          The URL where your Ollama instance is running.
        </p>
        <div className="neon-focus rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border-default)' }}>
          <input
            id="ollama-host"
            type="text"
            value={ollamaHost}
            onChange={(e) => setOllamaHost(e.target.value)}
            onBlur={() => saveSetting('ollama_host', ollamaHost)}
            placeholder="http://localhost:11434"
            className="w-full px-4 py-3 text-sm bg-transparent"
            style={{
              color: 'var(--color-text-primary)',
              outline: 'none',
              fontFamily: 'var(--font-mono)',
            }}
          />
        </div>
      </div>

      {/* Default model */}
      <div className="space-y-2">
        <label
          className="block text-sm font-medium"
          style={{ color: 'var(--color-text-primary)' }}
          htmlFor="default-model"
        >
          Default Model
        </label>
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          The model used for new conversations when no model is explicitly selected.
        </p>
        <div
          className="neon-focus rounded-xl overflow-hidden"
          style={{ border: '1px solid var(--color-border-default)' }}
        >
          {modelsLoading ? (
            <div className="px-4 py-3 flex items-center gap-2" style={{ color: 'var(--color-text-muted)' }}>
              <IconSpinner />
              <span className="text-sm">Loading models…</span>
            </div>
          ) : (
            <select
              id="default-model"
              value={defaultModel}
              onChange={(e) => {
                setDefaultModel(e.target.value);
                saveSetting('default_model', e.target.value);
              }}
              className="w-full px-4 py-3 text-sm bg-transparent appearance-none cursor-pointer"
              style={{
                color: defaultModel ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                outline: 'none',
                background: 'transparent',
              }}
            >
              <option value="" style={{ background: 'var(--color-bg-elevated)' }}>
                Select a model…
              </option>
              {models.map((m) => (
                <option
                  key={m.name}
                  value={m.name}
                  style={{ background: 'var(--color-bg-elevated)', color: 'var(--color-text-primary)' }}
                >
                  {m.display_name}
                  {m.context_length ? ` (${Math.round(m.context_length / 1024)}K ctx)` : ''}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Check connection */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <button
            onClick={checkConnection}
            disabled={connectionState === 'checking'}
            className="btn-ripple glow-hover flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium"
            style={{
              background: 'var(--color-accent-subtle)',
              color: 'var(--color-accent-primary)',
              border: '1px solid rgba(212,149,107,0.25)',
              opacity: connectionState === 'checking' ? 0.7 : 1,
              cursor: connectionState === 'checking' ? 'not-allowed' : 'pointer',
            }}
          >
            {connectionState === 'checking' ? <IconSpinner /> : null}
            {connectionState === 'checking' ? 'Checking…' : 'Check Connection'}
          </button>

          {connectionState !== 'idle' && connectionState !== 'checking' && (
            <div
              className="flex items-center gap-1.5 text-sm scale-enter"
              style={{
                color: connectionState === 'ok' ? 'var(--color-success)' : 'var(--color-error)',
              }}
            >
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  background: connectionState === 'ok' ? 'var(--color-success)' : 'var(--color-error)',
                }}
              />
              {connectionMsg}
            </div>
          )}
        </div>
      </div>

      {/* Computer Use */}
      <div className="space-y-2">
        <label className="block text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
          Computer Use
        </label>
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Enable screenshot capture, mouse click, and keyboard control tools. Requires restart.
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={async () => {
              const current = settings['enable_computer_use'] === true || settings['enable_computer_use'] === 'true';
              await saveSetting('enable_computer_use', String(!current));
              setSettings((prev) => ({ ...prev, enable_computer_use: String(!current) }));
            }}
            className="btn-ripple relative w-10 h-5.5 rounded-full transition-premium"
            style={{
              background: (settings['enable_computer_use'] === true || settings['enable_computer_use'] === 'true')
                ? 'var(--color-accent-primary)'
                : 'var(--color-bg-elevated)',
              border: '1px solid var(--color-border-default)',
              cursor: 'pointer',
              position: 'relative',
              width: 40,
              height: 22,
              borderRadius: 11,
              flexShrink: 0,
            }}
            aria-label="Toggle Computer Use"
          >
            <span
              style={{
                position: 'absolute',
                top: 2,
                left: (settings['enable_computer_use'] === true || settings['enable_computer_use'] === 'true') ? 20 : 2,
                width: 16,
                height: 16,
                borderRadius: '50%',
                background: 'white',
                transition: 'left 0.2s var(--ease-spring)',
              }}
            />
          </button>
          <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            {(settings['enable_computer_use'] === true || settings['enable_computer_use'] === 'true') ? 'Enabled' : 'Disabled'}
          </span>
        </div>
      </div>

      {/* Unused settings display for transparency */}
      {Object.keys(settings).length > 0 && (
        <div
          className="glass rounded-2xl p-4 space-y-2"
          style={{ border: '1px solid var(--color-border-subtle)' }}
        >
          <p className="text-xs font-medium" style={{ color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Stored Configuration
          </p>
          <div className="space-y-1">
            {Object.entries(settings).map(([key, val]) => (
              <div key={key} className="flex items-center justify-between py-1">
                <span className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>{key}</span>
                <span
                  className="text-xs font-mono truncate max-w-48"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  {typeof val === 'string' ? val : JSON.stringify(val)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Section: Models ──────────────────────────────────────────────────────────

function ModelsSection() {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [defaultModel, setDefaultModel] = useState('');
  const [saving, setSaving] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [modResp, settResp] = await Promise.all([
          fetch('/api/v1/models'),
          fetch('/api/v1/settings'),
        ]);
        if (modResp.ok) {
          const data = await modResp.json() as { models: ModelInfo[] };
          setModels(data.models ?? []);
        }
        if (settResp.ok) {
          const data = await settResp.json() as { settings: SettingEntry[] };
          const entry = (data.settings ?? []).find((s) => s.key === 'default_model');
          if (entry && typeof entry.value === 'string') {
            setDefaultModel(entry.value);
          }
        }
      } catch {
        // non-fatal
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const setAsDefault = async (modelName: string) => {
    setSaving(modelName);
    try {
      await fetch('/api/v1/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'default_model', value: modelName }),
      });
      setDefaultModel(modelName);
    } catch {
      // non-fatal
    } finally {
      setSaving('');
    }
  };

  const tagLabel = (tag: string): string => {
    const map: Record<string, string> = {
      fast: 'Fast',
      code: 'Code',
      general: 'General',
      embed: 'Embed',
      vision: 'Vision',
      chat: 'Chat',
    };
    return map[tag] ?? tag;
  };

  const tagColor = (tag: string): string => {
    const map: Record<string, string> = {
      fast: 'rgba(99,102,241,0.15)',
      code: 'rgba(34,197,94,0.12)',
      general: 'rgba(212,149,107,0.12)',
      embed: 'rgba(251,191,36,0.12)',
      vision: 'rgba(168,85,247,0.12)',
      chat: 'rgba(20,184,166,0.12)',
    };
    return map[tag] ?? 'var(--color-bg-elevated)';
  };

  const tagTextColor = (tag: string): string => {
    const map: Record<string, string> = {
      fast: '#818cf8',
      code: '#22c55e',
      general: 'var(--color-accent-primary)',
      embed: '#fbbf24',
      vision: '#a855f7',
      chat: '#14b8a6',
    };
    return map[tag] ?? 'var(--color-text-muted)';
  };

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '';
    const gb = bytes / (1024 ** 3);
    return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / (1024 ** 2)).toFixed(0)} MB`;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="glass rounded-2xl p-5" style={{ border: '1px solid var(--color-border-subtle)' }}>
            <div className="flex items-start justify-between">
              <div className="space-y-2 flex-1">
                <Skeleton width="60%" height={16} />
                <Skeleton width="40%" height={12} />
              </div>
              <Skeleton width={90} height={32} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (models.length === 0) {
    return (
      <div
        className="glass rounded-2xl p-10 text-center"
        style={{ border: '1px solid var(--color-border-subtle)' }}
      >
        <div className="text-3xl mb-3">🤖</div>
        <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
          No models found
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
          Make sure Ollama is running and has models pulled. Try{' '}
          <code
            className="px-1.5 py-0.5 rounded"
            style={{ background: 'var(--color-bg-elevated)', fontFamily: 'var(--font-mono)' }}
          >
            ollama pull deepseek-r1:8b
          </code>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {models.map((model) => {
        const isDefault = model.name === defaultModel || model.is_default;
        const isSaving = saving === model.name;
        return (
          <div
            key={model.name}
            className="glass rounded-2xl p-5 transition-premium"
            style={{
              border: isDefault
                ? '1px solid rgba(212,149,107,0.4)'
                : '1px solid var(--color-border-subtle)',
              boxShadow: isDefault ? 'var(--glow-accent)' : undefined,
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3
                    className="text-sm font-semibold truncate"
                    style={{ color: isDefault ? 'var(--color-accent-primary)' : 'var(--color-text-primary)' }}
                  >
                    {model.display_name}
                  </h3>
                  {isDefault && (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{
                        background: 'var(--color-accent-subtle)',
                        color: 'var(--color-accent-primary)',
                        border: '1px solid rgba(212,149,107,0.25)',
                      }}
                    >
                      Default
                    </span>
                  )}
                </div>
                <p
                  className="text-xs mt-0.5 font-mono truncate"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {model.name}
                </p>
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  {model.context_length && (
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {Math.round(model.context_length / 1024)}K ctx
                    </span>
                  )}
                  {model.size > 0 && (
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {formatSize(model.size)}
                    </span>
                  )}
                  {model.task_types.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{
                        background: tagColor(tag),
                        color: tagTextColor(tag),
                      }}
                    >
                      {tagLabel(tag)}
                    </span>
                  ))}
                </div>
              </div>

              {!isDefault && (
                <button
                  onClick={() => setAsDefault(model.name)}
                  disabled={isSaving}
                  className="btn-ripple flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium"
                  style={{
                    background: 'var(--color-bg-elevated)',
                    color: 'var(--color-text-secondary)',
                    border: '1px solid var(--color-border-default)',
                    opacity: isSaving ? 0.6 : 1,
                  }}
                >
                  {isSaving ? <IconSpinner /> : <IconCheck />}
                  Set as Default
                </button>
              )}
              {isDefault && (
                <div
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium"
                  style={{
                    background: 'var(--color-accent-subtle)',
                    color: 'var(--color-accent-primary)',
                  }}
                >
                  <IconCheck />
                  Active
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Section: Providers ───────────────────────────────────────────────────────

function ProvidersSection() {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [addName, setAddName] = useState('');
  const [addUrl, setAddUrl] = useState('');
  const [addKey, setAddKey] = useState('');
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState('');

  const loadProviders = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch('/api/v1/settings/providers/list');
      if (resp.ok) {
        const data = await resp.json() as { providers: ProviderInfo[] };
        setProviders(data.providers ?? []);
      }
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  const switchProvider = async (id: string) => {
    setSwitching(id);
    try {
      const resp = await fetch('/api/v1/settings/providers/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId: id }),
      });
      if (resp.ok) {
        setProviders((prev) =>
          prev.map((p) => ({ ...p, isActive: p.id === id }))
        );
      }
    } catch {
      // non-fatal
    } finally {
      setSwitching('');
    }
  };

  const addProvider = async () => {
    if (!addUrl.trim()) {
      setAddError('Base URL is required.');
      return;
    }
    setAddError('');
    setAddSubmitting(true);
    try {
      const resp = await fetch('/api/v1/settings/providers/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'openai-compat',
          baseUrl: addUrl.trim(),
          apiKey: addKey.trim() || undefined,
          displayName: addName.trim() || undefined,
          isActive: true,
        }),
      });
      if (resp.ok) {
        setShowAddForm(false);
        setAddName('');
        setAddUrl('');
        setAddKey('');
        await loadProviders();
      } else {
        const data = await resp.json() as { error?: string };
        setAddError(data.error ?? 'Failed to add provider.');
      }
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add provider.');
    } finally {
      setAddSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="glass rounded-2xl p-5" style={{ border: '1px solid var(--color-border-subtle)' }}>
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton width={160} height={14} />
                <Skeleton width={100} height={11} />
              </div>
              <Skeleton width={70} height={30} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Provider list */}
      <div className="space-y-3">
        {providers.map((p) => (
          <div
            key={p.id}
            className="glass rounded-2xl p-5 transition-premium"
            style={{
              border: p.isActive
                ? '1px solid rgba(34,197,94,0.3)'
                : '1px solid var(--color-border-subtle)',
            }}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{
                    background: p.isActive ? '#22c55e' : 'var(--color-text-muted)',
                    boxShadow: p.isActive ? '0 0 8px rgba(34,197,94,0.4)' : undefined,
                  }}
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
                    {p.displayName}
                  </p>
                  <p className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>
                    {p.id}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {p.isActive ? (
                  <span
                    className="text-xs px-2.5 py-1 rounded-full font-medium"
                    style={{
                      background: 'rgba(34,197,94,0.1)',
                      color: '#22c55e',
                      border: '1px solid rgba(34,197,94,0.2)',
                    }}
                  >
                    Active
                  </span>
                ) : (
                  <button
                    onClick={() => switchProvider(p.id)}
                    disabled={switching === p.id}
                    className="btn-ripple text-xs px-3 py-1.5 rounded-xl font-medium"
                    style={{
                      background: 'var(--color-bg-elevated)',
                      color: 'var(--color-text-secondary)',
                      border: '1px solid var(--color-border-default)',
                      opacity: switching === p.id ? 0.6 : 1,
                    }}
                  >
                    {switching === p.id ? (
                      <span className="flex items-center gap-1.5">
                        <IconSpinner /> Switching…
                      </span>
                    ) : (
                      'Switch to'
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {providers.length === 0 && !loading && (
          <p className="text-sm text-center py-4" style={{ color: 'var(--color-text-muted)' }}>
            No providers registered.
          </p>
        )}
      </div>

      {/* Add provider */}
      {!showAddForm ? (
        <button
          onClick={() => setShowAddForm(true)}
          className="btn-ripple w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-medium transition-premium"
          style={{
            background: 'transparent',
            color: 'var(--color-text-secondary)',
            border: '1px dashed var(--color-border-default)',
          }}
        >
          <IconPlus />
          Add OpenAI-Compatible Provider
        </button>
      ) : (
        <div
          className="glass rounded-2xl p-5 space-y-4 scale-enter"
          style={{ border: '1px solid var(--color-border-default)' }}
        >
          <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Add Provider
          </h3>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                Display Name
              </label>
              <div className="neon-focus rounded-xl" style={{ border: '1px solid var(--color-border-default)' }}>
                <input
                  type="text"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="e.g. OpenRouter"
                  className="w-full px-3.5 py-2.5 text-sm bg-transparent"
                  style={{ color: 'var(--color-text-primary)', outline: 'none' }}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                Base URL <span style={{ color: 'var(--color-error)' }}>*</span>
              </label>
              <div className="neon-focus rounded-xl" style={{ border: '1px solid var(--color-border-default)' }}>
                <input
                  type="url"
                  value={addUrl}
                  onChange={(e) => { setAddUrl(e.target.value); setAddError(''); }}
                  placeholder="https://openrouter.ai/api/v1"
                  className="w-full px-3.5 py-2.5 text-sm bg-transparent font-mono"
                  style={{ color: 'var(--color-text-primary)', outline: 'none' }}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                API Key
              </label>
              <div className="neon-focus rounded-xl" style={{ border: '1px solid var(--color-border-default)' }}>
                <input
                  type="password"
                  value={addKey}
                  onChange={(e) => setAddKey(e.target.value)}
                  placeholder="sk-…"
                  className="w-full px-3.5 py-2.5 text-sm bg-transparent font-mono"
                  style={{ color: 'var(--color-text-primary)', outline: 'none' }}
                />
              </div>
            </div>

            {addError && (
              <p className="text-xs" style={{ color: 'var(--color-error)' }}>
                {addError}
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={addProvider}
                disabled={addSubmitting}
                className="btn-ripple glow-hover flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium"
                style={{
                  background: 'var(--color-accent-primary)',
                  color: 'white',
                  opacity: addSubmitting ? 0.7 : 1,
                }}
              >
                {addSubmitting && <IconSpinner />}
                {addSubmitting ? 'Adding…' : 'Add & Activate'}
              </button>
              <button
                onClick={() => { setShowAddForm(false); setAddError(''); }}
                className="px-4 py-2 rounded-xl text-sm"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Section: Appearance ──────────────────────────────────────────────────────

const ACCENT_PRESETS = [
  { hex: '#d4956b', label: 'Amber' },
  { hex: '#6b9fd4', label: 'Sky' },
  { hex: '#6bd4a0', label: 'Mint' },
  { hex: '#d46b6b', label: 'Rose' },
  { hex: '#c46bd4', label: 'Violet' },
  { hex: '#d4c96b', label: 'Gold' },
] as const;

type AccentHex = (typeof ACCENT_PRESETS)[number]['hex'];

function AppearanceSection() {
  const [accent, setAccent] = useState<AccentHex>(() => {
    if (typeof localStorage !== 'undefined') {
      return (localStorage.getItem('liminal_accent') as AccentHex) ?? '#d4956b';
    }
    return '#d4956b';
  });
  const [fontSize, setFontSize] = useState<FontSize>(() => {
    if (typeof localStorage !== 'undefined') {
      return (localStorage.getItem('liminal_font_size') as FontSize) ?? 'medium';
    }
    return 'medium';
  });

  const applyAccent = (hex: AccentHex) => {
    setAccent(hex);
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--color-accent-primary', hex);
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('liminal_accent', hex);
    }
  };

  const fontSizeMap: Record<FontSize, string> = {
    small: '13px',
    medium: '15px',
    large: '17px',
  };

  const applyFontSize = (size: FontSize) => {
    setFontSize(size);
    if (typeof document !== 'undefined') {
      document.body.style.fontSize = fontSizeMap[size];
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('liminal_font_size', size);
    }
  };

  return (
    <div className="space-y-8">
      {/* Theme */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          Theme
        </h3>
        <div
          className="glass rounded-2xl p-4 flex items-center justify-between"
          style={{
            border: '1px solid rgba(212,149,107,0.35)',
            boxShadow: 'var(--glow-accent)',
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--color-bg-elevated)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ color: 'var(--color-accent-primary)' }}>
                <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Dark</p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Easy on the eyes</p>
            </div>
          </div>
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center"
            style={{ background: 'var(--color-accent-primary)' }}
          >
            <IconCheck />
          </div>
        </div>
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Light mode coming in a future release.
        </p>
      </div>

      {/* Accent color */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          Accent Color
        </h3>
        <div className="flex items-center gap-3 flex-wrap">
          {ACCENT_PRESETS.map((preset) => {
            const active = accent === preset.hex;
            return (
              <button
                key={preset.hex}
                onClick={() => applyAccent(preset.hex)}
                title={preset.label}
                className="glow-hover relative w-9 h-9 rounded-full transition-premium"
                style={{
                  background: preset.hex,
                  boxShadow: active ? `0 0 0 2px var(--color-bg-primary), 0 0 0 4px ${preset.hex}` : undefined,
                  transform: active ? 'scale(1.15)' : undefined,
                }}
              >
                {active && (
                  <span
                    className="absolute inset-0 flex items-center justify-center scale-enter"
                    style={{ color: 'white' }}
                  >
                    <IconCheck />
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Currently: <span className="font-mono" style={{ color: accent }}>{accent}</span>
        </p>
      </div>

      {/* Font size */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          Font Size
        </h3>
        <div
          className="glass rounded-2xl overflow-hidden"
          style={{ border: '1px solid var(--color-border-subtle)' }}
        >
          {(['small', 'medium', 'large'] as const).map((size, idx) => {
            const active = fontSize === size;
            const labels: Record<FontSize, string> = {
              small: 'Small',
              medium: 'Medium',
              large: 'Large',
            };
            const sizes: Record<FontSize, string> = {
              small: '13px',
              medium: '15px',
              large: '17px',
            };
            return (
              <button
                key={size}
                onClick={() => applyFontSize(size)}
                className="w-full flex items-center justify-between px-5 py-3.5 text-sm transition-premium"
                style={{
                  background: active ? 'var(--color-accent-subtle)' : 'transparent',
                  color: active ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
                  borderTop: idx > 0 ? '1px solid var(--color-border-subtle)' : undefined,
                  textAlign: 'left',
                }}
              >
                <span className="font-medium">{labels[size]}</span>
                <div className="flex items-center gap-2">
                  <span
                    className="font-mono text-xs"
                    style={{ color: active ? 'var(--color-accent-primary)' : 'var(--color-text-muted)' }}
                  >
                    {sizes[size]}
                  </span>
                  {active && <IconCheck />}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Section: Keyboard Shortcuts ──────────────────────────────────────────────

interface Shortcut {
  keys: string[];
  description: string;
  category: string;
}

const SHORTCUTS: Shortcut[] = [
  { keys: ['Ctrl', 'K'], description: 'New chat', category: 'Navigation' },
  { keys: ['Ctrl', 'Shift', 'P'], description: 'Command palette', category: 'Navigation' },
  { keys: ['Ctrl', '/'], description: 'Toggle sidebar', category: 'Navigation' },
  { keys: ['Ctrl', '.'], description: 'Toggle artifact panel', category: 'Panels' },
  { keys: ['Ctrl', 'Shift', 'C'], description: 'Open Cowork panel', category: 'Panels' },
  { keys: ['Escape'], description: 'Close panel / Stop generation', category: 'Panels' },
  { keys: ['Enter'], description: 'Send message', category: 'Input' },
  { keys: ['Shift', 'Enter'], description: 'New line in message', category: 'Input' },
  { keys: ['Ctrl', 'Z'], description: 'Undo (in code editor)', category: 'Editor' },
  { keys: ['Ctrl', 'Shift', 'Z'], description: 'Redo (in code editor)', category: 'Editor' },
];

function KeyboardShortcutsSection() {
  const categories = Array.from(new Set(SHORTCUTS.map((s) => s.category)));

  return (
    <div className="space-y-6">
      {categories.map((category) => (
        <div key={category} className="space-y-2">
          <h3
            className="text-xs font-semibold uppercase tracking-widest"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {category}
          </h3>
          <div
            className="glass rounded-2xl overflow-hidden"
            style={{ border: '1px solid var(--color-border-subtle)' }}
          >
            {SHORTCUTS.filter((s) => s.category === category).map((shortcut, idx) => (
              <div
                key={shortcut.description}
                className="flex items-center justify-between px-5 py-3.5"
                style={{
                  borderTop: idx > 0 ? '1px solid var(--color-border-subtle)' : undefined,
                }}
              >
                <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  {shortcut.description}
                </span>
                <div className="flex items-center gap-1">
                  {shortcut.keys.map((key, ki) => (
                    <span key={ki} className="flex items-center gap-1">
                      <kbd
                        className="text-xs px-2 py-1 rounded-lg"
                        style={{
                          background: 'var(--color-bg-elevated)',
                          color: 'var(--color-text-muted)',
                          border: '1px solid var(--color-border-default)',
                          fontFamily: 'var(--font-mono)',
                          minWidth: 28,
                          textAlign: 'center',
                          display: 'inline-block',
                        }}
                      >
                        {key}
                      </kbd>
                      {ki < shortcut.keys.length - 1 && (
                        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>+</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Nav Items ────────────────────────────────────────────────────────────────

const NAV_ITEMS: NavItem[] = [
  { id: 'general', label: 'General', icon: <IconSettings /> },
  { id: 'models', label: 'Models', icon: <IconCpu /> },
  { id: 'providers', label: 'Providers', icon: <IconLayers /> },
  { id: 'appearance', label: 'Appearance', icon: <IconPalette /> },
  { id: 'shortcuts', label: 'Keyboard Shortcuts', icon: <IconKeyboard /> },
];

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<Section>('general');

  const sectionTitles: Record<Section, string> = {
    general: 'General',
    models: 'Models',
    providers: 'Providers',
    appearance: 'Appearance',
    shortcuts: 'Keyboard Shortcuts',
  };

  const sectionDescriptions: Record<Section, string> = {
    general: 'App configuration and connection settings',
    models: 'Manage and select inference models',
    providers: 'Configure inference provider endpoints',
    appearance: 'Customize the look and feel',
    shortcuts: 'All available keyboard shortcuts',
  };

  return (
    <div
      className="flex h-full overflow-hidden"
      style={{ background: 'var(--color-bg-primary)' }}
    >
      {/* Left sidebar nav */}
      <aside
        className="w-56 flex-shrink-0 flex flex-col pt-8 pb-6 px-3 overflow-y-auto"
        style={{
          borderRight: '1px solid var(--color-border-subtle)',
          background: 'var(--color-bg-sidebar)',
        }}
      >
        {/* Header */}
        <div className="px-3 mb-6">
          <h1 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Settings
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Liminal configuration
          </p>
        </div>

        {/* Nav links */}
        <nav className="space-y-0.5 flex-1">
          {NAV_ITEMS.map((item) => {
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className="w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-premium relative"
                style={{
                  background: active ? 'var(--color-bg-active)' : 'transparent',
                  color: active ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
                  fontWeight: active ? 500 : 400,
                }}
              >
                {active && (
                  <span
                    className="absolute left-0 top-[20%] bottom-[20%] w-0.5 rounded-r"
                    style={{
                      background: 'var(--color-accent-primary)',
                      boxShadow: '0 0 8px rgba(212,149,107,0.4)',
                    }}
                  />
                )}
                <span
                  style={{
                    color: active ? 'var(--color-accent-primary)' : 'var(--color-text-muted)',
                    transition: 'color 0.15s',
                  }}
                >
                  {item.icon}
                </span>
                <span className="flex-1 truncate">{item.label}</span>
                {active && (
                  <span style={{ color: 'var(--color-accent-primary)', opacity: 0.6 }}>
                    <IconChevronRight />
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Version badge */}
        <div className="px-3 mt-6">
          <span
            className="text-xs font-mono"
            style={{ color: 'var(--color-text-muted)' }}
          >
            v0.1.0
          </span>
        </div>
      </aside>

      {/* Main content area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Content header */}
        <div
          className="flex-shrink-0 px-8 py-6"
          style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
        >
          <h2
            className="text-xl font-semibold"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {sectionTitles[activeSection]}
          </h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            {sectionDescriptions[activeSection]}
          </p>
        </div>

        {/* Scrollable section body */}
        <div className="flex-1 overflow-y-auto px-8 py-8">
          <div className="max-w-2xl">
            {activeSection === 'general' && <GeneralSection key="general" />}
            {activeSection === 'models' && <ModelsSection key="models" />}
            {activeSection === 'providers' && <ProvidersSection key="providers" />}
            {activeSection === 'appearance' && <AppearanceSection key="appearance" />}
            {activeSection === 'shortcuts' && <KeyboardShortcutsSection key="shortcuts" />}
          </div>
        </div>
      </main>
    </div>
  );
}
