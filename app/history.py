"""User decision history manager for adaptive heuristic weighting."""

from __future__ import annotations

import contextlib
import json
import os
import tempfile
from pathlib import Path
from typing import Any

from app.config import HISTORY_FILE_PATH


def get_default_history_path() -> Path:
    """Return appropriate history path depending on deployment environment."""
    if os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
        return Path(tempfile.gettempdir()) / "history_overrides.json"
    return HISTORY_FILE_PATH


class HistoryManager:
    """Persists and retrieves user bunker override decisions."""

    def __init__(self, file_path: Path | None = None) -> None:
        self.file_path = file_path if file_path is not None else get_default_history_path()

    def _read_data(self) -> dict[str, dict[str, int]]:
        """Read override counts from disk."""
        if not self.file_path.exists():
            return {}
        try:
            with open(self.file_path, encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict):
                    return data
        except (OSError, json.JSONDecodeError):
            return {}
        return {}

    def _write_data(self, data: dict[str, Any]) -> None:
        """Atomically persist override counts."""
        try:
            self.file_path.parent.mkdir(parents=True, exist_ok=True)
            tmp_path = self.file_path.with_suffix(".tmp")
            with open(tmp_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
            tmp_path.replace(self.file_path)
        except OSError:
            pass

    def record_override(self, extension: str, chosen_bunker: str) -> None:
        """Record an override event for an extension."""
        if not extension:
            return
        ext = extension.lower().strip()
        data = self._read_data()
        if ext not in data:
            data[ext] = {}
        data[ext][chosen_bunker] = data[ext].get(chosen_bunker, 0) + 1
        self._write_data(data)

    def get_history_weights(self) -> dict[str, dict[str, int]]:
        """Return the current override frequency table."""
        return self._read_data()

    def clear(self) -> None:
        """Reset learned user history (useful for tests)."""
        if self.file_path.exists():
            with contextlib.suppress(OSError):
                self.file_path.unlink()


history_manager = HistoryManager()
