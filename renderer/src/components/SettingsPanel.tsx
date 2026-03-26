import { useState } from 'react';
import { useOllamaStore } from '../store/ollamaStore';

const RECOMMENDED_MODELS = [
  'llama3.2',
  'qwen2.5-coder',
  'deepseek-r1:7b',
  'mistral',
  'codellama',
  'phi3',
];

export default function SettingsPanel() {
  const { selectedModel, setSelectedModel, availableModels } = useOllamaStore();
  const [ollamaUrl, setOllamaUrl] = useState('http://127.0.0.1:11434');
  const [customModel, setCustomModel] = useState('');
  const [saved, setSaved] = useState(false);

  const allModels = [
    ...availableModels.map((m) => m.name),
    ...RECOMMENDED_MODELS.filter((m) => !availableModels.find((am) => am.name === m)),
  ];

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="topbar">
        <span className="topbar-title">Settings</span>
      </div>
      <div className="settings-container">
        {/* Model */}
        <div className="settings-section">
          <h2>🤖 AI Model</h2>
          <div className="settings-row">
            <label className="settings-label">Active Model</label>
            <select
              className="settings-input"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
            >
              {allModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <span className="settings-hint">Models are run locally via Ollama.</span>
          </div>
          <div className="settings-row">
            <label className="settings-label">Custom model name</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="settings-input"
                style={{ flex: 1 }}
                placeholder="e.g. llama3.2:70b"
                value={customModel}
                onChange={(e) => setCustomModel(e.target.value)}
              />
              <button
                className="btn btn-ghost"
                onClick={() => {
                  if (customModel) {
                    setSelectedModel(customModel);
                    setCustomModel('');
                  }
                }}
              >
                Use
              </button>
            </div>
          </div>
        </div>

        {/* Ollama */}
        <div className="settings-section">
          <h2>⚙️ Ollama Connection</h2>
          <div className="settings-row">
            <label className="settings-label">Ollama API URL</label>
            <input
              className="settings-input"
              value={ollamaUrl}
              onChange={(e) => setOllamaUrl(e.target.value)}
            />
            <span className="settings-hint">
              Default: http://127.0.0.1:11434 — change only if using a remote Ollama instance.
            </span>
          </div>
        </div>

        {/* Security */}
        <div className="settings-section">
          <h2>🛡️ Security</h2>
          <div
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '14px 16px',
              fontSize: 13,
              color: 'var(--text-secondary)',
              lineHeight: 1.7,
            }}
          >
            <p style={{ marginBottom: 8 }}>
              OpenGravity runs all AI inference locally. Your code and conversations never leave
              this machine.
            </p>
            <p style={{ marginBottom: 8 }}>
              Agent sandbox policy controls what files and network hosts the agent can access. Edit{' '}
              <code>~/.opengravity/policy.json</code> to configure.
            </p>
            <p style={{ margin: 0 }}>
              Audit log: <code>~/.opengravity/audit.jsonl</code>
            </p>
          </div>
        </div>

        {/* About */}
        <div className="settings-section">
          <h2>ℹ️ About</h2>
          <div
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '14px 16px',
              fontSize: 13,
              color: 'var(--text-secondary)',
            }}
          >
            <p>
              <strong style={{ color: 'var(--text-primary)' }}>OpenGravity</strong> v0.1.0
            </p>
            <p>Apache-2.0 License</p>
            <p>
              <a href="https://github.com/johnvteixido/OpenGravity">
                github.com/johnvteixido/OpenGravity
              </a>
            </p>
          </div>
        </div>

        <button className="btn btn-primary" onClick={handleSave} style={{ minWidth: 120 }}>
          {saved ? '✓ Saved' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
