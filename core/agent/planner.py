"""Agent planner module for generating step-by-step implementation plans."""
from __future__ import annotations

from ..llm.adapter import OllamaAdapter
from ..security.audit import AuditLogger


class Planner:
    def __init__(self, llm: OllamaAdapter, audit: AuditLogger) -> None:
        self.llm = llm
        self.audit = audit

    async def create_plan(self, objective: str, model: str = "llama3.2") -> str:
        """Generates a structured implementation plan based on the user's objective."""
        await self.audit.log("planner.create_plan", {"objective": objective})
        
        system_prompt = (
            "You are the OpenGravity Planner. Your job is to break down the user's objective "
            "into a detailed, step-by-step implementation plan. "
            "Use Markdown formatting with checkboxes for tasks."
        )
        
        # We don't stream the plan internally, we just capture it
        plan = ""
        async for chunk in self.llm.stream_chat(
            model=model,
            messages=[{"role": "user", "content": objective}],
            system_prompt=system_prompt
        ):
            plan += chunk
            
        return plan
