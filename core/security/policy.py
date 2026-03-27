"""
Policy engine — enforces filesystem, network, and shell access rules.
Reads from ~/.opengravity/policy.json; creates a safe default if not found.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

try:
    from opengravity_core_rust import RustPolicyEngine
    RUST_AVAILABLE = True
except ImportError:
    RUST_AVAILABLE = False

DEFAULT_POLICY = {
    "filesystem": {
        "allow": ["$WORKSPACE"],
        "deny": ["~/.ssh", "~/.aws", "~/.gnupg", "~/.config/gcloud"],
    },
    "network": {
        "allow": [
            "localhost", "127.0.0.1", "ollama.local", 
            "nemoclaw.local", "openclaw.io"
        ],
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
        self.rust = RustPolicyEngine() if RUST_AVAILABLE else None

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
        # 🦀 Rust Hardened Check (Primary defense)
        if self.rust:
            denied = self.policy.get("filesystem", {}).get("deny", [])
            try:
                self.rust.check_filesystem(
                    str(path), 
                    str(workspace) if workspace else "", 
                    [d.replace("~", str(Path.home())) for d in denied]
                )
                return
            except Exception as e:
                # Re-raise as PolicyViolation with Rust's description
                raise PolicyViolation(str(e))

        # Fallback to Python logic if Rust is unavailable
        resolved = path.resolve()
        denied = self.policy.get("filesystem", {}).get("deny", [])
        for d in denied:
            deny_path = Path(d.replace("~", str(Path.home()))).resolve()
            if str(resolved).startswith(str(deny_path)):
                raise PolicyViolation(f"Filesystem access denied: {path}")
        
        if workspace:
            ws_resolved = workspace.resolve()
            if not str(resolved).startswith(str(ws_resolved)):
                allowed = self.policy.get("filesystem", {}).get("allow", ["$WORKSPACE"])
                if "$WORKSPACE" in allowed and len(allowed) == 1:
                    raise PolicyViolation(f"Path '{path}' is outside workspace '{workspace}'")

    def check_network(self, host: str, port: int | None = None) -> None:
        """Raise PolicyViolation if the host/port is not allowed."""
        allowed = self.policy.get("network", {}).get("allow", ["localhost"])
        
        # 🦀 Rust Hardened Check
        if self.rust:
            try:
                # Handle special hostnames used in the app
                resolved_host = host
                if host == "ollama.local": resolved_host = "localhost"
                
                self.rust.check_network(resolved_host, port, allowed)
                return
            except Exception as e:
                raise PolicyViolation(str(e))

        # Fallback
        if host not in allowed and not host.startswith("127."):
            raise PolicyViolation(f"Network access to '{host}' blocked by policy.")

    def check_shell_command(self, command: str) -> None:
        """Raise PolicyViolation if the command or pattern is denied."""
        deny_patterns = self.policy.get("shell", {}).get("deny_patterns", [])
        allow_commands = self.policy.get("shell", {}).get("allow_commands", [])

        # 🦀 Rust Hardened Check
        if self.rust:
            try:
                self.rust.check_shell_command(command, allow_commands, deny_patterns)
                return
            except Exception as e:
                raise PolicyViolation(str(e))

        # Fallback
        for pattern in deny_patterns:
            if pattern.lower() in command.lower():
                raise PolicyViolation(f"Shell command blocked by policy: '{pattern}'")
        
        first_token = command.split()[0].lower() if command.strip() else ""
        if allow_commands and first_token and first_token not in [c.lower() for c in allow_commands]:
            raise PolicyViolation(f"Command '{first_token}' not in allow list.")
