"""Manager for high-level agent artifacts (Task Lists, Execution Plans, Walkthroughs)."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import aiofiles

from ..security.audit import AuditLogger


class ArtifactManager:
    """Writes artifacts to ~/.opengravity/artifacts/ with proper metadata headers."""
    def __init__(self, artifacts_dir: Path, audit: AuditLogger) -> None:
        self.artifacts_dir = artifacts_dir
        self.audit = audit
        self.artifacts_dir.mkdir(parents=True, exist_ok=True, mode=0o700)

    async def save_artifact(self, name: str, artifact_type: str, content: str) -> None:
        """Store an artifact, validating its boundaries and tracking it in the audit log."""
        safe_name = Path(name).name
        if "." not in safe_name:
            safe_name += ".md"
            
        path = self.artifacts_dir / safe_name
        
        # We prepend a hidden metadata line so the React UI can parse its type
        metadata = json.dumps({"type": artifact_type, "ts": datetime.now(timezone.utc).isoformat()})
        full_content = f"<!-- og_meta: {metadata} -->\n{content}"
        
        async with aiofiles.open(path, "w", encoding="utf-8") as f:
            await f.write(full_content)
            
        await self.audit.log("artifact.created", {"name": safe_name, "type": artifact_type, "size": len(content)})
