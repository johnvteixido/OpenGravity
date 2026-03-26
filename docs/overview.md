# OpenGravity Overview

OpenGravity brings agentic AI coding natively to your desktop.

Unlike cloud-hosted AI tools, OpenGravity provides a secure, locally-hosted execution environment. The entire agent orchestrator, LLM inference engine, and task sandbox run directly on your hardware.

## Key Concepts
1. **Agent-First:** OpenGravity doesn't just autocomplete; it breaks tasks into plans and executes them via tool calls (Filesystem, Shell, Codebase Search).
2. **Total Privacy:** By defaulting to Ollama locally, your code never traverses an external network boundary.
3. **Sandboxed Security:** Agents are inherently risky. OpenGravity uses a strict Declarative Policy Engine to restrict the agent's file system visibility and command execution.

## The Dashboard
The Electron App serves as a cohesive dashboard:
- **Chat:** The primary interface for conversation and agent steering.
- **Task View:** Real-time visibility into the agent's current task boundaries and planning states.
- **Artifacts:** A browser for implementation plans, walkthroughs, and generated reports.
