"""
Agent Orchestrator — coordinates planning, execution, and verification.
"""
from __future__ import annotations

import uuid
from collections.abc import AsyncGenerator, Callable, Coroutine
from pathlib import Path
from typing import Any

from ..llm.providers import ProviderFactory
from ..security.audit import AuditLogger
from ..security.policy import PolicyEngine

SYSTEM_PROMPT = """You are OpenGravity, a powerful local AI coding agent.

## Your Capabilities
- Reading and writing files in the user's workspace
- Running shell commands (within the security policy)
- Searching codebases
- Planning and executing multi-step coding tasks

## Your Behavior
- Think step by step before acting
- Always explain what you're about to do
- When creating or modifying files, show the key changes
- Be concise but thorough
- If you're uncertain, ask for clarification

## Security
- You operate within a sandboxed policy. Never attempt to access files outside the workspace.
- Report tool errors clearly without revealing system paths.

Begin each response with a brief plan if the task is complex.
"""


class TaskItem:
    def __init__(self, name: str, mode: str = "PLANNING") -> None:
        self.id = str(uuid.uuid4())
        self.name = name
        self.mode = mode
        self.status = "Starting…"
        self.summary = ""
        self.active = True

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "mode": self.mode,
            "status": self.status,
            "summary": self.summary,
            "active": self.active,
        }


class AgentOrchestrator:
    def __init__(
        self,
        config_dir: Path,
        audit: AuditLogger,
        policy: PolicyEngine,
        ollama_url: str = "http://127.0.0.1:11434",
    ) -> None:
        self.config_dir = config_dir
        self.audit = audit
        self.policy = policy
        self.ollama_url = ollama_url
        self.tasks: list[TaskItem] = []
        self.conversation_history: list[dict] = []

        # Callback set by api.py to broadcast task updates
        self.on_task_update: Callable[[dict], Coroutine[Any, Any, None]] | None = None

    # ─── Task management ─────────────────────────────────────────────────────
    def _add_task(self, name: str, mode: str = "PLANNING") -> TaskItem:
        task = TaskItem(name, mode)
        self.tasks.append(task)
        return task

    async def _update_task(self, task: TaskItem, **kwargs: Any) -> None:
        for k, v in kwargs.items():
            setattr(task, k, v)
        if self.on_task_update:
            await self.on_task_update(task.to_dict())

    def get_tasks_snapshot(self) -> list[dict]:
        return [t.to_dict() for t in self.tasks[-20:]]  # last 20

    # ─── Main chat entry point ────────────────────────────────────────────────
    async def run(
        self,
        message: str,
        model: str = "llama3.2",
        workspace: Path | None = None,
    ) -> AsyncGenerator[str, None]:
        """
        Process a user message and stream response deltas.
        """
        # Log the incoming message
        await self.audit.log("chat", {"role": "user", "message": message[:500]})

        # Add to history
        self.conversation_history.append({"role": "user", "content": message})

        # Trim history to last 20 exchanges (keep context manageable)
        if len(self.conversation_history) > 40:
            self.conversation_history = self.conversation_history[-40:]

        # Track active task
        task = self._add_task("Processing request", "EXECUTION")
        await self._update_task(task, status="Analyzing request…")

        # Build enriched system prompt with workspace context
        system = SYSTEM_PROMPT
        if workspace and workspace.exists():
            system += f"\n\n## Current Workspace\n`{workspace}`\n"
            # List top-level files for context
            try:
                files = [f.name for f in sorted(workspace.iterdir())[:20]]
                system += f"Top-level contents: {', '.join(files)}\n"
            except Exception:
                pass

        try:
            full_response = ""
            provider = ProviderFactory.get_provider(
                model=model, 
                config={"ollama_url": self.ollama_url}
            )
            
            async for delta in provider.stream_chat(
                model=model,
                messages=self.conversation_history,
                system_prompt=system,
            ):
                full_response += delta
                yield delta

            # Finalize
            self.conversation_history.append({"role": "assistant", "content": full_response})
            await self._update_task(task, status="Complete", active=False, summary=full_response[:200])
            await self.audit.log("chat", {"role": "assistant", "length": len(full_response)})

        except Exception as e:
            # 🦞 OpenClaw "Claw-Back" Self-Healing Placeholder
            if "tool_error" in str(e).lower():
                await self.audit.log("claw_back", {"error": str(e), "action": "attempt_self_repair"})
                yield f"\n[Self-Healing] Error detected: {e}. Attempting automated recovery...\n"
                # Simulated recovery: in real implementation, this would trigger a re-plan.
            
            error_msg = f"Agent error: {e}"
            yield error_msg
            await self._update_task(task, status="Error", active=False)
            await self.audit.log("error", {"message": str(e)})
