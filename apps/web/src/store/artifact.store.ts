import { create } from 'zustand';

export interface Artifact {
  id: string;
  type: 'code' | 'html' | 'mermaid' | 'react' | 'svg' | 'markdown' | 'text';
  title: string;
  language?: string;
  content: string;
  version?: number;
}

interface ArtifactStore {
  activeArtifact: Artifact | null;
  isOpen: boolean;
  history: Artifact[];

  setArtifact(artifact: Artifact): void;
  updateArtifact(id: string, content: string): Promise<void>;
  close(): void;
  openPrevious(id: string): void;
}

export const useArtifactStore = create<ArtifactStore>((set, get) => ({
  activeArtifact: null,
  isOpen: false,
  history: [],

  setArtifact(artifact) {
    set((state) => {
      // Add to history if not already there
      const exists = state.history.some((a) => a.id === artifact.id);
      return {
        activeArtifact: artifact,
        isOpen: true,
        history: exists ? state.history : [...state.history, artifact],
      };
    });
  },

  async updateArtifact(id, content) {
    try {
      const res = await fetch(`/api/v1/artifacts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) return;
      const data = await res.json();
      const updated = data.artifact;
      if (!updated) return;

      set((state) => {
        const newVersion = updated.version ?? (state.activeArtifact?.version ?? 1) + 1;
        const patch: Artifact = {
          id,
          type: state.activeArtifact?.type ?? 'code',
          title: updated.title ?? state.activeArtifact?.title ?? '',
          language: updated.language ?? state.activeArtifact?.language,
          content,
          version: newVersion,
        };
        return {
          activeArtifact: state.activeArtifact?.id === id ? patch : state.activeArtifact,
          history: state.history.map((a) => (a.id === id ? patch : a)),
        };
      });
    } catch (err) {
      console.error('Failed to update artifact:', err);
    }
  },

  close() {
    set({ isOpen: false, activeArtifact: null });
  },

  openPrevious(id) {
    const artifact = get().history.find((a) => a.id === id);
    if (artifact) {
      set({ activeArtifact: artifact, isOpen: true });
    }
  },
}));
