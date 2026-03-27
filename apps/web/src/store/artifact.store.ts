import { create } from 'zustand';

export interface Artifact {
  id: string;
  type: 'code' | 'html' | 'mermaid' | 'react' | 'text';
  title: string;
  language?: string;
  content: string;
}

interface ArtifactStore {
  activeArtifact: Artifact | null;
  isOpen: boolean;
  history: Artifact[];

  setArtifact(artifact: Artifact): void;
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
