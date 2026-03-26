"""Playwright browser tool for end-to-end testing and visual verification."""
from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Any

from playwright.async_api import async_playwright

from ..security.audit import AuditLogger
from ..security.policy import PolicyEngine


class BrowserTool:
    def __init__(self, policy: PolicyEngine, audit: AuditLogger) -> None:
        self.policy = policy
        self.audit = audit
        self._browser = None
        self._playwright = None

    async def _ensure_browser(self):
        if not self._playwright:
            self._playwright = await async_playwright().start()
        if not self._browser:
            self._browser = await self._playwright.chromium.launch(headless=True)
        return self._browser

    async def goto(self, url: str) -> dict[str, Any]:
        """Navigate to a URL and return basic page stats."""
        # The agent should ideally only hit localhost properties, but we let network policy check it
        host = url.split("://")[-1].split("/")[0].split(":")[0]
        self.policy.check_network(host)
        await self.audit.log("tool.browser.goto", {"url": url})

        browser = await self._ensure_browser()
        page = await browser.new_page()
        try:
            response = await page.goto(url, wait_until="networkidle", timeout=15000)
            title = await page.title()
            content = await page.content()
            return {"status": response.status if response else 0, "title": title, "length": len(content)}
        except Exception as e:
            return {"error": str(e)}
        finally:
            await page.close()

    async def close(self) -> None:
        if self._browser:
            await self._browser.close()
            self._browser = None
        if self._playwright:
            await self._playwright.stop()
            self._playwright = None
