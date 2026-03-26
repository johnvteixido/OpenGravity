# Architecture

OpenGravity utilizes a micro-architecture separated by strict IPC borders to maintain robust security.

## Electron Application (`app/`)

The native wrapper. Runs via a secure `BrowserWindow` with Context Isolation and `nodeIntegration` disabled.

- Spawns the python agent engine silently in the background on startup.
- Restricts renderer communications to explicit commands defined in `preload.ts`.

## React UI (`renderer/`)

The visual dashboard.

- Written in TypeScript with React, built via Vite/SWC.
- Uses Zustand for reactive global state management of Agent contexts and Ollama setup states.
- Connects to the agent using SSE for streaming text, and WebSockets for real-time task visualization.

## Python Agent Engine (`core/`)

The autonomous, thinking core.

- **Orchestration:** `agent/orchestrator.py`
- **Adapters:** `llm/adapter.py` streams directly via HTTP from Ollama.
- **Sandbox Security Layer:** Limits system reach exclusively through `security/policy.py`. Tool operations like `tools/filesystem.py` or `tools/shell.py` evaluate against the policy before execution.
- **Auditing:** `security/audit.py` records 100% of decisions to a locked `audit.jsonl` file.
