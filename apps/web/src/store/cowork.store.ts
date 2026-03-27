import { create } from 'zustand';

interface AgentConfig {
  role: string;
  model?: string;
  enabled: boolean;
}

interface AgentMessage {
  agentRole: string;
  content: string;
  sequence: number;
  timestamp: number;
}

export type AgentStatus = 'idle' | 'working' | 'done' | 'failed';

export interface AgentWorkStatus {
  role: string;
  status: AgentStatus;
  startedAt: number | null;
  finishedAt: number | null;
  messageCount: number;
  lastActivity: string;
}

interface CoworkState {
  isOpen: boolean;
  isWorkspaceOpen: boolean;
  sessionId: string | null;
  status: 'idle' | 'running' | 'completed' | 'failed';
  task: string;
  agents: AgentConfig[];
  messages: AgentMessage[];
  agentWorkStatuses: AgentWorkStatus[];
  setOpen: (open: boolean) => void;
  setWorkspaceOpen: (open: boolean) => void;
  setTask: (task: string) => void;
  toggleAgent: (role: string) => void;
  setStatus: (status: CoworkState['status']) => void;
  addMessage: (msg: AgentMessage) => void;
  startSession: (sessionId: string) => void;
  reset: () => void;
}

const DEFAULT_AGENTS: AgentConfig[] = [
  { role: 'architect', enabled: true },
  { role: 'coder', enabled: true },
  { role: 'reviewer', enabled: true },
  { role: 'tester', enabled: false },
  { role: 'security', enabled: false },
  { role: 'researcher', enabled: false },
];

export const useCoworkStore = create<CoworkState>((set) => ({
  isOpen: false,
  isWorkspaceOpen: false,
  sessionId: null,
  status: 'idle',
  task: '',
  agents: [...DEFAULT_AGENTS],
  messages: [],
  agentWorkStatuses: [],
  setOpen: (open) => set({ isOpen: open }),
  setWorkspaceOpen: (open) => set({ isWorkspaceOpen: open }),
  setTask: (task) => set({ task }),
  toggleAgent: (role) => set((state) => ({
    agents: state.agents.map((a) => a.role === role ? { ...a, enabled: !a.enabled } : a),
  })),
  setStatus: (status) => set({ status }),
  addMessage: (msg) => set((state) => {
    const now = Date.now();
    const updatedStatuses = state.agentWorkStatuses.map((s) => {
      if (s.role === msg.agentRole) {
        return {
          ...s,
          status: 'working' as AgentStatus,
          startedAt: s.startedAt ?? now,
          messageCount: s.messageCount + 1,
          lastActivity: msg.content.slice(0, 80),
        };
      }
      return s;
    });
    return {
      messages: [...state.messages, msg],
      agentWorkStatuses: updatedStatuses,
    };
  }),
  startSession: (sessionId) => set((state) => {
    const enabledAgents = state.agents.filter((a) => a.enabled);
    const agentWorkStatuses: AgentWorkStatus[] = enabledAgents.map((a) => ({
      role: a.role,
      status: 'idle',
      startedAt: null,
      finishedAt: null,
      messageCount: 0,
      lastActivity: '',
    }));
    return { sessionId, status: 'running', messages: [], agentWorkStatuses };
  }),
  reset: () => set({
    sessionId: null,
    status: 'idle',
    task: '',
    messages: [],
    agents: [...DEFAULT_AGENTS],
    agentWorkStatuses: [],
    isWorkspaceOpen: false,
  }),
}));
