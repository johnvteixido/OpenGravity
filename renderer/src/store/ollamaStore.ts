import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface OllamaModel {
  name: string;
  size: number;
  modified_at: string;
}

interface OllamaState {
  ollamaReady: boolean;
  setOllamaReady: (ready: boolean) => void;
  showWizard: boolean;
  setShowWizard: (show: boolean) => void;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  availableModels: OllamaModel[];
  setAvailableModels: (models: OllamaModel[]) => void;
}

export const useOllamaStore = create<OllamaState>()(
  persist(
    (set) => ({
      ollamaReady: false,
      setOllamaReady: (ready) => set({ ollamaReady: ready }),
      showWizard: false,
      setShowWizard: (show) => set({ showWizard: show }),
      selectedModel: 'llama3.2',
      setSelectedModel: (model) => set({ selectedModel: model }),
      availableModels: [],
      setAvailableModels: (models) => set({ availableModels: models }),
    }),
    { name: 'opengravity-ollama', partialize: (s) => ({ selectedModel: s.selectedModel }) },
  ),
);
