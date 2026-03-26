"""Sandboxed shell tool — policy-checked command execution."""
from __future__ import annotations

import asyncio
from pathlib import Path

from ..security.audit import AuditLogger
from ..security.policy import PolicyEngine


class ShellTool:
    def __init__(self, policy: PolicyEngine, audit: AuditLogger) -> None:
        self.policy = policy
        self.audit = audit

    async def run(
        self,
        command: str,
        cwd: Path | None = None,
        timeout: int = 30,
    ) -> dict:
        """
        Run a shell command with policy enforcement.
        Returns {"stdout": str, "stderr": str, "returncode": int}.
        """
        self.policy.check_shell_command(command)
        await self.audit.log("tool.shell.run", {"command": command, "cwd": str(cwd)})

        try:
            proc = await asyncio.create_subprocess_shell(
                command,
                cwd=str(cwd) if cwd else None,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
            result = {
                "stdout": stdout.decode(errors="replace")[:8000],
                "stderr": stderr.decode(errors="replace")[:2000],
                "returncode": proc.returncode,
            }
            await self.audit.log("tool.shell.result", {"returncode": proc.returncode})
            return result
        except asyncio.TimeoutError:
            return {"stdout": "", "stderr": f"Command timed out after {timeout}s", "returncode": -1}
        except Exception as e:
            return {"stdout": "", "stderr": str(e), "returncode": -1}
