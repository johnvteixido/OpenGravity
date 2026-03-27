# Security Model (Rust-Hardened)

The defining feature of OpenGravity is its **Rust-hardened sandboxed execution environment**. Unlike simple process-level constraints, OpenGravity performs hardware-accelerated, preemptive policy checks using a native security layer.

## 1. Network Constraint (Native Level)

By default, the agent operates in an effectively air-gapped environment. Egress traffic is restricted via a native Rust policy engine. If the agent needs to fetch a package, the network policy must permit it.

- **Default Policy:** `localhost`, `127.0.0.1`, `ollama.local`
- **Port Masking:** The Rust core restricts access to common sensitive ports (e.g., 22, 3306) globally unless explicitly allowlisted.

## 2. Filesystem Boundary (Canonicalized)

The agent is strictly restricted to reading and writing within the active workspace. To prevent directory traversal attacks, the Rust core uses `std::fs::canonicalize` on every path request before comparing it against the policy. 

- **Workspace Containment:** Escaping the workspace via symlinks or `../` shortcuts is blocked at the binary level.
- **Deny Zones:** Sensitive directories like `~/.ssh` or `~/.aws` are globally blocked.

## 3. Command Guard (Regex-Enforced)

The agent is governed by an explicit allowlist of safe, development-focused commands (e.g., `git`, `npm`, `python`, `cargo`). The Rust core performs **Regular Expression pattern matching** on every shell command strings to prevent obfuscated malicious calls (e.g., `rm -rf /`).

## 4. Audit Log (Append-Only)

Every interaction spanning the React frontend, the UI toolcalls, and the LLM inference results are appended symmetrically to an immutable log at `~/.opengravity/audit.jsonl`. This log never rotates or deletes.

## 5. Secrets Isolation

API keys, custom model credentials, and repository tokens live exclusively in the outer-host boundary. The subprocess container holding the Agent executor has no awareness of these credentials.
