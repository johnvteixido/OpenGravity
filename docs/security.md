# Security Model

The defining feature of OpenGravity is its sandboxed execution environment. Agents are powerful, and unconstrained agents can be dangerous.

## 1. Network Constraint
By default, the agent operates in an effectively air-gapped environment. Egress traffic is heavily restricted via a declarative allowlist. If the agent needs to fetch a package, the network policy must permit it.
- **Default Policy:** `localhost`, `127.0.0.1`

## 2. Filesystem Boundary
The agent is explicitly restricted to reading and writing within the active workspace. Escaping the workspace (e.g. `../../~/.ssh/id_rsa`) will trigger an immediate exception.
- **Default Policy:** `$WORKSPACE`

## 3. Command Allowlist
Not all shell commands are equal. The agent is forced to use an explicit allowlist of safe, development-focused commands (e.g., `git`, `npm`, `python`, `cargo`). Dangerous calls like `rm -rf /` are rejected before hitting the underlying OS.

## 4. Audit Log
Every interaction spanning the React frontend, the UI toolcalls, and the LLM inference results are appended symmetrically to an immutable log at `~/.opengravity/audit.jsonl`. This log never rotates or deletes.

## 5. Secrets Isolation
API keys, custom model credentials, and repository tokens live exclusively in the outer-host boundary. The subprocess container holding the Agent executor has no awareness of these credentials.
