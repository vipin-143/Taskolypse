"""Vercel Serverless ASGI entrypoint for Taskocalypse."""

from __future__ import annotations

import contextlib
import sys
from pathlib import Path
from typing import Any

# Ensure application root directory is available in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.api import app as fastapi_app  # noqa: E402


class VercelPathMiddleware:
    """ASGI middleware that restores the original browser path on Vercel.

    Vercel serverless rewrites often pass '/api/index.py' in scope['path'].
    This middleware extracts the true requested URL from Vercel invocation
    headers or strips the serverless handler prefix.
    """

    def __init__(self, app: Any) -> None:
        self.app = app

    async def __call__(self, scope: dict[str, Any], receive: Any, send: Any) -> None:
        if scope.get("type") == "http":
            path: str = scope.get("path", "")
            headers = dict(scope.get("headers", []))

            # Check standard Vercel original path headers
            original = (
                headers.get(b"x-invoke-path")
                or headers.get(b"x-matched-path")
                or headers.get(b"x-vercel-matched-path")
                or headers.get(b"x-forwarded-uri")
            )

            if original:
                with contextlib.suppress(Exception):
                    scope["path"] = original.decode("utf-8")
            elif path.startswith("/api/index.py"):
                remainder = path[len("/api/index.py") :]
                scope["path"] = remainder if remainder else "/"
            elif path.startswith("/api/index"):
                remainder = path[len("/api/index") :]
                scope["path"] = remainder if remainder else "/"
            elif path == "/api":
                scope["path"] = "/"

        await self.app(scope, receive, send)


app = VercelPathMiddleware(fastapi_app)
