import { app, BrowserWindow, ipcMain, shell, dialog, nativeTheme } from 'electron';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { autoUpdater } from 'electron-updater';
import fs from 'fs';

// ─── Constants ───────────────────────────────────────────────────────────────
const AGENT_PORT = 7432;
const RENDERER_DEV_URL = 'http://localhost:5173';
const IS_DEV = process.env.NODE_ENV === 'development';
const CONFIG_DIR = path.join(app.getPath('home'), '.opengravity');

let mainWindow: BrowserWindow | null = null;
let agentProcess: ChildProcess | null = null;

// ─── Ensure config directory ─────────────────────────────────────────────────
function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
}

// ─── Start Python Agent Server ───────────────────────────────────────────────
function startAgentServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    const corePath = IS_DEV
      ? path.join(__dirname, '../../core')
      : path.join(process.resourcesPath, 'core');

    const python = process.platform === 'win32' ? 'python' : 'python3';

    agentProcess = spawn(
      python,
      ['-m', 'uvicorn', 'server.api:app', '--host', '127.0.0.1', '--port', String(AGENT_PORT)],
      {
        cwd: corePath,
        env: {
          ...process.env,
          OG_CONFIG_DIR: CONFIG_DIR,
          OG_PORT: String(AGENT_PORT),
        },
      },
    );

    agentProcess.stdout?.on('data', (data) => {
      const msg = data.toString();
      if (msg.includes('Application startup complete')) resolve();
    });

    agentProcess.stderr?.on('data', (data) => {
      const msg = data.toString();
      // FastAPI/uvicorn logs go to stderr normally
      if (msg.includes('Application startup complete')) resolve();
    });

    agentProcess.on('error', (err) => {
      console.error('[Agent] Failed to start:', err);
      reject(err);
    });

    // Give it up to 15 seconds to start
    setTimeout(() => resolve(), 15000);
  });
}

// ─── Create Main Window ──────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0d1117' : '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, // Security: renderer isolated from Node
      nodeIntegration: false, // Security: no Node in renderer
      sandbox: true, // Security: OS-level sandbox
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
    show: false, // Don't show until ready
    icon: path.join(__dirname, '../../assets/icon.png'),
  });

  // Content Security Policy
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          `default-src 'self'; ` +
            `script-src 'self'; ` +
            `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; ` +
            `font-src 'self' https://fonts.gstatic.com; ` +
            `connect-src 'self' ws://127.0.0.1:${AGENT_PORT} http://127.0.0.1:${AGENT_PORT}; ` +
            `img-src 'self' data: blob:`,
        ],
      },
    });
  });

  if (IS_DEV) {
    mainWindow.loadURL(RENDERER_DEV_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Show once ready to prevent flash
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Open external links in system browser, not Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ─── IPC Handlers ────────────────────────────────────────────────────────────

// Get agent server URL
ipcMain.handle('agent:url', () => `http://127.0.0.1:${AGENT_PORT}`);

// Get config directory path
ipcMain.handle('config:dir', () => CONFIG_DIR);

// Open workspace folder dialog
ipcMain.handle('dialog:openFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory'],
    title: 'Open Workspace Folder',
  });
  return result.filePaths[0] ?? null;
});

// Open a file in the system default app
ipcMain.handle('shell:openPath', async (_event, filePath: string) => {
  await shell.openPath(filePath);
});

// Check Ollama status
ipcMain.handle('ollama:check', async () => {
  try {
    const res = await fetch('http://127.0.0.1:11434/api/tags', {
      signal: AbortSignal.timeout(3000),
    });
    return { running: res.ok };
  } catch {
    return { running: false };
  }
});

// ─── App Lifecycle ───────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  ensureConfigDir();

  try {
    await startAgentServer();
  } catch (err) {
    console.error('[Main] Agent server failed to start:', err);
  }

  createWindow();

  if (!IS_DEV) {
    autoUpdater.checkForUpdatesAndNotify();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  if (agentProcess) {
    agentProcess.kill();
    agentProcess = null;
  }
});

// ─── Security: Block new window creation ─────────────────────────────────────
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event, url) => {
    const parsedUrl = new URL(url);
    const allowed = ['localhost', '127.0.0.1'];
    if (!allowed.includes(parsedUrl.hostname)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
});
