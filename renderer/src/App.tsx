import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ChatPanel from './components/ChatPanel';
import TaskPanel from './components/TaskPanel';
import SettingsPanel from './components/SettingsPanel';
import ArtifactsPanel from './components/ArtifactsPanel';
import OllamaWizard from './components/OllamaWizard';
import { useAgentStore } from './store/agentStore';
import { useOllamaStore } from './store/ollamaStore';

export type View = 'chat' | 'settings' | 'artifacts';

type InitState = 'loading' | 'ready' | 'agent-error' | 'browser-dev';

export default function App() {
  const [view, setView] = useState<View>('chat');
  const [showTaskPanel, setShowTaskPanel] = useState(true);
  const [initState, setInitState] = useState<InitState>('loading');
  const [agentError, setAgentError] = useState<string | null>(null);

  const { ollamaReady, setOllamaReady, showWizard, setShowWizard } = useOllamaStore();
  const { agentUrl, setAgentUrl } = useAgentStore();

  useEffect(() => {
    async function init() {
      // ── Running inside Electron ──────────────────────────────────────────
      if (typeof window.electronAPI !== 'undefined') {
        try {
          const url = await window.electronAPI.getAgentUrl();
          setAgentUrl(url);
        } catch {
          setAgentUrl('http://127.0.0.1:7432');
        }

        // Check agent server status first
        try {
          const status = await window.electronAPI.agentStatus();
          if (!status.ok && status.error) {
            setAgentError(status.error);
            setInitState('agent-error');
            return;
          }
        } catch {
          // agentStatus IPC not available on older build — ignore
        }

        // Check Ollama
        try {
          const { running } = await window.electronAPI.checkOllama();
          if (running) {
            setOllamaReady(true);
            setInitState('ready');
          } else {
            setShowWizard(true);
            setInitState('ready');
          }
        } catch {
          // Ollama check failed — show wizard anyway
          setShowWizard(true);
          setInitState('ready');
        }
      } else {
        // ── Running in browser / Vite dev mode (no Electron) ────────────
        setAgentUrl('http://127.0.0.1:7432');

        // Try to connect to the Python backend directly
        try {
          const res = await fetch('http://127.0.0.1:7432/health', {
            signal: AbortSignal.timeout(2000),
          });
          if (res.ok) {
            setOllamaReady(true);
          } else {
            setShowWizard(true);
          }
        } catch {
          // Backend not running — show the wizard
          setShowWizard(true);
        }
        setInitState('browser-dev');
      }
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Loading splash ────────────────────────────────────────────────────────
  if (initState === 'loading') {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          gap: 16,
          background: 'var(--bg-base)',
        }}
      >
        <div className="spinner" style={{ width: 32, height: 32 }} />
        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>
          Starting OpenGravity…
        </span>
      </div>
    );
  }

  // ── Agent crashed during startup ──────────────────────────────────────────
  if (initState === 'agent-error') {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          gap: 20,
          padding: 40,
          background: 'var(--bg-base)',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 48 }}>⚠️</div>
        <h2 style={{ color: 'var(--text-primary)' }}>Agent Server Failed to Start</h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: 480 }}>
          The Python backend could not start. Make sure the dependencies are installed:
        </p>
        <pre
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 20px',
            fontSize: 13,
            color: 'var(--text-code)',
            maxWidth: 560,
            textAlign: 'left',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}
        >
          pip install -e core/
        </pre>
        {agentError && (
          <details style={{ maxWidth: 560, width: '100%' }}>
            <summary style={{ color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12 }}>
              Error details
            </summary>
            <pre
              style={{
                marginTop: 8,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--error)',
                borderRadius: 'var(--radius-sm)',
                padding: 12,
                fontSize: 11,
                color: 'var(--error)',
                textAlign: 'left',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {agentError}
            </pre>
          </details>
        )}
        <button
          className="btn btn-primary"
          onClick={() => window.location.reload()}
          style={{ marginTop: 8 }}
        >
          Retry
        </button>
      </div>
    );
  }

  // ── Main application shell ────────────────────────────────────────────────
  return (
    <div className="app-shell">
      {/* Ollama setup wizard (modal overlay) */}
      {showWizard && (
        <OllamaWizard
          onComplete={() => {
            setOllamaReady(true);
            setShowWizard(false);
          }}
        />
      )}

      {/* Left sidebar navigation */}
      <Sidebar
        activeView={view}
        onNavigate={setView}
        onToggleTaskPanel={() => setShowTaskPanel((p) => !p)}
      />

      {/* Main content panel */}
      <div className="main-panel">
        {view === 'chat' && <ChatPanel ollamaReady={ollamaReady} agentUrl={agentUrl} />}
        {view === 'settings' && <SettingsPanel />}
        {view === 'artifacts' && <ArtifactsPanel agentUrl={agentUrl} />}
      </div>

      {/* Right task panel (only in chat view) */}
      {view === 'chat' && showTaskPanel && <TaskPanel agentUrl={agentUrl} />}
    </div>
  );
}
