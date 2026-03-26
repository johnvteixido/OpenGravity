"""
FastAPI server for the OpenGravity agent.

Endpoints:
  GET  /health              — Health check
  POST /chat                — Streaming chat (SSE)
  GET  /ws/tasks            — WebSocket for live task view
  GET  /artifacts           — List artifacts
  GET  /artifacts/{name}    — Get artifact content
  POST /setup/install-ollama — Trigger Ollama installer
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from collections.abc import AsyncGenerator
from pathlib import Path

import aiofiles
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ..agent.orchestrator import AgentOrchestrator
from ..security.audit import AuditLogger
from ..security.policy import PolicyEngine

# ─── Config ──────────────────────────────────────────────────────────────────
CONFIG_DIR = Path(os.environ.get("OG_CONFIG_DIR", Path.home() / ".opengravity"))
ARTIFACTS_DIR = CONFIG_DIR / "artifacts"
CONFIG_DIR.mkdir(parents=True, exist_ok=True, mode=0o700)
ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True, mode=0o700)

# ─── App ─────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="OpenGravity Agent Server",
    version="0.1.0",
    docs_url=None,  # Disable Swagger UI in production
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "app://.", "file://"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Singletons
audit = AuditLogger(CONFIG_DIR / "audit.jsonl")
policy = PolicyEngine(CONFIG_DIR / "policy.json")
orchestrator = AgentOrchestrator(config_dir=CONFIG_DIR, audit=audit, policy=policy)

# Active WebSocket connections for task panel
_task_connections: set[WebSocket] = set()


# ─── Models ──────────────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    message: str
    model: str = "llama3.2"
    workspace: str | None = None


# ─── Broadcast task updates ───────────────────────────────────────────────────
async def broadcast_task_update(task_data: dict) -> None:
    dead: set[WebSocket] = set()
    for ws in _task_connections:
        try:
            await ws.send_text(json.dumps({"type": "task_update", "task": task_data}))
        except Exception:
            dead.add(ws)
    _task_connections.difference_update(dead)


orchestrator.on_task_update = broadcast_task_update


# ─── Routes ──────────────────────────────────────────────────────────────────
@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "version": "0.1.0"}


@app.post("/chat")
async def chat(req: ChatRequest) -> StreamingResponse:
    """
    Streaming chat endpoint.
    Streams Server-Sent Events in the format: data: {"delta": "..."}\n\n
    Ends with: data: [DONE]\n\n
    """
    async def generate() -> AsyncGenerator[str, None]:
        async for delta in orchestrator.run(
            message=req.message,
            model=req.model,
            workspace=Path(req.workspace) if req.workspace else None,
        ):
            yield f"data: {json.dumps({'delta': delta})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@app.websocket("/ws/tasks")
async def ws_tasks(ws: WebSocket) -> None:
    await ws.accept()
    _task_connections.add(ws)
    # Send current task snapshot on connect
    snapshot = orchestrator.get_tasks_snapshot()
    await ws.send_text(json.dumps({"type": "tasks_snapshot", "tasks": snapshot}))
    try:
        while True:
            await ws.receive_text()  # Keep connection alive
    except WebSocketDisconnect:
        _task_connections.discard(ws)


@app.get("/artifacts")
async def list_artifacts() -> dict:
    artifacts = []
    for path in sorted(ARTIFACTS_DIR.glob("*"), key=lambda p: p.stat().st_mtime, reverse=True):
        if path.is_file():
            stat = path.stat()
            # Detect artifact type from first line
            artifact_type = "other"
            try:
                async with aiofiles.open(path, encoding="utf-8") as f:
                    first_line = await f.readline()
                if "task" in path.name.lower():
                    artifact_type = "task"
                elif "plan" in path.name.lower():
                    artifact_type = "implementation_plan"
                elif "walkthrough" in path.name.lower():
                    artifact_type = "walkthrough"
            except Exception:
                pass
            # Preview: first 200 chars
            preview = ""
            try:
                async with aiofiles.open(path, encoding="utf-8") as f:
                    preview = (await f.read(300)).strip()
            except Exception:
                pass
            artifacts.append({
                "name": path.name,
                "path": str(path),
                "type": artifact_type,
                "modified": path.stat().st_mtime,
                "size": stat.st_size,
                "preview": preview[:200],
            })
    return {"artifacts": artifacts}


@app.get("/artifacts/{name}")
async def get_artifact(name: str) -> dict:
    # Sanitize path — prevent directory traversal
    safe_name = Path(name).name
    path = ARTIFACTS_DIR / safe_name
    if not path.exists() or not path.is_file():
        return {"content": "", "error": "Not found"}
    async with aiofiles.open(path, encoding="utf-8") as f:
        content = await f.read()
    return {"content": content}


@app.post("/setup/install-ollama")
async def install_ollama() -> dict:
    """Trigger the platform-appropriate Ollama installer script."""
    scripts_dir = Path(__file__).parent.parent.parent / "scripts"
    if sys.platform == "win32":
        script = scripts_dir / "install-ollama.ps1"
        cmd = ["powershell", "-ExecutionPolicy", "Bypass", "-File", str(script)]
    else:
        script = scripts_dir / "install-ollama.sh"
        cmd = ["bash", str(script)]

    if not script.exists():
        return {"success": False, "error": "Installer script not found"}

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=120)
        return {"success": proc.returncode == 0, "output": stdout.decode()[:2000]}
    except TimeoutError:
        return {"success": False, "error": "Installer timed out"}
    except Exception as e:
        return {"success": False, "error": str(e)}
