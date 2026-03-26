"""Sandboxed filesystem tool."""
from __future__ import annotations

from pathlib import Path

import aiofiles

from ..security.audit import AuditLogger
from ..security.policy import PolicyEngine, PolicyViolation


class FileSystemTool:
    def __init__(self, policy: PolicyEngine, audit: AuditLogger) -> None:
        self.policy = policy
        self.audit = audit

    async def read_file(self, path: Path, workspace: Path | None = None) -> str:
        self.policy.check_filesystem(path, workspace)
        await self.audit.log("tool.file.read", {"path": str(path)})
        async with aiofiles.open(path, encoding="utf-8") as f:
            return await f.read()

    async def write_file(self, path: Path, content: str, workspace: Path | None = None) -> None:
        self.policy.check_filesystem(path, workspace)
        path.parent.mkdir(parents=True, exist_ok=True)
        async with aiofiles.open(path, "w", encoding="utf-8") as f:
            await f.write(content)
        await self.audit.log("tool.file.write", {"path": str(path), "bytes": len(content)})

    async def list_dir(self, path: Path, workspace: Path | None = None) -> list[str]:
        self.policy.check_filesystem(path, workspace)
        await self.audit.log("tool.file.list", {"path": str(path)})
        return [p.name for p in sorted(path.iterdir())]
