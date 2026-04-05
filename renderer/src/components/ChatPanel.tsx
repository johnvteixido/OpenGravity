import { useState, useRef, useEffect, useCallback } from 'react';
import { useAgentStore, Message } from '../store/agentStore';
import { useOllamaStore } from '../store/ollamaStore';

interface Props {
  ollamaReady: boolean;
  agentUrl: string;
}

const SUGGESTIONS = [
  {
    title: 'Scaffold a project',
    desc: 'Create a new Python FastAPI project with tests and a Dockerfile',
  },
  { title: 'Review my code', desc: 'Analyze the current workspace for bugs and improvements' },
  { title: 'Write documentation', desc: 'Generate a comprehensive README for my project' },
  { title: 'Debug an error', desc: 'Help me understand and fix this error in my code' },
];

// ── Minimal markdown renderer ─────────────────────────────────────────────────
// Handles code blocks, inline code, bold, italic, headers, and line breaks
// without requiring a heavy dependency like react-markdown.
function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split('\n');
  const nodes: React.ReactNode[] = [];
  let i = 0;
  let keyCounter = 0;
  const key = () => keyCounter++;

  while (i < lines.length) {
    const line = lines[i];

    // ── Fenced code block ```lang\n...\n``` ──────────────────────────────────
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      nodes.push(
        <div key={key()} className="code-block-wrapper">
          {lang && <div className="code-lang-badge">{lang}</div>}
          <pre className="code-block">
            <code>{codeLines.join('\n')}</code>
          </pre>
        </div>,
      );
      i++; // skip closing ```
      continue;
    }

    // ── ATX Headers # ## ### ─────────────────────────────────────────────────
    const hMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (hMatch) {
      const level = hMatch[1].length;
      const content = hMatch[2];
      const Tag = `h${level + 2}` as keyof JSX.IntrinsicElements; // h3 h4 h5
      nodes.push(
        <Tag key={key()} style={{ margin: '12px 0 6px', color: 'var(--text-primary)' }}>
          {renderInline(content)}
        </Tag>,
      );
      i++;
      continue;
    }

    // ── Horizontal rule ───────────────────────────────────────────────────────
    if (line.match(/^(-{3,}|\*{3,}|_{3,})$/)) {
      nodes.push(<hr key={key()} style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '12px 0' }} />);
      i++;
      continue;
    }

    // ── Bullet / ordered list ─────────────────────────────────────────────────
    if (line.match(/^(\s*[-*+]|\s*\d+\.)\s/)) {
      const listItems: string[] = [];
      while (i < lines.length && lines[i].match(/^(\s*[-*+]|\s*\d+\.)\s/)) {
        listItems.push(lines[i].replace(/^\s*[-*+\d.]+\s/, ''));
        i++;
      }
      const isOrdered = line.match(/^\s*\d+\./);
      const ListTag = isOrdered ? 'ol' : 'ul';
      nodes.push(
        <ListTag key={key()} style={{ paddingLeft: 20, margin: '6px 0' }}>
          {listItems.map((item, idx) => (
            <li key={idx} style={{ margin: '3px 0', color: 'var(--text-primary)' }}>
              {renderInline(item)}
            </li>
          ))}
        </ListTag>,
      );
      continue;
    }

    // ── Empty line → spacing ──────────────────────────────────────────────────
    if (line.trim() === '') {
      nodes.push(<div key={key()} style={{ height: 8 }} />);
      i++;
      continue;
    }

    // ── Normal paragraph ──────────────────────────────────────────────────────
    nodes.push(
      <p key={key()} style={{ margin: '4px 0', lineHeight: 1.65 }}>
        {renderInline(line)}
      </p>,
    );
    i++;
  }

  return <>{nodes}</>;
}

// Renders inline markdown: `code`, **bold**, *italic*, [link](url)
function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  // Pattern: `code` | **bold** | *italic* | [text](url)
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let match;
  let k = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const m = match[0];
    if (m.startsWith('`')) {
      parts.push(
        <code key={k++} className="inline-code">{m.slice(1, -1)}</code>,
      );
    } else if (m.startsWith('**')) {
      parts.push(<strong key={k++}>{m.slice(2, -2)}</strong>);
    } else if (m.startsWith('*')) {
      parts.push(<em key={k++}>{m.slice(1, -1)}</em>);
    } else if (m.startsWith('[')) {
      const linkText = m.match(/\[([^\]]+)\]/)?.[1] ?? '';
      const href = m.match(/\(([^)]+)\)/)?.[1] ?? '#';
      parts.push(
        <a key={k++} href={href} target="_blank" rel="noopener noreferrer">
          {linkText}
        </a>,
      );
    }
    last = match.index + m.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length > 0 ? <>{parts}</> : text;
}

// ── Message bubble ─────────────────────────────────────────────────────────────
function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';
  const time = new Date(msg.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className={`message ${isUser ? 'user' : ''}`}>
      <div className="message-avatar" style={{ fontSize: isUser ? 11 : 13 }}>
        {isUser ? '👤' : '⚡'}
      </div>
      <div className="message-content">
        <div className="message-bubble">
          {isUser ? (
            // User messages: plain text
            <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {msg.content}
            </span>
          ) : (
            // Agent messages: rendered markdown
            <div className="markdown-body">
              {msg.streaming && !msg.content ? (
                <span style={{ color: 'var(--text-muted)' }}>Thinking…</span>
              ) : (
                renderMarkdown(msg.content)
              )}
              {msg.streaming && <span className="streaming-cursor" />}
            </div>
          )}
        </div>
        <div className="message-time">{time}</div>
      </div>
    </div>
  );
}

