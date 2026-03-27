'use client';

import { useEffect, useState } from 'react';
import { useSettingsStore } from '@/store/settings.store';

type Tab = 'general' | 'models' | 'providers' | 'appearance' | 'shortcuts' | 'auto-task';

const TABS: Array<{ id: Tab; label: string; icon: string }> = [
  { id: 'general', label: 'General', icon: 'M12 15a3 3 0 100-6 3 3 0 000 6z' },
  { id: 'models', label: 'Models', icon: 'M12 2L2 7l10 5 10-5-10-5z' },
  { id: 'providers', label: 'Providers', icon: 'M22 12h-4l-3 9L9 3l-3 9H2' },
  { id: 'auto-task', label: 'Auto Task', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
  { id: 'appearance', label: 'Appearance', icon: 'M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688' },
  { id: 'shortcuts', label: 'Shortcuts', icon: 'M18 3a3 3 0 00-3 3v12a3 3 0 003 3' },
];

function ProvidersTab() {
  const { providers, activeProvider, switchProvider, addProvider } = useSettingsStore();
  const [showAdd, setShowAdd] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newKey, setNewKey] = useState('');
  const [newName, setNewName] = useState('');

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
        Inference Providers
      </h3>

      <div className="space-y-2">
        {providers.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between px-3 py-2.5 rounded-xl"
            style={{
              background: p.isActive ? 'var(--color-bg-active)' : 'var(--color-bg-elevated)',
              border: `1px solid ${p.isActive ? 'var(--color-accent-primary)' : 'var(--color-border-subtle)'}`,
            }}
          >
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                {p.displayName}
              </p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{p.id}</p>
            </div>
            {!p.isActive && (
              <button
                onClick={() => switchProvider(p.id)}
                className="text-xs px-3 py-1 rounded-lg btn-ripple"
                style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-accent-primary)' }}
              >
                Activate
              </button>
            )}
            {p.isActive && (
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
                Active
              </span>
            )}
          </div>
        ))}
      </div>

      {!showAdd ? (
        <button
          onClick={() => setShowAdd(true)}
          className="text-xs px-3 py-2 rounded-xl btn-ripple w-full"
          style={{ background: 'var(--color-bg-elevated)', color: 'var(--color-text-secondary)', border: '1px dashed var(--color-border-default)' }}
        >
          + Add OpenAI-Compatible Provider
        </button>
      ) : (
        <div className="space-y-2 p-3 rounded-xl" style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-default)' }}>
          <input
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder="Base URL (e.g. https://openrouter.ai/api)"
            className="w-full text-xs px-3 py-2 rounded-lg bg-transparent neon-focus"
            style={{ border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)' }}
          />
          <input
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder="API Key (optional)"
            type="password"
            className="w-full text-xs px-3 py-2 rounded-lg bg-transparent neon-focus"
            style={{ border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)' }}
          />
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Display Name (optional)"
            className="w-full text-xs px-3 py-2 rounded-lg bg-transparent neon-focus"
            style={{ border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)' }}
          />
          <div className="flex gap-2">
            <button
              onClick={async () => {
                if (!newUrl) return;
                await addProvider({
                  type: 'openai-compat',
                  baseUrl: newUrl,
                  apiKey: newKey || undefined,
                  displayName: newName || undefined,
                  isActive: true,
                });
                setShowAdd(false);
                setNewUrl('');
                setNewKey('');
                setNewName('');
              }}
              className="text-xs px-3 py-1.5 rounded-lg btn-ripple"
              style={{ background: 'var(--color-accent-primary)', color: 'white' }}
            >
              Add & Activate
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="text-xs px-3 py-1.5 rounded-lg"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ModelsTab() {
  const { models, selectedModel, setSelectedModel, loadModels } = useSettingsStore();

  useEffect(() => { loadModels(); }, [loadModels]);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
        Available Models
      </h3>
      <div className="space-y-1">
        {models.map((m) => (
          <button
            key={m.name}
            onClick={() => setSelectedModel(m.name)}
            className="w-full text-left flex items-center justify-between px-3 py-2 rounded-xl sidebar-item"
            style={{
              background: selectedModel === m.name ? 'var(--color-bg-active)' : 'transparent',
            }}
          >
            <div>
              <p className="text-sm font-medium" style={{ color: selectedModel === m.name ? 'var(--color-accent-primary)' : 'var(--color-text-primary)' }}>
                {m.display_name}
              </p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {m.name} {m.context_length ? `· ${Math.round(m.context_length / 1024)}K` : ''}
              </p>
            </div>
            {selectedModel === m.name && (
              <span className="text-xs" style={{ color: 'var(--color-accent-primary)' }}>Selected</span>
            )}
          </button>
        ))}
        {models.length === 0 && (
          <p className="text-xs py-4 text-center" style={{ color: 'var(--color-text-muted)' }}>
            No models available. Check your provider connection.
          </p>
        )}
      </div>
    </div>
  );
}

const ACCENT_PRESETS = [
  { hex: '#d4956b', label: 'Amber' },
  { hex: '#6b9fd4', label: 'Sky' },
  { hex: '#6bd4a0', label: 'Mint' },
  { hex: '#d46b6b', label: 'Rose' },
  { hex: '#c46bd4', label: 'Violet' },
  { hex: '#d4c96b', label: 'Gold' },
] as const;

type AccentHex = typeof ACCENT_PRESETS[number]['hex'];
type FontSize = 'small' | 'medium' | 'large';

function AppearanceTab() {
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

  const fontSizeMap: Record<FontSize, string> = { small: '13px', medium: '15px', large: '17px' };

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
    <div className="space-y-5">
      <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Accent Color</h3>
      <div className="flex items-center gap-2.5 flex-wrap">
        {ACCENT_PRESETS.map((preset) => {
          const active = accent === preset.hex;
          return (
            <button
              key={preset.hex}
              title={preset.label}
              onClick={() => applyAccent(preset.hex)}
              className="glow-hover relative w-7 h-7 rounded-full"
              style={{
                background: preset.hex,
                boxShadow: active ? `0 0 0 2px var(--color-bg-primary), 0 0 0 3.5px ${preset.hex}` : undefined,
                transform: active ? 'scale(1.15)' : undefined,
                transition: 'transform 0.15s, box-shadow 0.15s',
              }}
            />
          );
        })}
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Font Size</h3>
        <div className="flex gap-2 mt-2">
          {(['small', 'medium', 'large'] as const).map((size) => {
            const active = fontSize === size;
            const labels = { small: 'Small', medium: 'Medium', large: 'Large' };
            return (
              <button
                key={size}
                onClick={() => applyFontSize(size)}
                className="btn-ripple px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{
                  background: active ? 'var(--color-accent-subtle)' : 'var(--color-bg-elevated)',
                  color: active ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
                  border: `1px solid ${active ? 'rgba(212,149,107,0.3)' : 'var(--color-border-subtle)'}`,
                }}
              >
                {labels[size]}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ShortcutsTab() {
  const shortcuts = [
    { key: 'Ctrl+K', desc: 'New conversation' },
    { key: 'Ctrl+/', desc: 'Toggle sidebar' },
    { key: 'Ctrl+.', desc: 'Toggle artifact panel' },
    { key: 'Ctrl+Shift+P', desc: 'Command palette' },
    { key: 'Ctrl+Shift+C', desc: 'Open Cowork panel' },
    { key: 'Esc', desc: 'Stop generation' },
    { key: 'Enter', desc: 'Send message' },
    { key: 'Shift+Enter', desc: 'New line' },
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
        Keyboard Shortcuts
      </h3>
      <div className="space-y-1">
        {shortcuts.map((s) => (
          <div key={s.key} className="flex items-center justify-between px-3 py-2">
            <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{s.desc}</span>
            <kbd
              className="text-xs px-2 py-0.5 rounded"
              style={{
                background: 'var(--color-bg-elevated)',
                color: 'var(--color-text-muted)',
                border: '1px solid var(--color-border-subtle)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {s.key}
            </kbd>
          </div>
        ))}
      </div>
    </div>
  );
}

function GeneralTab() {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
        General Settings
      </h3>
      <div className="space-y-3">
        <div className="px-3 py-3 rounded-xl" style={{ background: 'var(--color-bg-elevated)' }}>
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>Liminal AI</p>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Local AI assistant powered by Ollama with multi-provider support.
          </p>
          <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
            Version 0.1.0
          </p>
        </div>
        <div className="px-3 py-3 rounded-xl" style={{ background: 'var(--color-bg-elevated)' }}>
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>Environment</p>
          <div className="space-y-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            <p>API: http://localhost:3001</p>
            <p>Ollama: {typeof window !== 'undefined' ? 'http://localhost:11434' : ''}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Auto Task Settings Tab ────────────────────────────────────────────────────

function AutoTaskSettingsTab() {
  const { settings, setSetting } = useSettingsStore();

  const maxConcurrent = (settings['auto_task_max_concurrent'] as number) ?? 3;
  const strategy = (settings['auto_task_concurrency_strategy'] as string) ?? 'fixed';
  const maxClamp = (settings['auto_task_max_clamp'] as number) ?? 5;
  const enableQA = (settings['auto_task_enable_qa'] as boolean) ?? false;
  const defaultSecurityLevel = (settings['auto_task_default_security_level'] as number) ?? 1;

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
        Auto Task 설정
      </h3>

      {/* Max Concurrent */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            최대 동시 실행 수
          </label>
          <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: 'var(--color-bg-elevated)', color: 'var(--color-accent-primary)' }}>
            {maxConcurrent}
          </span>
        </div>
        <input
          type="range"
          min={1}
          max={10}
          value={maxConcurrent}
          onChange={(e) => { void setSetting('auto_task_max_concurrent', Number(e.target.value)); }}
          className="w-full"
          style={{ accentColor: 'var(--color-accent-primary)' }}
        />
        <div className="flex justify-between text-xs" style={{ color: 'var(--color-text-muted)' }}>
          <span>1</span>
          <span>5</span>
          <span>10</span>
        </div>
      </div>

      {/* Concurrency Strategy */}
      <div className="space-y-2">
        <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
          동시성 전략
        </label>
        <div className="flex gap-2">
          {(['fixed', 'auto'] as const).map((s) => {
            const active = strategy === s;
            const labels = { fixed: 'Fixed (고정)', auto: 'Auto (AI 추천)' };
            return (
              <button
                key={s}
                onClick={() => { void setSetting('auto_task_concurrency_strategy', s); }}
                className="btn-ripple flex-1 px-3 py-2 rounded-lg text-xs font-medium"
                style={{
                  background: active ? 'var(--color-accent-subtle)' : 'var(--color-bg-elevated)',
                  color: active ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
                  border: `1px solid ${active ? 'rgba(212,149,107,0.3)' : 'var(--color-border-subtle)'}`,
                }}
              >
                {labels[s]}
              </button>
            );
          })}
        </div>
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {strategy === 'auto'
            ? 'AI가 태스크 복잡도에 따라 최적의 동시 실행 수를 결정합니다.'
            : '설정된 값으로 고정하여 실행합니다.'}
        </p>
      </div>

      {/* Max Clamp (visible when strategy is auto) */}
      {strategy === 'auto' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              자동 상한 (Clamp)
            </label>
            <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: 'var(--color-bg-elevated)', color: 'var(--color-accent-primary)' }}>
              {maxClamp}
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            value={maxClamp}
            onChange={(e) => { void setSetting('auto_task_max_clamp', Number(e.target.value)); }}
            className="w-full"
            style={{ accentColor: 'var(--color-accent-primary)' }}
          />
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            AI 추천 동시성의 최대 상한값입니다.
          </p>
        </div>
      )}

      {/* Enable QA */}
      <div
        className="flex items-center justify-between px-3 py-3 rounded-xl"
        style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-subtle)' }}
      >
        <div>
          <p className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>QA 자동 검토</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            태스크 완료 후 tester/reviewer가 결과를 자동 평가
          </p>
        </div>
        <button
          onClick={() => { void setSetting('auto_task_enable_qa', !enableQA); }}
          className="relative w-10 h-5 rounded-full transition-colors"
          style={{
            background: enableQA ? 'var(--color-accent-primary)' : 'var(--color-bg-secondary)',
            border: `1px solid ${enableQA ? 'var(--color-accent-primary)' : 'var(--color-border-default)'}`,
          }}
        >
          <span
            className="absolute top-0.5 rounded-full transition-transform"
            style={{
              width: 14,
              height: 14,
              background: enableQA ? '#fff' : 'var(--color-text-muted)',
              transform: enableQA ? 'translateX(22px)' : 'translateX(2px)',
            }}
          />
        </button>
      </div>

      {/* Default Security Level */}
      <div className="space-y-2">
        <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
          기본 보안 레벨
        </label>
        <div className="flex gap-2">
          {([1, 2, 3] as const).map((level) => {
            const active = defaultSecurityLevel === level;
            const labels = { 1: 'L1 - 제한 없음', 2: 'L2 - 기본 검증', 3: 'L3 - 샌드박스' };
            const colors = { 1: '#22c55e', 2: '#f59e0b', 3: '#ef4444' };
            return (
              <button
                key={level}
                onClick={() => { void setSetting('auto_task_default_security_level', level); }}
                className="btn-ripple flex-1 px-3 py-2 rounded-lg text-xs font-medium"
                style={{
                  background: active ? `${colors[level]}15` : 'var(--color-bg-elevated)',
                  color: active ? colors[level] : 'var(--color-text-secondary)',
                  border: `1px solid ${active ? `${colors[level]}40` : 'var(--color-border-subtle)'}`,
                }}
              >
                {labels[level]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Info card */}
      <div className="px-3 py-3 rounded-xl" style={{ background: 'var(--color-bg-elevated)' }}>
        <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>
          동적 에이전트 시스템
        </p>
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          AI 플래너가 필요에 따라 전문 에이전트를 자동 생성합니다.
          기본 10개 역할(architect, coder, reviewer 등)은 항상 유지되며,
          도메인 특화 에이전트는 태스크 완료 후 자동 삭제됩니다.
        </p>
      </div>
    </div>
  );
}

// ── Main SettingsPanel ────────────────────────────────────────────────────────

export function SettingsPanel() {
  const { isSettingsOpen, closeSettings, settingsTab, loadProviders, loadSettings } = useSettingsStore();
  const [activeTab, setActiveTab] = useState<Tab>(settingsTab);

  useEffect(() => {
    setActiveTab(settingsTab);
  }, [settingsTab]);

  useEffect(() => {
    if (isSettingsOpen) {
      loadProviders();
      loadSettings();
    }
  }, [isSettingsOpen, loadProviders, loadSettings]);

  if (!isSettingsOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}>
      <div
        className="w-full max-w-2xl max-h-[80vh] rounded-2xl overflow-hidden flex glass-heavy"
        style={{
          boxShadow: 'var(--shadow-xl)',
          border: '1px solid var(--glass-border)',
        }}
      >
        {/* Sidebar */}
        <div
          className="w-48 flex-shrink-0 py-4"
          style={{ borderRight: '1px solid var(--glass-border)' }}
        >
          <div className="px-4 mb-4">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Settings</h2>
          </div>
          <div className="space-y-0.5 px-2">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium sidebar-item"
                style={{
                  background: activeTab === tab.id ? 'var(--color-bg-active)' : 'transparent',
                  color: activeTab === tab.id ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--glass-border)' }}>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              {TABS.find((t) => t.id === activeTab)?.label}
            </h2>
            <button
              onClick={closeSettings}
              className="close-btn p-1.5 rounded-lg"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {activeTab === 'general' && <GeneralTab />}
            {activeTab === 'models' && <ModelsTab />}
            {activeTab === 'providers' && <ProvidersTab />}
            {activeTab === 'auto-task' && <AutoTaskSettingsTab />}
            {activeTab === 'appearance' && <AppearanceTab />}
            {activeTab === 'shortcuts' && <ShortcutsTab />}
          </div>
        </div>
      </div>
    </div>
  );
}
