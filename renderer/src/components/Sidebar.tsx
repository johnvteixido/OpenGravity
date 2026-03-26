import { View } from '../App';
import { useAgentStore } from '../store/agentStore';
import { useOllamaStore } from '../store/ollamaStore';

interface Props {
  activeView: View;
  onNavigate: (v: View) => void;
  onToggleTaskPanel: () => void;
}

function NavItem({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick} title={label}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

export default function Sidebar({ activeView, onNavigate, onToggleTaskPanel }: Props) {
  const { workspace, setWorkspace } = useAgentStore();
  const { selectedModel, ollamaReady } = useOllamaStore();

  async function handleOpenFolder() {
    try {
      const folder = await window.electronAPI.openFolder();
      if (folder) setWorkspace(folder);
    } catch { /* browser dev mode */ }
  }

  const shortWorkspace = workspace
    ? workspace.split(/[\\/]/).pop() ?? workspace
    : 'No workspace';

  return (
    <div className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <defs>
            <linearGradient id="og-grad" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
              <stop stopColor="#a78bfa"/>
              <stop offset="1" stopColor="#60a5fa"/>
            </linearGradient>
          </defs>
          <rect width="28" height="28" rx="8" fill="url(#og-grad)" opacity="0.15"/>
          <path d="M14 5L20 9.5V18.5L14 23L8 18.5V9.5L14 5Z" stroke="url(#og-grad)" strokeWidth="1.8" fill="none"/>
          <circle cx="14" cy="14" r="3" fill="url(#og-grad)"/>
        </svg>
        <span className="sidebar-logo-text">OpenGravity</span>
      </div>

      {/* Navigation */}
      <div className="sidebar-nav">
        <div className="sidebar-section">Navigation</div>
        <NavItem icon="💬" label="Chat" active={activeView === 'chat'} onClick={() => onNavigate('chat')} />
        <NavItem icon="📦" label="Artifacts" active={activeView === 'artifacts'} onClick={() => onNavigate('artifacts')} />
        <NavItem icon="⚙️" label="Settings" active={activeView === 'settings'} onClick={() => onNavigate('settings')} />

        <div className="sidebar-section" style={{ marginTop: 16 }}>Tools</div>
        <NavItem icon="📋" label="Task Panel" active={false} onClick={onToggleTaskPanel} />
      </div>

      {/* Footer */}
      <div className="sidebar-footer">
        {/* Model status */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 10px',
          fontSize: 12,
          color: 'var(--text-muted)',
          marginBottom: 8,
        }}>
          <div className={`status-dot ${ollamaReady ? '' : 'offline'}`} />
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {ollamaReady ? selectedModel : 'Ollama offline'}
          </span>
        </div>

        {/* Workspace */}
        <div className="workspace-badge" onClick={handleOpenFolder} title={workspace ?? 'Click to open workspace'}>
          <span>📁</span>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {shortWorkspace}
          </span>
          <span style={{ opacity: 0.5 }}>⌄</span>
        </div>
      </div>
    </div>
  );
}
