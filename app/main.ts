import { app, BrowserWindow, ipcMain, shell, dialog, nativeTheme } from 'electron';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { autoUpdater } from 'electron-updater';
import fs from 'fs';

// ─── Constants ───────────────────────────────────────────────────────────────
const AGENT_PORT = 7432;
const RENDERER_DEV_URL = 'http://localhost:5173';
// Use app.isPackaged — the authoritative Electron signal for packaged vs. dev
// NODE_ENV is unreliable because Electron doesn't inherit shell env vars
const CONFIG_DIR = path.join(app.getPath('home'), '.opengravity');

let mainWindow: BrowserWindow | null = null;
let agentProcess: ChildProcess | null = null;
let agentStartError: string | null = null;

// ─── Ensure config directory ─────────────────────────────────────────────────
function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

// ─── Find Python executable ──────────────────────────────────────────────────
function findPython(): string {
  if (!app.isPackaged) {
    // In dev: prefer the venv python if it exists
    const venvPy = path.join(app.getAppPath(), 'venv/Scripts/python.exe');
    if (fs.existsSync(venvPy)) return venvPy;
  }
  return process.platform === 'win32' ? 'python' : 'python3';
}

// ─── Start Python Agent Server ───────────────────────────────────────────────
function startAgentServer(): Promise<void> {
  return new Promise((resolve) => {
    // app.getAppPath() = the folder with package.json (project root) when not packaged
    // process.resourcesPath = the resources folder inside the .exe when packaged
    const projectRoot = app.isPackaged
      ? process.resourcesPath
      : app.getAppPath();

    const python = findPython();

    console.log(`[Agent] Launching: ${python} -m uvicorn core.server.api:app`);
    console.log(`[Agent] CWD: ${projectRoot}`);
    console.log(`[Agent] isPackaged: ${app.isPackaged}`);

    agentProcess = spawn(
      python,
      ['-m', 'uvicorn', 'core.server.api:app', '--host', '127.0.0.1', '--port', String(AGENT_PORT), '--log-level', 'info'],
      {
        cwd: projectRoot,
        env: {
          ...process.env,
          OG_CONFIG_DIR: CONFIG_DIR,
          OG_PORT: String(AGENT_PORT),
          // Ensure the project root is on the Python path so 'core' is importable
          PYTHONPATH: projectRoot,
        },
      },
    );

    let resolved = false;
    const doResolve = () => {
      if (!resolved) {
        resolved = true;
        resolve();
      }
    };

    agentProcess.stdout?.on('data', (data) => {
      const msg = data.toString();
      console.log('[Agent stdout]', msg.trimEnd());
      if (msg.includes('Application startup complete') || msg.includes('Uvicorn running')) {
        doResolve();
      }
    });

    agentProcess.stderr?.on('data', (data) => {
      const msg = data.toString();
      console.log('[Agent stderr]', msg.trimEnd());
      // uvicorn logs startup to stderr
      if (msg.includes('Application startup complete') || msg.includes('Uvicorn running')) {
        doResolve();
      }
      // Capture real errors (not just info logs)
      if (msg.toLowerCase().includes('error') && !msg.includes('INFO')) {
        agentStartError = msg.slice(0, 500);
      }
    });

    agentProcess.on('error', (err) => {
      console.error('[Agent] Failed to spawn:', err.message);
      agentStartError = `Failed to start Python: ${err.message}`;
      doResolve(); // Don't block the app from opening
    });

    agentProcess.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.error(`[Agent] Exited with code ${code}`);
        if (!agentStartError) agentStartError = `Python process exited with code ${code}`;
      }
      doResolve();
    });

    // Give it up to 20 seconds; resolve anyway so the window opens
    setTimeout(doResolve, 20000);
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
      contextIsolation: true,
      nodeIntegration: false,
      // sandbox:true can break fetch() in some Electron versions when connecting to localhost.
      // Disable it in dev; enable it in production builds.
      sandbox: app.isPackaged,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
    show: false,
    icon: fs.existsSync(path.join(app.getAppPath(), 'assets/icon.png'))
      ? path.join(app.getAppPath(), 'assets/icon.png')
      : undefined,
  });

  // Content Security Policy
  // Allow Google Fonts (style + font domains) and the local agent WS/HTTP
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          `default-src 'self'; ` +
            `script-src 'self' 'unsafe-inline'; ` +
            `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; ` +
            `font-src 'self' https://fonts.gstatic.com data:; ` +
            `connect-src 'self' ws://127.0.0.1:${AGENT_PORT} http://127.0.0.1:${AGENT_PORT} ws://localhost:${AGENT_PORT} http://localhost:${AGENT_PORT} ws://localhost:5173 http://localhost:5173 http://127.0.0.1:11434; ` +
            `img-src 'self' data: blob:; ` +
            `worker-src 'self' blob:`,
        ],
      },
    });
  });

  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  } else {
    // Dev: try Vite dev server first, fall back to built files
    mainWindow.loadURL(RENDERER_DEV_URL).catch(() => {
      console.log('[Main] Vite not running — loading built renderer');
      mainWindow?.loadFile(path.join(__dirname, '../renderer/index.html'));
    });
    mainWindow.webContents.openDevTools();
  }

  // Show once ready to prevent black flash
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();

    // If the agent failed to start, show a non-blocking warning dialog
    if (agentStartError) {
      dialog.showMessageBox(mainWindow!, {
        type: 'warning',
        title: 'OpenGravity — Agent Server Warning',
        message:
          'The Python agent server did not start correctly.\n\n' +
          'Make sure Python dependencies are installed:\n' +
          '  pip install -e core/\n\n' +
          'Error: ' + agentStartError,
        buttons: ['OK'],
        defaultId: 0,
      });
    }
  });

  // Open external links in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ─── IPC Handlers ────────────────────────────────────────────────────────────

ipcMain.handle('agent:url', () => `http://127.0.0.1:${AGENT_PORT}`);
ipcMain.handle('config:dir', () => CONFIG_DIR);

ipcMain.handle('dialog:openFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory'],
    title: 'Open Workspace Folder',
  });
  return result.filePaths[0] ?? null;
});

ipcMain.handle('shell:openPath', async (_event, filePath: string) => {
  await shell.openPath(filePath);
});

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

// Expose whether the agent started successfully
ipcMain.handle('agent:status', () => ({
  ok: agentStartError === null,
  error: agentStartError,
}));

// ─── App Lifecycle ───────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  ensureConfigDir();

  try {
    await startAgentServer();
  } catch (err) {
    console.error('[Main] Agent server failed to start:', err);
  }

  createWindow();

  if (app.isPackaged) {
    try {
      autoUpdater.checkForUpdatesAndNotify();
    } catch {
      // Ignore update errors — they're non-critical
    }
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
