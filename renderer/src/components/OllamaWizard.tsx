import { useState, useEffect } from 'react';
import { useOllamaStore } from '../store/ollamaStore';

interface Props {
  onComplete: () => void;
}

type Step = 'detect' | 'install' | 'model' | 'done';

const RECOMMENDED_MODELS = [
  { id: 'llama3.2', label: 'Llama 3.2 (3B)', desc: 'Fast, great for most tasks. 2 GB.' },
  {
    id: 'qwen2.5-coder',
    label: 'Qwen 2.5 Coder (7B)',
    desc: 'Excellent for coding tasks. 4.7 GB.',
  },
  { id: 'deepseek-r1:7b', label: 'DeepSeek R1 (7B)', desc: 'Strong reasoning. 4.7 GB.' },
  { id: 'mistral', label: 'Mistral (7B)', desc: 'Fast and capable general model. 4.1 GB.' },
];

export default function OllamaWizard({ onComplete }: Props) {
  const [step, setStep] = useState<Step>('detect');
  const [checking, setChecking] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [pullProgress, setPullProgress] = useState('');
  const { selectedModel, setSelectedModel, setAvailableModels } = useOllamaStore();

  // Check Ollama on mount
  useEffect(() => {
    async function detect() {
      setChecking(true);
      try {
        const res = await fetch('http://127.0.0.1:11434/api/tags');
        if (res.ok) {
          const data = await res.json();
          const models = data.models ?? [];
          setAvailableModels(models);
          if (models.length > 0) {
            setSelectedModel(models[0].name);
            setStep('done');
          } else {
            setStep('model');
          }
        } else {
          setStep('install');
        }
      } catch {
        setStep('install');
      }
      setChecking(false);
    }
    detect();
  }, []);

  async function handleInstallOllama() {
    setInstalling(true);
    try {
      // Call agent server to run the platform-appropriate install script
      const res = await fetch('http://127.0.0.1:7432/setup/install-ollama', { method: 'POST' });
      if (res.ok) {
        // Wait a moment and re-check
        await new Promise((r) => setTimeout(r, 5000));
        const check = await fetch('http://127.0.0.1:11434/api/tags');
        if (check.ok) setStep('model');
      }
    } finally {
      setInstalling(false);
    }
  }

  async function handlePullModel() {
    setPulling(true);
    setPullProgress('Starting download…');
    try {
      const res = await fetch('http://127.0.0.1:11434/api/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: selectedModel, stream: true }),
      });
      if (!res.body) throw new Error('No stream');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value).split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const obj = JSON.parse(line);
            if (obj.status)
              setPullProgress(
                obj.status + (obj.completed ? ` (${Math.round(obj.completed / 1e6)}MB)` : ''),
              );
            if (obj.status === 'success') setStep('done');
          } catch {
            /* ignore */
          }
        }
      }
    } finally {
      setPulling(false);
    }
  }

  return (
    <div className="wizard-overlay">
      <div className="wizard-card">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div
            style={{
              width: 48,
              height: 48,
              background: 'linear-gradient(135deg, #7c3aed, #3b82f6)',
              borderRadius: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
            }}
          >
            ⚡
          </div>
          <div>
            <h2 style={{ marginBottom: 0 }}>Welcome to OpenGravity</h2>
            <p style={{ margin: 0, fontSize: 13 }}>Let's get your AI agent ready.</p>
          </div>
        </div>

        {/* Step: detecting */}
        {checking && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              color: 'var(--text-secondary)',
            }}
          >
            <div className="spinner" />
            <span>Detecting Ollama…</span>
          </div>
        )}

        {/* Step: install */}
        {!checking && step === 'install' && (
          <div>
            <p>
              Ollama was not found on your system. OpenGravity uses Ollama to run AI models locally.
            </p>
            <div
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '14px 16px',
                marginBottom: 20,
                fontSize: 13,
                color: 'var(--text-secondary)',
              }}
            >
              <strong style={{ color: 'var(--text-primary)' }}>What is Ollama?</strong>
              <br />
              Ollama is a free, open-source tool that runs large language models on your own
              computer. All AI inference stays on-device — no data sent to the cloud.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="btn btn-primary"
                onClick={handleInstallOllama}
                disabled={installing}
                style={{ flex: 1 }}
              >
                {installing ? (
                  <>
                    <div className="spinner" style={{ width: 14, height: 14 }} /> Installing…
                  </>
                ) : (
                  '⬇ Install Ollama Automatically'
                )}
              </button>
              <a
                href="https://ollama.com/download"
                className="btn btn-ghost"
                target="_blank"
                rel="noopener"
                onClick={(e) => {
                  e.preventDefault();
                  window.electronAPI?.openPath('https://ollama.com/download');
                }}
              >
                Manual
              </a>
            </div>
          </div>
        )}

        {/* Step: model selection */}
        {!checking && step === 'model' && (
          <div>
            <p>Ollama is ready! Choose your first AI model to download:</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {RECOMMENDED_MODELS.map((m) => (
                <div
                  key={m.id}
                  onClick={() => setSelectedModel(m.id)}
                  style={{
                    padding: '12px 14px',
                    background:
                      selectedModel === m.id ? 'var(--accent-glow)' : 'var(--bg-elevated)',
                    border: `1px solid ${selectedModel === m.id ? 'rgba(124,58,237,0.5)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    transition: 'all 150ms ease',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>
                    {m.label}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {m.desc}
                  </div>
                </div>
              ))}
            </div>
            {pullProgress && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                {pullProgress}
              </div>
            )}
            <button
              className="btn btn-primary"
              onClick={handlePullModel}
              disabled={pulling}
              style={{ width: '100%' }}
            >
              {pulling ? (
                <>
                  <div className="spinner" style={{ width: 14, height: 14 }} /> Downloading…
                </>
              ) : (
                `⬇ Download ${selectedModel}`
              )}
            </button>
          </div>
        )}

        {/* Step: done */}
        {!checking && step === 'done' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
            <h2 style={{ marginBottom: 8 }}>You're all set!</h2>
            <p style={{ marginBottom: 24 }}>
              Ollama is running with <strong>{selectedModel}</strong>.<br />
              Your AI agent is ready to work.
            </p>
            <button
              className="btn btn-primary"
              onClick={onComplete}
              style={{ width: '100%', padding: '12px' }}
            >
              Open OpenGravity →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
