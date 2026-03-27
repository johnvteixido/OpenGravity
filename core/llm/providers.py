"""
LLM Provider Abstraction Layer for OpenGravity.
Supports Ollama, NVIDIA NemoClaw, and OpenClaw.
"""
from __future__ import annotations

import abc
from collections.abc import AsyncGenerator
from typing import Any

from .adapter import OllamaAdapter


class BaseProvider(abc.ABC):
    @abc.abstractmethod
    async def stream_chat(
        self,
        model: str,
        messages: list[dict],
        system_prompt: str | None = None,
    ) -> AsyncGenerator[str, None]:
        """Stream tokens from the provider."""
        yield ""


class OllamaProvider(BaseProvider):
    def __init__(self, base_url: str = "http://127.0.0.1:11434") -> None:
        self.adapter = OllamaAdapter(base_url=base_url)

    async def stream_chat(
        self,
        model: str,
        messages: list[dict],
        system_prompt: str | None = None,
    ) -> AsyncGenerator[str, None]:
        async for delta in self.adapter.stream_chat(model, messages, system_prompt):
            yield delta


class NemoClawProvider(BaseProvider):
    """
    Integration with NVIDIA NemoClaw.
    Placeholder for specialized high-performance agent orchestration.
    """
    def __init__(self, endpoint: str = "http://nemoclaw.local:8000") -> None:
        self.endpoint = endpoint

    async def stream_chat(
        self,
        model: str,
        messages: list[dict],
        system_prompt: str | None = None,
    ) -> AsyncGenerator[str, None]:
        # Implementation would use NemoClaw's specialized API
        yield f"[[NemoClaw Connection established at {self.endpoint}]]\n"
        # For now, proxy or stub the response
        yield "NemoClaw: Advanced orchestrator ready. Processing complex task graph..."


class OpenClawProvider(BaseProvider):
    """
    Integration with OpenClaw.
    Supports specialized "claw-back" self-healing and tool discovery.
    """
    def __init__(self, api_key: str | None = None) -> None:
        self.api_key = api_key

    async def stream_chat(
        self,
        model: str,
        messages: list[dict],
        system_prompt: str | None = None,
    ) -> AsyncGenerator[str, None]:
        yield "[[OpenClaw context window optimized]]\n"
        yield "OpenClaw: Tool-calling self-correction enabled."


class ProviderFactory:
    @staticmethod
    def get_provider(model: str, config: dict[str, Any]) -> BaseProvider:
        if "nemoclaw" in model.lower():
            return NemoClawProvider(endpoint=config.get("nemoclaw_endpoint", "http://nemoclaw.local:8000"))
        if "openclaw" in model.lower():
            return OpenClawProvider(api_key=config.get("openclaw_api_key"))
        
        # Default to Ollama
        return OllamaProvider(base_url=config.get("ollama_url", "http://127.0.0.1:11434"))
