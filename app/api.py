"""FastAPI Web Application, Security Middleware, and REST Endpoints."""

from __future__ import annotations

import secrets
import time
from collections import defaultdict
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import (
    HOST,
    PORT,
    RATE_LIMIT_MUTATION_MAX_REQUESTS,
    RATE_LIMIT_MUTATION_WINDOW_SECONDS,
)
from app.executor import SecurityViolationError, build_plan, execute_plan, undo_run
from app.history import history_manager
from app.models import (
    ExecuteRequest,
    ExecuteResult,
    OverrideFeedbackRequest,
    PlanRequest,
    PlanResponse,
    ScanRequest,
    ScanResponse,
    UndoRequest,
    UndoResult,
)
from app.scanner import PathSecurityError, run_scan

# Active CSRF tokens: token -> issue_epoch
_ACTIVE_CSRF_TOKENS: dict[str, float] = {}
CSRF_TOKEN_TTL_SECONDS: float = 86400.0  # 24 hours

# Rate limiting sliding window: client_ip -> list of request timestamps
_MUTATION_TIMESTAMPS: dict[str, list[float]] = defaultdict(list)

app = FastAPI(
    title="Taskocalypse",
    description="A fast-paced browser game where playing it executes a real digital chore.",
    version="1.0.0",
)

# Strict CORS: localhost only
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        f"http://127.0.0.1:{PORT}",
        f"http://localhost:{PORT}",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.middleware("http")
async def security_headers_middleware(request: Request, call_next: Any) -> Response:
    """Inject strict security headers into all responses."""
    response: Response = await call_next(request)
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data:; connect-src 'self';"
    )
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


def generate_csrf_token() -> str:
    """Issue a cryptographically secure anti-forgery token."""
    token = secrets.token_urlsafe(32)
    _ACTIVE_CSRF_TOKENS[token] = time.time()
    # Prune expired tokens
    now = time.time()
    for tok, created in list(_ACTIVE_CSRF_TOKENS.items()):
        if now - created > CSRF_TOKEN_TTL_SECONDS:
            _ACTIVE_CSRF_TOKENS.pop(tok, None)
    return token


def verify_csrf(token: str | None) -> None:
    """Verify validity of CSRF token, raising 403 Forbidden if invalid."""
    if not token or token not in _ACTIVE_CSRF_TOKENS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or missing CSRF security token.",
        )


def check_rate_limit(request: Request) -> None:
    """Enforce sliding-window rate limit on mutating operations."""
    client_ip = request.client.host if request.client else "127.0.0.1"
    now = time.time()
    timestamps = _MUTATION_TIMESTAMPS[client_ip]

    # Filter out requests older than window
    timestamps = [t for t in timestamps if now - t < RATE_LIMIT_MUTATION_WINDOW_SECONDS]
    if len(timestamps) >= RATE_LIMIT_MUTATION_MAX_REQUESTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Please wait before executing further actions.",
        )
    timestamps.append(now)
    _MUTATION_TIMESTAMPS[client_ip] = timestamps


# API Endpoints
@app.get("/api/health")
def health_check() -> dict[str, str]:
    """Basic health check and readiness probe."""
    return {"status": "ok", "app": "Taskocalypse", "host": HOST}


@app.get("/api/session")
def get_session() -> dict[str, Any]:
    """Issue a new session CSRF token."""
    token = generate_csrf_token()
    return {"csrf_token": token, "server_time": time.time()}


@app.post("/api/scan", response_model=ScanResponse)
def scan_endpoint(payload: ScanRequest) -> ScanResponse:
    """Scan and classify a local cluttered folder."""
    token = generate_csrf_token()
    try:
        return run_scan(
            folder_path=payload.folder_path,
            include_subfolders=payload.include_subfolders,
            max_files=payload.max_files,
            csrf_token=token,
        )
    except PathSecurityError as err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(err)) from err
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Scanning failed: {err}",
        ) from err


@app.post("/api/plan", response_model=PlanResponse)
def plan_endpoint(payload: PlanRequest) -> PlanResponse:
    """Generate dry-run action preview before execution."""
    verify_csrf(payload.csrf_token)
    try:
        return build_plan(
            root_path=payload.root_path,
            decisions=payload.decisions,
            csrf_token=payload.csrf_token,
        )
    except (SecurityViolationError, PathSecurityError) as err:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(err)) from err
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Planning failed: {err}",
        ) from err


@app.post("/api/execute", response_model=ExecuteResult)
def execute_endpoint(payload: ExecuteRequest, request: Request) -> ExecuteResult:
    """Execute confirmed file reorganizations on disk."""
    check_rate_limit(request)
    verify_csrf(payload.csrf_token)

    if not payload.confirmed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Execution requires explicit player confirmation.",
        )

    try:
        return execute_plan(
            root_path=payload.root_path,
            items=payload.items,
            confirmed=payload.confirmed,
        )
    except (SecurityViolationError, PathSecurityError) as err:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(err)) from err
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Execution failed: {err}",
        ) from err


@app.post("/api/undo", response_model=UndoResult)
def undo_endpoint(payload: UndoRequest, request: Request) -> UndoResult:
    """Undo a previously executed run using journal record."""
    check_rate_limit(request)
    verify_csrf(payload.csrf_token)

    try:
        return undo_run(root_path=payload.root_path, journal_id=payload.journal_id)
    except (SecurityViolationError, PathSecurityError) as err:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(err)) from err
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Undo failed: {err}",
        ) from err


@app.post("/api/override")
def override_feedback_endpoint(payload: OverrideFeedbackRequest) -> dict[str, str]:
    """Train heuristic engine when user overrides suggestion."""
    verify_csrf(payload.csrf_token)
    history_manager.record_override(
        extension=payload.extension,
        chosen_bunker=payload.chosen_bunker,
    )
    return {"status": "recorded"}


# Mount static files and landing page
STATIC_DIR = Path(__file__).resolve().parent.parent / "static"
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/")
def serve_index() -> FileResponse:
    """Serve single-page frontend application."""
    index_file = STATIC_DIR / "index.html"
    if not index_file.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Frontend not found.")
    return FileResponse(str(index_file))

