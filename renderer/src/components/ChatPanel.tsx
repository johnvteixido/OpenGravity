import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAgentStore, Message } from '../store/agentStore';
import { useOllamaStore } from '../store/ollamaStore';

interface Props {
  ollamaReady: boolean;
  agentUrl: string;
}

const SUGGESTIONS = [
  { title: 'Scaffold a project', desc: 'Create a new Python FastAPI project with tests and Dockerfile' },
  { title: 'Review my code', desc: 'Analyze the current workspace for bugs and improvements' },
  { title: 'Write documentation', desc: 'Generate a comprehensive README for my project' },
  { title: 'Debug an error', desc: 'Help me understand and fix an error in my code' },
];

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';
  const initials = isUser ? 'You' : 'OG';
  const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`message ${isUser ? 'user' : ''}`}>
      <div className="message-avatar" style={{ fontSize: isUser ? 11 : 13 }}>
        {isUser ? '👤' : '⚡'}
      </div>
      <div className="message-content">
        <div className="message-bubble">
          {msg.content}
          {msg.streaming && <span className="streaming-cursor" />}
        </div>
        <div className="message-time">{time}</div>
      </div>
    </div>
  );
}

export default function ChatPanel({ ollamaReady, agentUrl }: Props) {
  const { messages, addMessage, updateLastMessage, isAgentRunning, setAgentRunning, workspace } = useAgentStore();
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

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isAgentRunning) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    };
    addMessage(userMsg);
    setInput('');

    // Placeholder assistant message
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
            } catch { /* ignore malformed */ }
          }
        }
      }

      updateLastMessage(accumulated || '(No response)', false);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        updateLastMessage('(Cancelled)', false);
      } else {
        updateLastMessage(`Error: Could not reach the agent server at ${agentUrl}. Is it running?`, false);
      }
    } finally {
      setAgentRunning(false);
    }
  }, [agentUrl, selectedModel, workspace, isAgentRunning, addMessage, updateLastMessage, setAgentRunning]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function handleStop() {
    abortRef.current?.abort();
  }

  // Show welcome if no messages
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
            <span style={{ fontSize: 32 }}>⚡</span>
          </div>
          <h1>What would you like to build?</h1>
          <p>OpenGravity agents can plan, code, test, and verify — entirely on your machine.</p>
          <div className="suggestion-grid">
            {SUGGESTIONS.map(s => (
              <div key={s.title} className="suggestion-card" onClick={() => sendMessage(s.desc)}>
                <strong>{s.title}</strong>
                {s.desc}
              </div>
            ))}
          </div>
        </div>
        <div className="input-bar">
          <div className="input-wrapper">
            <textarea
              ref={textareaRef}
              className="chat-input"
              placeholder="Describe what you want to build…"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={!ollamaReady}
            />
            <button className="send-btn" onClick={() => sendMessage(input)} disabled={!input.trim() || !ollamaReady}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 8L14 2L8 14L7 9L2 8Z" fill="white"/>
              </svg>
            </button>
          </div>
          {!ollamaReady && (
            <div style={{ fontSize: 12, color: 'var(--warning)', marginTop: 6, textAlign: 'center' }}>
              ⚠ Ollama is not running. Please complete the setup wizard.
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="chat-container">
      <div className="topbar">
        <span className="topbar-title">Conversation</span>
        <div className="model-badge">
          <div className={`status-dot ${ollamaReady ? '' : 'offline'}`} />
          <span>{selectedModel}</span>
        </div>
        <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }}
          onClick={() => useAgentStore.getState().clearMessages()}>
          New Chat
        </button>
      </div>
      <div className="messages-area">
        {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
        <div ref={messagesEndRef} />
      </div>
      <div className="input-bar">
        <div className="input-wrapper">
          <textarea
            ref={textareaRef}
            className="chat-input"
            placeholder="Continue the conversation… (Enter to send, Shift+Enter for newline)"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={isAgentRunning || !ollamaReady}
          />
          {isAgentRunning ? (
            <button className="send-btn" onClick={handleStop} style={{ background: 'var(--error)' }} title="Stop">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <rect x="2" y="2" width="8" height="8" rx="1" fill="white"/>
              </svg>
            </button>
          ) : (
            <button className="send-btn" onClick={() => sendMessage(input)} disabled={!input.trim() || !ollamaReady}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 8L14 2L8 14L7 9L2 8Z" fill="white"/>
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
