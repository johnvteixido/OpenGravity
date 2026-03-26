import { useEffect, useState } from 'react';

interface Artifact {
  name: string;
  path: string;
  type: string;
  modified: string;
  size: number;
  preview: string;
}

interface Props {
  agentUrl: string;
}

export default function ArtifactsPanel({ agentUrl }: Props) {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [selected, setSelected] = useState<Artifact | null>(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchArtifacts() {
      try {
        const res = await fetch(`${agentUrl}/artifacts`);
        if (res.ok) {
          const data = await res.json();
          setArtifacts(data.artifacts ?? []);
        }
      } catch {
        /* agent not running */
      }
    }
    fetchArtifacts();
    const interval = setInterval(fetchArtifacts, 5000);
    return () => clearInterval(interval);
  }, [agentUrl]);

  async function openArtifact(artifact: Artifact) {
    setSelected(artifact);
    setLoading(true);
    try {
      const res = await fetch(`${agentUrl}/artifacts/${encodeURIComponent(artifact.name)}`);
      if (res.ok) {
        const data = await res.json();
        setContent(data.content ?? '');
      }
    } finally {
      setLoading(false);
    }
  }

  function typeIcon(type: string) {
    if (type === 'task') return '📋';
    if (type === 'implementation_plan') return '📐';
    if (type === 'walkthrough') return '🗺️';
    return '📄';
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="topbar">
        <span className="topbar-title">Artifacts</span>
        {selected && (
          <button
            className="btn btn-ghost"
            style={{ fontSize: 12, padding: '4px 10px' }}
            onClick={() => {
              setSelected(null);
              setContent('');
            }}
          >
            ← Back
          </button>
        )}
      </div>

      {!selected ? (
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {artifacts.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 20px' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📦</div>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: 14,
                  marginBottom: 8,
                  color: 'var(--text-secondary)',
                }}
              >
                No artifacts yet
              </div>
              <div style={{ fontSize: 13 }}>
                Artifacts are generated as the agent works — task lists, plans, walkthroughs.
              </div>
            </div>
          )}
          {artifacts.map((a) => (
            <div
              key={a.name}
              onClick={() => openArtifact(a)}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                padding: '14px 16px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                marginBottom: 10,
                cursor: 'pointer',
                transition: 'border-color 150ms ease, transform 150ms ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              <span style={{ fontSize: 20 }}>{typeIcon(a.type)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{a.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                  {new Date(a.modified).toLocaleString()} · {Math.round(a.size / 1024) || 1}KB
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.5,
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  }}
                >
                  {a.preview}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <span style={{ fontSize: 20 }}>{typeIcon(selected.type)}</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{selected.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {new Date(selected.modified).toLocaleString()}
              </div>
            </div>
          </div>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
              <div className="spinner" />
            </div>
          ) : (
            <pre
              style={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontSize: 13,
                lineHeight: 1.7,
              }}
            >
              {content}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
