import { useEffect, useState } from 'react';

interface TaskItem {
  id: string;
  name: string;
  status: string;
  mode: 'PLANNING' | 'EXECUTION' | 'VERIFICATION';
  summary: string;
  active: boolean;
}

interface Props {
  agentUrl: string;
}

export default function TaskPanel({ agentUrl }: Props) {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let ws: WebSocket;
    let retryTimeout: ReturnType<typeof setTimeout>;

    function connect() {
      const wsUrl = agentUrl.replace('http://', 'ws://').replace('https://', 'wss://');
      ws = new WebSocket(`${wsUrl}/ws/tasks`);

      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        retryTimeout = setTimeout(connect, 3000);
      };
      ws.onerror = () => ws.close();
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'task_update') {
            setTasks((prev) => {
              const idx = prev.findIndex((t) => t.id === data.task.id);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = data.task;
                return next;
              }
              return [...prev, data.task];
            });
          } else if (data.type === 'tasks_snapshot') {
            setTasks(data.tasks);
          }
        } catch {
          /* ignore */
        }
      };
    }

    connect();
    return () => {
      clearTimeout(retryTimeout);
      ws?.close();
    };
  }, [agentUrl]);

  function modeClass(mode: string) {
    return mode.toLowerCase();
  }

  return (
    <div className="task-panel">
      <div className="task-panel-header">
        <span>📋</span>
        <span>Task View</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <div
            className={`status-dot ${connected ? '' : 'offline'}`}
            style={{ width: 6, height: 6 }}
          />
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {connected ? 'Live' : 'Reconnecting…'}
          </span>
        </div>
      </div>

      <div className="task-items">
        {tasks.length === 0 && (
          <div
            style={{
              padding: '24px 16px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: 13,
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 8 }}>🤖</div>
            No active tasks.
            <br />
            <span style={{ color: 'var(--text-secondary)' }}>
              Start a conversation to see agent tasks here.
            </span>
          </div>
        )}
        {tasks.map((task) => (
          <div key={task.id} className={`task-item ${task.active ? 'active' : ''}`}>
            <div className="task-item-header">
              <span style={{ fontSize: 13 }}>{task.active ? '⚡' : '✓'}</span>
              <span className="task-item-name">{task.name}</span>
              <span className={`task-mode-badge ${modeClass(task.mode)}`}>{task.mode}</span>
            </div>
            <div className="task-item-status">{task.status}</div>
            {task.summary && (
              <div
                style={{
                  marginTop: 8,
                  fontSize: 12,
                  color: 'var(--text-muted)',
                  borderTop: '1px solid var(--border-subtle)',
                  paddingTop: 8,
                  lineHeight: 1.5,
                }}
              >
                {task.summary}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
