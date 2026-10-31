"""Filesystem mutation engine.

This is the ONLY module in the entire application allowed to modify or move files.
Strict path confinement, non-destructive quarantine, collision-safe renaming,
atomic moves, and reversible undo journals are enforced here.
"""

from __future__ import annotations

import json
import os
import shutil
import time
import uuid
from pathlib import Path
from typing import Any

from app.config import (
    JOURNAL_PREFIX,
    QUARANTINE_DIR_NAME,
    Bunker,
)
from app.models import (
    Decision,
    ExecuteResult,
    PlanItem,
    PlanResponse,
    UndoResult,
)
from app.scanner import validate_and_resolve_root


class SecurityViolationError(PermissionError):
    """Raised when an operation attempts to breach path confinement."""


def verify_contained_path(root_path: Path, relative_or_abs: str | Path) -> Path:
    """Verify that a path resides strictly within root_path and resolve it.

    Rejects paths containing '..' escaping, symlink escapes, or targeting outside root.
    """
    root_resolved = root_path.resolve()
    target_candidate = (root_resolved / relative_or_abs).resolve()

    try:
        # relative_to raises ValueError if target_candidate is not under root_resolved
        target_candidate.relative_to(root_resolved)
    except ValueError as err:
        raise SecurityViolationError(
            f"Path confinement violation: '{relative_or_abs}' resolves outside root '{root_resolved}'"
        ) from err

    return target_candidate


def get_safe_destination_path(destination_dir: Path, filename: str) -> Path:
    """Compute a destination path that never overwrites an existing file.

    Appends (1), (2), etc. before the extension if a collision occurs.
    """
    stem, ext = os.path.splitext(filename)
    candidate = destination_dir / filename
    counter = 1

    while candidate.exists():
        candidate = destination_dir / f"{stem} ({counter}){ext}"
        counter += 1

    return candidate


def build_plan(root_path: str, decisions: list[Decision], csrf_token: str) -> PlanResponse:
    """Generate a dry-run preview of filesystem changes without mutating disk."""
    root = validate_and_resolve_root(root_path)
    plan_items: list[PlanItem] = []

    total_moves = 0
    total_quarantined = 0
    total_kept = 0
    bytes_saved = 0

    for dec in decisions:
        src_path = verify_contained_path(root, dec.relative_path)
        if not src_path.is_file():
            continue

        size = src_path.stat().st_size
        filename = src_path.name
        bunker = dec.bunker

        if bunker == Bunker.KEEP.value:
            plan_items.append(
                PlanItem(
                    source_path=dec.relative_path,
                    target_path=dec.relative_path,
                    action="keep",
                    size_bytes=size,
                    bunker=bunker,
                )
            )
            total_kept += 1
        elif bunker == Bunker.TRASH.value:
            target_rel = f"{QUARANTINE_DIR_NAME}/{filename}"
            plan_items.append(
                PlanItem(
                    source_path=dec.relative_path,
                    target_path=target_rel,
                    action="quarantine",
                    size_bytes=size,
                    bunker=bunker,
                )
            )
            total_quarantined += 1
            bytes_saved += size
        else:
            target_rel = f"{bunker}/{filename}"
            plan_items.append(
                PlanItem(
                    source_path=dec.relative_path,
                    target_path=target_rel,
                    action="move",
                    size_bytes=size,
                    bunker=bunker,
                )
            )
            total_moves += 1

    return PlanResponse(
        root_path=str(root).replace("\\", "/"),
        items=plan_items,
        total_moves=total_moves,
        total_quarantined=total_quarantined,
        total_kept=total_kept,
        bytes_saved=bytes_saved,
        csrf_token=csrf_token,
    )


