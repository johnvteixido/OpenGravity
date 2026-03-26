// Global type declarations for the Electron context bridge API
interface ElectronAPI {
  getAgentUrl: () => Promise<string>;
  getConfigDir: () => Promise<string>;
  openFolder: () => Promise<string | null>;
  openPath: (filePath: string) => Promise<void>;
  checkOllama: () => Promise<{ running: boolean }>;
  platform: NodeJS.Platform;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
