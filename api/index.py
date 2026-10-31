"""Vercel Serverless ASGI entrypoint for Taskocalypse."""

from __future__ import annotations

import sys
import urllib.parse
from pathlib import Path
from typing import Any

# Ensure application root directory is available in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.api import app as fastapi_app  # noqa: E402


class VercelPathMiddleware:
    """ASGI middleware that restores the original browser path on Vercel.

    Vercel serverless rewrites route traffic to '/api/index.py' and pass the
    true requested path either in the '__path' query parameter or in
    headers like 'x-invoke-path'.
    """

    def __init__(self, app: Any) -> None:
        self.app = app

    async def __call__(self, scope: dict[str, Any], receive: Any, send: Any) -> None:
        if scope.get("type") == "http":
            query_bytes: bytes = scope.get("query_string", b"")
            if b"__path=" in query_bytes:
                try:
                    parsed = urllib.parse.parse_qs(query_bytes.decode("utf-8", "ignore"))
                    raw_path = parsed.get("__path", [""])[0]
                    if raw_path:
                        clean_path = urllib.parse.unquote(raw_path)
                        if not clean_path.startswith("/"):
                            clean_path = "/" + clean_path
                        scope["path"] = clean_path

                    remaining = [
                        (k, v)
                        for k, vals in parsed.items()
                        if k != "__path"
                        for v in vals
                    ]
                    scope["query_string"] = urllib.parse.urlencode(remaining).encode("utf-8")
                except Exception:
                    pass
            else:
                path: str = scope.get("path", "")
                headers = dict(scope.get("headers", []))
                candidates = [
                    headers.get(b"x-invoke-path"),
                    headers.get(b"x-forwarded-uri"),
                    headers.get(b"x-vercel-matched-path"),
                ]
                for c in candidates:
                    if c:
                        try:
                            decoded = c.decode("utf-8").split("?")[0]
                            if decoded and not decoded.startswith("/api/index"):
                                scope["path"] = decoded
                                break
                        except Exception:
                            pass
                else:
                    if path.startswith("/api/index.py/"):
                        scope["path"] = path[len("/api/index.py") :]
                    elif path.startswith("/api/index/"):
                        scope["path"] = path[len("/api/index") :]
                    elif path in ("/api/index.py", "/api/index", "/api"):
                        scope["path"] = "/"

        await self.app(scope, receive, send)


app = VercelPathMiddleware(fastapi_app)
