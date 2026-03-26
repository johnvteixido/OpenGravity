import { contextBridge, ipcRenderer } from 'electron';

/**
 * Secure context bridge — exposes a minimal, typed API to the renderer.
 * The renderer has contextIsolation=true and nodeIntegration=false,
 * so this is the ONLY way it can communicate with the main process.
 */
contextBridge.exposeInMainWorld('electronAPI', {
  // Agent server URL
  getAgentUrl: (): Promise<string> => ipcRenderer.invoke('agent:url'),

  // Config directory path
  getConfigDir: (): Promise<string> => ipcRenderer.invoke('config:dir'),

  // Open a native folder picker dialog
  openFolder: (): Promise<string | null> => ipcRenderer.invoke('dialog:openFolder'),

  // Open a path in the system default app
  openPath: (filePath: string): Promise<void> => ipcRenderer.invoke('shell:openPath', filePath),

  // Check if Ollama is running
  checkOllama: (): Promise<{ running: boolean }> => ipcRenderer.invoke('ollama:check'),

  // Platform info
  platform: process.platform,
});
