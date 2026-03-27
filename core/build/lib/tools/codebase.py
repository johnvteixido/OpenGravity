"""Codebase search tool, leveraging ripgrep if available or native python fallback."""
from __future__ import annotations

import asyncio
from pathlib import Path

from ..security.audit import AuditLogger
from ..security.policy import PolicyEngine


class CodebaseTool:
    def __init__(self, policy: PolicyEngine, audit: AuditLogger) -> None:
        self.policy = policy
        self.audit = audit

    async def search(self, query: str, workspace: Path) -> dict:
        """Search workspace for a string using shell grep/rg."""
        self.policy.check_filesystem(workspace, workspace)
        await self.audit.log("tool.codebase.search", {"query": query, "workspace": str(workspace)})

        # Ensure shell policy allows grep/rg
        try:
            cmd = f"git grep -n '{query}'" if (workspace / ".git").exists() else f"grep -rn '{query}' ."
            self.policy.check_shell_command(cmd.split()[0])
            
            proc = await asyncio.create_subprocess_shell(
                cmd,
                cwd=str(workspace),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=20)
            output = stdout.decode(errors="replace")
            
            lines = output.split("\n")
            if len(lines) > 50:
                output = "\n".join(lines[:50]) + "\n... (truncated)"
                
            return {"matches": output}
        except Exception as e:
            return {"error": str(e)}
