"""
Ollama LLM adapter with streaming support.
"""
from __future__ import annotations

import json
from typing import AsyncGenerator

import httpx


class OllamaAdapter:
    """
    Wraps the Ollama HTTP API and streams token deltas.
    Compatible with both /api/chat (preferred) and /api/generate.
    """

    def __init__(self, base_url: str = "http://127.0.0.1:11434") -> None:
        self.base_url = base_url.rstrip("/")
        self._client = httpx.AsyncClient(timeout=None)

    async def stream_chat(
        self,
        model: str,
        messages: list[dict],
        system_prompt: str | None = None,
    ) -> AsyncGenerator[str, None]:
        """
        Stream chat completions from Ollama.
        Yields text delta strings as they arrive.
        """
        payload: dict = {
            "model": model,
            "messages": messages,
            "stream": True,
        }
        if system_prompt:
            payload["system"] = system_prompt

        async with self._client.stream(
            "POST",
            f"{self.base_url}/api/chat",
            json=payload,
        ) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line.strip():
                    continue
                try:
                    obj = json.loads(line)
                    delta = obj.get("message", {}).get("content", "")
                    if delta:
                        yield delta
                    if obj.get("done"):
                        break
                except json.JSONDecodeError:
                    continue

    async def list_models(self) -> list[dict]:
        """Return list of locally available Ollama models."""
        try:
            res = await self._client.get(f"{self.base_url}/api/tags", timeout=5)
            res.raise_for_status()
            return res.json().get("models", [])
        except Exception:
            return []

    async def is_available(self) -> bool:
        """Check if Ollama is running."""
        try:
            res = await self._client.get(f"{self.base_url}/api/tags", timeout=3)
            return res.status_code == 200
        except Exception:
            return False

    async def close(self) -> None:
        await self._client.aclose()
