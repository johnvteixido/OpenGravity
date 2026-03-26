# Changelog

All notable changes to OpenGravity will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added

- Initial project scaffold and monorepo structure
- Electron standalone desktop application (Windows, Linux, macOS)
- React renderer with Chat, Task View, Artifact Viewer, and Settings panels
- Python agent server (FastAPI + WebSocket)
- Multi-agent orchestration with plan → execute → verify lifecycle
- Ollama LLM adapter with streaming support
- Guided Ollama installer wizard (auto-detected; download helper if not found)
- Agent tool system: filesystem, shell, browser (Playwright), codebase search
- Artifact generation: task lists, implementation plans, walkthroughs
- Security sandbox: filesystem + network policy, command allowlist, audit logging
- Secrets management (credentials on host, never in sandbox)
- CI/CD pipeline (GitHub Actions: build, test, CodeQL, release)
- Governance documentation: README, SECURITY, CONTRIBUTING, CODE_OF_CONDUCT

---

## [0.1.0] - TBD

Initial public release.
