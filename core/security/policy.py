"""
Policy engine — enforces filesystem, network, and shell access rules.
Reads from ~/.opengravity/policy.json; creates a safe default if not found.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

DEFAULT_POLICY = {
    "filesystem": {
        "allow": ["$WORKSPACE"],
        "deny": ["~/.ssh", "~/.aws", "~/.gnupg", "~/.config/gcloud"],
    },
    "network": {
        "allow": ["localhost", "127.0.0.1", "ollama.local"],
        "deny": [],
    },
    "shell": {
        "allow_commands": [
            "git", "npm", "npx", "node", "python", "python3",
            "pip", "pip3", "cargo", "rustc", "go", "make",
            "ls", "dir", "cat", "type", "echo", "pwd",
        ],
        "deny_patterns": ["rm -rf /", "del /f /s", "> /dev/sda"],
    },
}


class PolicyViolation(Exception):
    """Raised when a tool call violates the security policy."""


class PolicyEngine:
    def __init__(self, policy_path: Path) -> None:
        self.policy_path = policy_path
        self.policy = self._load()

    def _load(self) -> dict:
        if self.policy_path.exists():
            try:
                with open(self.policy_path, encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
        # Write default policy
        with open(self.policy_path, "w", encoding="utf-8") as f:
            json.dump(DEFAULT_POLICY, f, indent=2)
        os.chmod(self.policy_path, 0o600)
        return DEFAULT_POLICY.copy()

    def check_filesystem(self, path: Path, workspace: Path | None) -> None:
        """
        Raise PolicyViolation if the path is outside allowed zones.
        """
        resolved = path.resolve()
        denied = self.policy.get("filesystem", {}).get("deny", [])
        for d in denied:
            deny_path = Path(d.replace("~", str(Path.home()))).resolve()
            if str(resolved).startswith(str(deny_path)):
                raise PolicyViolation(f"Filesystem access denied: {path}")
        # If workspace is set, default allow only within workspace
        if workspace:
            ws_resolved = workspace.resolve()
            if not str(resolved).startswith(str(ws_resolved)):
                allowed = self.policy.get("filesystem", {}).get("allow", ["$WORKSPACE"])
                if "$WORKSPACE" in allowed and len(allowed) == 1:
                    raise PolicyViolation(
                        f"Path '{path}' is outside workspace '{workspace}'. "
                        "Modify ~/.opengravity/policy.json to allow additional paths."
                    )

    def check_network(self, host: str) -> None:
        """Raise PolicyViolation if the host is not in the allowlist."""
        allowed = self.policy.get("network", {}).get("allow", ["localhost"])
        if host not in allowed and not host.startswith("127."):
            raise PolicyViolation(
                f"Network access to '{host}' blocked by policy. "
                "Add it to the 'network.allow' list in ~/.opengravity/policy.json."
            )

    def check_shell_command(self, command: str) -> None:
        """Raise PolicyViolation if the command or pattern is denied."""
        deny_patterns = self.policy.get("shell", {}).get("deny_patterns", [])
        for pattern in deny_patterns:
            if pattern.lower() in command.lower():
                raise PolicyViolation(f"Shell command blocked by policy: '{pattern}'")
        allow_commands = self.policy.get("shell", {}).get("allow_commands", [])
        first_token = command.split()[0].lower() if command.strip() else ""
        if allow_commands and first_token and first_token not in [c.lower() for c in allow_commands]:
            raise PolicyViolation(
                f"Command '{first_token}' not in allow list. "
                "Add it to 'shell.allow_commands' in ~/.opengravity/policy.json."
            )
