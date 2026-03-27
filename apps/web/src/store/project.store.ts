import { create } from 'zustand';

export interface Project {
  id: string;
  name: string;
  description?: string | null;
  systemPrompt?: string | null;
  rootPath?: string | null;
  createdAt: number;
  updatedAt: number;
}

interface ProjectStore {
  projects: Project[];
  currentProjectId: string | null;
  setCurrentProject(id: string | null): void;
  loadProjects(): Promise<void>;
  createProject(data: { name: string; description?: string; systemPrompt?: string; rootPath?: string }): Promise<Project | null>;
  deleteProject(id: string): Promise<void>;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  currentProjectId: null,

  setCurrentProject(id) {
    set({ currentProjectId: id });
  },

  async loadProjects() {
    try {
      const resp = await fetch('/api/v1/projects');
      if (!resp.ok) return;
      const data = await resp.json();
      const projects = Array.isArray(data) ? data : data.projects ?? [];
      set({ projects });
    } catch (err) {
      console.error('Failed to load projects:', err);
    }
  },

  async createProject(data) {
    try {
      const resp = await fetch('/api/v1/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!resp.ok) return null;
      const project = await resp.json() as Project;
      set(state => ({ projects: [...state.projects, project] }));
      return project;
    } catch (err) {
      console.error('Failed to create project:', err);
      return null;
    }
  },

  async deleteProject(id) {
    try {
      await fetch(`/api/v1/projects/${id}`, { method: 'DELETE' });
      set(state => ({
        projects: state.projects.filter(p => p.id !== id),
        currentProjectId: state.currentProjectId === id ? null : state.currentProjectId,
      }));
    } catch (err) {
      console.error('Failed to delete project:', err);
    }
  },
}));
