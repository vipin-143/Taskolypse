"""Vercel Serverless ASGI entrypoint for Taskocalypse."""

import sys
from pathlib import Path

# Ensure application root directory is available in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.api import app  # noqa: E402, F401
