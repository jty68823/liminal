import { create } from 'zustand';

export interface ProviderInfo {
  id: string;
  displayName: string;
  isActive: boolean;
}

export interface ModelInfo {
  name: string;
  size: number;
  display_name: string;
  context_length: number | null;
  is_default: boolean;
  provider: string;
}

interface SettingsStore {
  // Provider state
  providers: ProviderInfo[];
  activeProvider: string;
  models: ModelInfo[];
  selectedModel: string | null;

  // Settings
  settings: Record<string, unknown>;

  // UI state
  isSettingsOpen: boolean;
  settingsTab: 'general' | 'models' | 'providers' | 'appearance' | 'shortcuts' | 'auto-task';

  // Actions
  loadProviders(): Promise<void>;
  loadModels(): Promise<void>;
  loadSettings(): Promise<void>;
  switchProvider(providerId: string): Promise<void>;
  setSelectedModel(model: string): void;
  setSetting(key: string, value: unknown): Promise<void>;
  openSettings(tab?: SettingsStore['settingsTab']): void;
  closeSettings(): void;
  addProvider(config: {
    type: 'llamacpp' | 'openai-compat';
    baseUrl: string;
    apiKey?: string;
    displayName?: string;
    isActive?: boolean;
  }): Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  providers: [],
  activeProvider: 'llamacpp',
  models: [],
  selectedModel: null,
  settings: {},
  isSettingsOpen: false,
  settingsTab: 'general',

  async loadProviders() {
    try {
      const resp = await fetch('/api/v1/settings/providers/list');
      if (resp.ok) {
        const data = await resp.json();
        const active = data.providers?.find((p: ProviderInfo) => p.isActive);
        set({
          providers: data.providers ?? [],
          activeProvider: active?.id ?? 'llamacpp',
        });
      }
    } catch {
      // non-fatal
    }
  },

  async loadModels() {
    try {
      const resp = await fetch('/api/v1/models');
      if (resp.ok) {
        const data = await resp.json();
        set({ models: data.models ?? [] });
      }
    } catch {
      // non-fatal
    }
  },

  async loadSettings() {
    try {
      const resp = await fetch('/api/v1/settings');
      if (resp.ok) {
        const data = await resp.json();
        const map: Record<string, unknown> = {};
        for (const s of data.settings ?? []) {
          map[s.key] = s.value;
        }
        set({ settings: map });
      }
    } catch {
      // non-fatal
    }
  },

  async switchProvider(providerId: string) {
    try {
      const resp = await fetch('/api/v1/settings/providers/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId }),
      });
      if (resp.ok) {
        set({ activeProvider: providerId });
        // Reload models for the new provider
        await get().loadModels();
        await get().loadProviders();
      }
    } catch {
      // non-fatal
    }
  },

  setSelectedModel(model: string) {
    set({ selectedModel: model });
  },

  async setSetting(key: string, value: unknown) {
    try {
      await fetch('/api/v1/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });
      set((state) => ({
        settings: { ...state.settings, [key]: value },
      }));
    } catch {
      // non-fatal
    }
  },

  openSettings(tab) {
    set({ isSettingsOpen: true, settingsTab: tab ?? 'general' });
  },

  closeSettings() {
    set({ isSettingsOpen: false });
  },

  async addProvider(config) {
    try {
      const resp = await fetch('/api/v1/settings/providers/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (resp.ok) {
        await get().loadProviders();
        await get().loadModels();
      }
    } catch {
      // non-fatal
    }
  },
}));
