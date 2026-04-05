/**
 * Type declarations for the Electron preload context bridge.
 * This makes window.electronAPI fully typed throughout the renderer.
 */
export {};

declare global {
  interface Window {
    electronAPI: {
      /** Get the agent server base URL (e.g. http://127.0.0.1:7432) */
      getAgentUrl: () => Promise<string>;
      /** Get the config directory path (~/.opengravity) */
      getConfigDir: () => Promise<string>;
      /** Open a native OS folder picker dialog */
      openFolder: () => Promise<string | null>;
      /** Open a file path in the system default application */
      openPath: (filePath: string) => Promise<void>;
      /** Check if the Ollama service is running */
      checkOllama: () => Promise<{ running: boolean }>;
      /** Get the agent server startup status */
      agentStatus: () => Promise<{ ok: boolean; error: string | null }>;
      /** Current OS platform */
      platform: NodeJS.Platform;
    };
  }
}
