# Security Policy

## Reporting a Vulnerability

**Please do NOT report security vulnerabilities through public GitHub Issues.**

If you discover a security vulnerability in OpenGravity, please disclose it responsibly:

- **Email:** johnvteixido@gmail.com _(monitored by maintainers)_
- **GitHub Private Advisory:** [Report a vulnerability](https://github.com/johnvteixido/OpenGravity/security/advisories/new)

Please include:

1. A clear description of the vulnerability
2. Steps to reproduce
3. Potential impact
4. Suggested fix (if any)

You will receive an acknowledgment within **48 hours** and a detailed response within **7 days**.

## Supported Versions

| Version        | Supported                |
| -------------- | ------------------------ |
| Latest release | ✅ Active support        |
| Previous minor | ✅ Security patches only |
| Older versions | ❌ Not supported         |

## Security Architecture

OpenGravity is designed with a defense-in-depth security model:

### Sandbox Isolation

- Agent tools run in a sandboxed subprocess with restricted privileges
- Filesystem access limited to the user's workspace (configurable policy)
- Network egress controlled by declarative allowlist policy

### Secrets Management

- Credentials stored in `~/.opengravity/credentials.json` with file permissions `600`
- Secrets are **never** passed into the agent sandbox or logged
- The agent sandbox only sees a proxied inference endpoint, not raw API keys

### Audit Logging

- Every tool call (file read/write, shell command, network request) is logged to `~/.opengravity/audit.jsonl`
- Log entries are append-only and include timestamp, tool, arguments, and outcome

### Input Validation

- All LLM-generated shell commands are validated against the command allowlist before execution
- File paths are normalized and checked against the filesystem policy before access

### Network Policy

- Default policy: only `localhost` and Ollama's local endpoint are reachable
- All blocked requests are logged with tool origin and target host
- Policy is operator-configurable in `~/.opengravity/policy.json`

## Vulnerability Disclosure Timeline

| Stage              | Target                |
| ------------------ | --------------------- |
| Acknowledgment     | 48 hours              |
| Initial assessment | 7 days                |
| Patch / mitigation | 30 days               |
| Public disclosure  | 90 days (coordinated) |

## Security-Relevant Dependencies

| Component      | Language         | Notes                                               |
| -------------- | ---------------- | --------------------------------------------------- |
| Agent Server   | Python / FastAPI | Input validation, sandboxed subprocess              |
| Electron Shell | TypeScript       | Context isolation, no `nodeIntegration` in renderer |
| React Renderer | TypeScript       | CSP enforced, no `eval`                             |
| Policy Engine  | Python           | Declarative YAML/JSON, no code execution            |