def execute_plan(root_path: str, items: list[PlanItem], confirmed: bool) -> ExecuteResult:
    """Apply approved file movements to disk and write an undo journal.

    Requires explicit user confirmation.
    """
    if not confirmed:
        raise ValueError("Explicit confirmation is required to execute disk modifications.")

    root = validate_and_resolve_root(root_path)
    journal_id = str(uuid.uuid4())
    quarantine_dir = root / QUARANTINE_DIR_NAME
    quarantine_dir.mkdir(parents=True, exist_ok=True)

    executed_records: list[dict[str, str]] = []
    failed_items: list[dict[str, Any]] = []

    for item in items:
        if item.action == "keep" or not item.target_path:
            continue

        try:
            source = verify_contained_path(root, item.source_path)
            if not source.exists():
                failed_items.append(
                    {
                        "source": item.source_path,
                        "error": "Source file not found",
                    }
                )
                continue

            target_desired = verify_contained_path(root, item.target_path)
            target_dir = target_desired.parent
            target_dir.mkdir(parents=True, exist_ok=True)

            safe_target = get_safe_destination_path(target_dir, target_desired.name)
            # Re-verify safe target confinement
            verify_contained_path(root, safe_target)

            # Move file safely
            shutil.move(str(source), str(safe_target))

            executed_records.append(
                {
                    "original_source": str(source.relative_to(root)).replace("\\", "/"),
                    "moved_destination": str(safe_target.relative_to(root)).replace("\\", "/"),
                }
            )
        except Exception as err:
            failed_items.append(
                {
                    "source": item.source_path,
                    "error": str(err),
                }
            )

    # Save journal for undo capability
    journal_data = {
        "journal_id": journal_id,
        "timestamp": time.time(),
        "root_path": str(root).replace("\\", "/"),
        "status": "active",
        "moves": executed_records,
    }
    journal_path = quarantine_dir / f"{JOURNAL_PREFIX}{journal_id}.json"
    with open(journal_path, "w", encoding="utf-8") as jf:
        json.dump(journal_data, jf, indent=2)

    return ExecuteResult(
        success=len(failed_items) == 0,
        journal_id=journal_id,
        executed_count=len(executed_records),
        failed_items=failed_items,
        message=f"Successfully organized {len(executed_records)} files.",
    )


def undo_run(root_path: str, journal_id: str) -> UndoResult:
    """Revert disk modifications recorded in a specified journal file."""
    root = validate_and_resolve_root(root_path)
    quarantine_dir = root / QUARANTINE_DIR_NAME
    journal_path = quarantine_dir / f"{JOURNAL_PREFIX}{journal_id}.json"

    if not journal_path.exists():
        return UndoResult(
            success=False,
            restored_count=0,
            failed_count=0,
            message="Journal file not found or already purged.",
        )

    with open(journal_path, encoding="utf-8") as jf:
        journal_data = json.load(jf)

    if journal_data.get("status") == "undone":
        return UndoResult(
            success=False,
            restored_count=0,
            failed_count=0,
            message="This operation has already been undone.",
        )

    restored = 0
    failed = 0

    for record in reversed(journal_data.get("moves", [])):
        curr_rel = record["moved_destination"]
        orig_rel = record["original_source"]

        try:
            curr_path = verify_contained_path(root, curr_rel)
            orig_desired = verify_contained_path(root, orig_rel)

            if not curr_path.exists():
                failed += 1
                continue

            orig_dir = orig_desired.parent
            orig_dir.mkdir(parents=True, exist_ok=True)

            safe_orig = get_safe_destination_path(orig_dir, orig_desired.name)
            verify_contained_path(root, safe_orig)

            shutil.move(str(curr_path), str(safe_orig))
            restored += 1
        except Exception:
            failed += 1

    journal_data["status"] = "undone"
    journal_data["undone_timestamp"] = time.time()
    with open(journal_path, "w", encoding="utf-8") as jf:
        json.dump(journal_data, jf, indent=2)

    return UndoResult(
        success=failed == 0,
        restored_count=restored,
        failed_count=failed,
        message=f"Restored {restored} files back to their original locations.",
    )