// ── Main ChatPanel component ───────────────────────────────────────────────────
export default function ChatPanel({ ollamaReady, agentUrl }: Props) {
  const { messages, addMessage, updateLastMessage, isAgentRunning, setAgentRunning, workspace } =
    useAgentStore();
  const { selectedModel } = useOllamaStore();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isAgentRunning) return;

      const userMsg: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: text.trim(),
        timestamp: new Date(),
      };
      addMessage(userMsg);
      setInput('');

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        streaming: true,
      };
      addMessage(assistantMsg);
      setAgentRunning(true);

      abortRef.current = new AbortController();

      try {
        const res = await fetch(`${agentUrl}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text.trim(),
            model: selectedModel,
            workspace: workspace ?? null,
          }),
          signal: abortRef.current.signal,
        });

        if (!res.ok) {
          const body = await res.text().catch(() => '');
          throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
        }

        if (!res.body) throw new Error('No response stream');
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;
              try {
                const obj = JSON.parse(data);
                if (obj.delta) {
                  accumulated += obj.delta;
                  updateLastMessage(accumulated, true);
                }
              } catch {
                /* ignore malformed SSE lines */
              }
            }
          }
        }

        updateLastMessage(accumulated || '(No response)', false);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          updateLastMessage('(Cancelled)', false);
        } else if (err instanceof Error && err.message.includes('fetch')) {
          updateLastMessage(
            `⚠️ Could not reach the agent server at \`${agentUrl}\`.\n\n` +
              `Make sure the Python backend is running:\n` +
              `\`\`\`\ncd core && python -m uvicorn server.api:app --port 7432\n\`\`\``,
            false,
          );
        } else {
          updateLastMessage(
            `⚠️ Error: ${err instanceof Error ? err.message : String(err)}`,
            false,
          );
        }
      } finally {
        setAgentRunning(false);
      }
    },
    [agentUrl, selectedModel, workspace, isAgentRunning, addMessage, updateLastMessage, setAgentRunning],
  );

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function handleStop() {
    abortRef.current?.abort();
  }

  // ── Input bar (shared between welcome + chat view) ─────────────────────────
  function InputBar({ disabled }: { disabled: boolean }) {
    return (
      <div className="input-bar">
        <div className="input-wrapper">
          <textarea
            ref={textareaRef}
            className="chat-input"
            placeholder={
              !ollamaReady
                ? 'Complete Ollama setup to start chatting…'
                : 'Describe what you want to build… (Enter to send, Shift+Enter for newline)'
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={disabled}
            id="chat-input"
          />
          {isAgentRunning ? (
            <button
              className="send-btn"
              onClick={handleStop}
              style={{ background: 'var(--error)' }}
              title="Stop generation"
              id="stop-btn"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <rect x="2" y="2" width="8" height="8" rx="1" fill="white" />
              </svg>
            </button>
          ) : (
            <button
              className="send-btn"
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || disabled}
              title="Send message"
              id="send-btn"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 8L14 2L8 14L7 9L2 8Z" fill="white" />
              </svg>
            </button>
          )}
        </div>
        {!ollamaReady && (
          <div style={{ fontSize: 12, color: 'var(--warning)', marginTop: 6, textAlign: 'center' }}>
            ⚠ Ollama is not running. Please complete the setup wizard.
          </div>
        )}
      </div>
    );
  }

  // ── Welcome / empty state ──────────────────────────────────────────────────
  if (messages.length === 0) {
    return (
      <div className="chat-container">
        <div className="topbar">
          <span className="topbar-title">New Conversation</span>
          <div className="model-badge">
            <div className={`status-dot ${ollamaReady ? '' : 'offline'}`} />
            <span>{selectedModel}</span>
          </div>
        </div>
        <div className="welcome">
          <div className="welcome-icon">
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
              <defs>
                <linearGradient id="wg" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#a78bfa" />
                  <stop offset="1" stopColor="#60a5fa" />
                </linearGradient>
              </defs>
              <path d="M18 4L28 10.5V25.5L18 32L8 25.5V10.5L18 4Z" stroke="url(#wg)" strokeWidth="2" fill="none" />
              <circle cx="18" cy="18" r="5" fill="url(#wg)" />
            </svg>
          </div>
          <h1>What would you like to build?</h1>
          <p>
            OpenGravity agents can plan, code, test, and verify — entirely on your machine. Powered
            by Ollama with no data ever leaving your device.
          </p>
          <div className="suggestion-grid">
            {SUGGESTIONS.map((s) => (
              <div
                key={s.title}
                className="suggestion-card"
                onClick={() => sendMessage(s.desc)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage(s.desc)}
              >
                <strong>{s.title}</strong>
                {s.desc}
              </div>
            ))}
          </div>
        </div>
        <InputBar disabled={!ollamaReady || isAgentRunning} />
      </div>
    );
  }

  // ── Active conversation ────────────────────────────────────────────────────
  return (
    <div className="chat-container">
      <div className="topbar">
        <span className="topbar-title">Conversation</span>
        <div className="model-badge">
          <div className={`status-dot ${ollamaReady ? '' : 'offline'}`} />
          <span>{selectedModel}</span>
        </div>
        <button
          className="btn btn-ghost"
          style={{ fontSize: 12, padding: '4px 10px' }}
          onClick={() => useAgentStore.getState().clearMessages()}
          id="new-chat-btn"
        >
          New Chat
        </button>
      </div>
      <div className="messages-area">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>
      <InputBar disabled={isAgentRunning || !ollamaReady} />
    </div>
  );
}
