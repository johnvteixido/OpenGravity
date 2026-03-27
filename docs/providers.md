# LLM Providers

OpenGravity is designed to be **provider-agnostic**, though it defaults to **Ollama** for a zero-configuration local experience.

## Supported Providers

### 1. Ollama (Default)

Ollama runs large language models locally entirely on your GPU/CPU.

- **Endpoint:** `http://127.0.0.1:11434`
- **Supported Models:** `llama3.2`, `qwen2.5-coder`, `deepseek-r1`, `phi3`, etc.
- **Setup:** If not installed, OpenGravity will download the official installer automatically on first launch.

### 2. LM Studio (Local OpenAI-Compatible)

LM Studio provides an OpenAI-compatible local server.

- **Endpoint:** `http://127.0.0.1:1234/v1`
- **Setup:** Start the local server in LM Studio. In OpenGravity Settings, change the base URL.

### 3. OpenAI / Anthropic (Cloud Providers)

While OpenGravity strongly advocates for local execution, you can configure it to hit cloud APIs if you require `gpt-4o` or `claude-3-5-sonnet`.

- **Warning:** This breaks the offline-only privacy model.

### 4. NVIDIA NemoClaw (Advanced Agent-First)

OpenGravity integrates with **NVIDIA NemoClaw** for high-performance agentic orchestration.

- **Focus:** Massive multi-agent workflows and complex task planning.
- **Privacy:** Keeps reasoning local while leveraging NVIDIA's specialized agent logic.

### 5. OpenClaw (Community-Driven Integration)

**OpenClaw** is the community-driven bridge for OpenGravity, providing additional tool-calling capabilities and specialized model support.

- **Status:** Integrated natively via the OpenGravity Agent Server.
- **Workflow:** Enables "claw-back" error correction and advanced self-healing for agent tasks.
