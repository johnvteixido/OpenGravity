# Contributing to OpenGravity

Thank you for your interest in contributing! OpenGravity is an open-source project and we welcome contributions of all kinds: bug fixes, new features, documentation improvements, and more.

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

## How to Contribute

### 1. Report Bugs

Before filing a bug report, please check [existing issues](https://github.com/johnvteixido/OpenGravity/issues) to avoid duplicates.

When filing a bug, include:

- OpenGravity version and platform (Windows/macOS/Linux)
- Ollama version and model used
- Steps to reproduce
- Expected vs. actual behavior
- Relevant logs from `~/.opengravity/audit.jsonl`

### 2. Request Features

Open a [GitHub Discussion](https://github.com/johnvteixido/OpenGravity/discussions) for feature ideas before filing issues. This allows community discussion before implementation.

### 3. Submit Pull Requests

#### Setup

```bash
# Clone the repo
git clone https://github.com/johnvteixido/OpenGravity.git
cd opengravity

# Install Node.js dependencies (requires Node 18+)
npm install

# Install Python dependencies (requires Python 3.11+)
cd core
pip install -e ".[dev]"
cd ..

# Install Ollama if not already installed
# macOS/Linux: curl -fsSL https://ollama.com/install.sh | sh
# Windows: https://ollama.com/download

# Start development
npm run dev
```

#### Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Make your changes
4. Write or update tests
5. Run the full test suite: `npm test && cd core && python -m pytest`
6. Format your code: `npm run lint && cd core && ruff check . && ruff format .`
7. Commit with a clear message (see below)
8. Open a Pull Request against `main`

#### Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org):

```
feat: add support for DeepSeek models
fix: resolve Ollama connection timeout on macOS
docs: update quick-start guide for Windows
chore: upgrade Electron to v30
security: harden filesystem policy engine
```

#### PR Checklist

- [ ] Tests pass (`npm test` + `pytest`)
- [ ] Linting passes (`npm run lint` + `ruff check`)
- [ ] Security-relevant changes include policy/sandbox documentation
- [ ] New user-facing features include documentation updates
- [ ] CHANGELOG.md entry added

### 4. Improve Documentation

Documentation lives in `docs/`. We use standard Markdown. Fix typos, add examples, clarify architecture — all contributions welcome.

## Project Layout

```
opengravity/
├── app/            # Electron main process (TypeScript)
├── renderer/       # React UI (TypeScript + Vite)
├── core/           # Python agent engine (FastAPI + tools)
├── scripts/        # Ollama installer scripts
└── docs/           # Project documentation
```

## Security Contributions

Security-relevant changes require extra care. Please read [SECURITY.md](SECURITY.md) before contributing to:

- `core/security/` — Sandbox and policy engine
- `app/main.ts` — Electron main process and IPC
- `app/preload.ts` — Context bridge

**Never file public issues for security vulnerabilities.** Use the private advisory process described in SECURITY.md.

## License

By contributing to OpenGravity, you agree that your contributions will be licensed under the [Apache License 2.0](LICENSE).
