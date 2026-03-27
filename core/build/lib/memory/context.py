"""Memory context manager for handling conversation history and file context."""
from __future__ import annotations

from pathlib import Path


class MemoryContext:
    def __init__(self, max_history: int = 40) -> None:
        self.history: list[dict] = []
        self.max_history = max_history
        self.file_context: dict[str, str] = {}

    def add_message(self, role: str, content: str) -> None:
        """Add a message to the conversation history."""
        self.history.append({"role": role, "content": content})
        if len(self.history) > self.max_history:
            self.history = self.history[-self.max_history:]

    def add_file_context(self, file_path: Path, content: str) -> None:
        """Add file content to the active context window."""
        self.file_context[str(file_path)] = content

    def remove_file_context(self, file_path: Path) -> None:
        """Remove file content from the active context window."""
        self.file_context.pop(str(file_path), None)

    def get_messages(self) -> list[dict]:
        """Return the conversation history with injected file context."""
        messages = list(self.history)
        if self.file_context:
            context_str = "\n".join([f"--- {p} ---\n{c}" for p, c in self.file_context.items()])
            messages.insert(0, {"role": "system", "content": f"Active File Context:\n{context_str}"})
        return messages
