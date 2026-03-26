import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  streaming?: boolean;
}

export interface AgentState {
  agentUrl: string;
  setAgentUrl: (url: string) => void;
  messages: Message[];
  addMessage: (msg: Message) => void;
  updateLastMessage: (content: string, streaming: boolean) => void;
  clearMessages: () => void;
  workspace: string | null;
  setWorkspace: (ws: string | null) => void;
  isAgentRunning: boolean;
  setAgentRunning: (running: boolean) => void;
}

export const useAgentStore = create<AgentState>()(
  persist(
    (set) => ({
      agentUrl: 'http://127.0.0.1:7432',
      setAgentUrl: (url) => set({ agentUrl: url }),

      messages: [],
      addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
      updateLastMessage: (content, streaming) =>
        set((s) => {
          const msgs = [...s.messages];
          if (msgs.length > 0) {
            msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content, streaming };
          }
          return { messages: msgs };
        }),
      clearMessages: () => set({ messages: [] }),

      workspace: null,
      setWorkspace: (ws) => set({ workspace: ws }),

      isAgentRunning: false,
      setAgentRunning: (running) => set({ isAgentRunning: running }),
    }),
    { name: 'opengravity-agent', partialize: (s) => ({ messages: s.messages, workspace: s.workspace }) }
  )
);
