"""
Append-only audit logger.
Every agent tool call, chat message, and error is logged here.
"""
from __future__ import annotations

import asyncio
import json
import os
from datetime import UTC, datetime
from pathlib import Path


class AuditLogger:
    """
    Thread-safe, async, append-only JSONL audit logger.
    File permissions are set to 600 (owner read/write only).
    """

    def __init__(self, log_path: Path) -> None:
        self.log_path = log_path
        self._lock = asyncio.Lock()
        # Ensure file exists with restricted permissions
        if not log_path.exists():
            log_path.touch()
            os.chmod(log_path, 0o600)

    async def log(self, event_type: str, data: dict) -> None:
        """Append an audit entry as a JSONL record."""
        entry = {
            "ts": datetime.now(tz=UTC).isoformat(),
            "type": event_type,
            **data,
        }
        line = json.dumps(entry, default=str) + "\n"
        async with self._lock:
            with open(self.log_path, "a", encoding="utf-8") as f:
                f.write(line)
