import { useState, useEffect } from 'react';
import { useOllamaStore } from '../store/ollamaStore';

const RECOMMENDED_MODELS = [
  'llama3.2',
  'qwen2.5-coder',
  'deepseek-r1:7b',
  'mistral',
  'codellama',
  'phi3',
];

interface SecurityPolicy {
  filesystem: {
    allow: string[];
    deny: string[];
  };
  network: {
    allow: string[];
    deny: string[];
  };
  shell: {
    allow_commands: string[];
    deny_patterns: string[];
  };
}

export default function SettingsPanel() {
  const { selectedModel, setSelectedModel, availableModels } = useOllamaStore();
  const [ollamaUrl, setOllamaUrl] = useState('http://127.0.0.1:11434');
  const [customModel, setCustomModel] = useState('');
  const [saved, setSaved] = useState(false);
  const [rustHardened, setRustHardened] = useState<boolean | null>(null);
  const [policy, setPolicy] = useState<SecurityPolicy | null>(null);

  useEffect(() => {
    // Fetch security status
    fetch('http://localhost:7432/health')
      .then((res) => res.json())
      .then((data) => setRustHardened(data.rust_hardened))
      .catch(() => setRustHardened(false));

    // Fetch active policy
    fetch('http://localhost:7432/setup/policy')
      .then((res) => res.json())
      .then((data) => setPolicy(data))
      .catch(() => {});
  }, []);

  const allModels = [
    ...availableModels.map((m) => m.name),
    ...RECOMMENDED_MODELS.filter((m) => !availableModels.find((am) => am.name === m)),
  ];

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
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
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <h2 style={{ margin: 0 }}>🛡️ Security</h2>
            <div
              style={{
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 4,
                fontWeight: 600,
                background: rustHardened ? '#10b98122' : '#f59e0b22',
                color: rustHardened ? '#10b981' : '#f59e0b',
                border: rustHardened ? '1px solid #10b98144' : '1px solid #f59e0b44',
              }}
            >
              {rustHardened ? 'RUST HARDENED' : 'SOFT SANDBOX'}
            </div>
          </div>
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
            {rustHardened && (
              <p style={{ marginBottom: 8, color: 'var(--text-primary)' }}>
                🚀 <strong>Rust security core enabled.</strong> Hardware-accelerated filesystem and
                network guards are active.
              </p>
            )}
            <p style={{ marginBottom: 8 }}>
              Agent sandbox policy controls what files and network hosts the agent can access. Edit{' '}
              <code>~/.opengravity/policy.json</code> to configure.
            </p>

            {policy && (
              <div style={{ marginTop: 12 }}>
                <label
                  style={{
                    fontSize: 11,
                    color: 'var(--text-tertiary)',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                  }}
                >
                  Active Policy View
                </label>
                <pre
                  style={{
                    marginTop: 4,
                    background: 'var(--bg-main)',
                    padding: 12,
                    borderRadius: 6,
                    fontSize: 11,
                    overflowX: 'auto',
                    border: '1px solid var(--border)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {JSON.stringify(policy, null, 2)}
                </pre>
              </div>
            )}

            <p style={{ margin: 0, marginTop: 8 }}>
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
              <strong style={{ color: 'var(--text-primary)' }}>OpenGravity</strong> v0.1.0-hardened
            </p>
            <p>Apache-2.0 License</p>
            <p>
              <a href="https://github.com/johnvteixido/OpenGravity">
                github.com/johnvteixido/OpenGravity
              </a>
            </p>
          </div>
        </div>

        <button
          className="btn btn-primary"
          onClick={handleSave}
          style={{ minWidth: 120, marginBottom: 20 }}
        >
          {saved ? '✓ Saved' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
