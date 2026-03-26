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

export default function App() {
  const [view, setView] = useState<View>('chat');
  const [showTaskPanel, setShowTaskPanel] = useState(true);
  const { ollamaReady, setOllamaReady, showWizard, setShowWizard } = useOllamaStore();
  const { agentUrl, setAgentUrl } = useAgentStore();

  // On mount: get agent URL and check Ollama
  useEffect(() => {
    async function init() {
      try {
        const url = await window.electronAPI.getAgentUrl();
        setAgentUrl(url);

        const { running } = await window.electronAPI.checkOllama();
        if (running) {
          setOllamaReady(true);
        } else {
          setShowWizard(true);
        }
      } catch {
        // Running in browser dev mode — skip Electron checks
        setAgentUrl('http://127.0.0.1:7432');
        setOllamaReady(true);
      }
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="app-shell">
      {/* Ollama setup wizard (modal) */}
      {showWizard && <OllamaWizard onComplete={() => { setOllamaReady(true); setShowWizard(false); }} />}

      {/* Left sidebar */}
      <Sidebar activeView={view} onNavigate={setView} onToggleTaskPanel={() => setShowTaskPanel(p => !p)} />

      {/* Main content */}
      <div className="main-panel">
        {view === 'chat'      && <ChatPanel ollamaReady={ollamaReady} agentUrl={agentUrl} />}
        {view === 'settings'  && <SettingsPanel />}
        {view === 'artifacts' && <ArtifactsPanel agentUrl={agentUrl} />}
      </div>

      {/* Right task panel (only visible in chat view) */}
      {view === 'chat' && showTaskPanel && <TaskPanel agentUrl={agentUrl} />}
    </div>
  );
}
