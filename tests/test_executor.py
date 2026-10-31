"""Unit tests for filesystem executor and undo mechanism."""

from pathlib import Path

import pytest

from app.config import Bunker
from app.executor import (
    SecurityViolationError,
    build_plan,
    execute_plan,
    get_safe_destination_path,
    undo_run,
    verify_contained_path,
)
from app.models import Decision, PlanItem


def test_verify_contained_path(tmp_path: Path) -> None:
    """Path confinement must reject attempts to navigate outside the root."""
    root = tmp_path / "sandbox"
    root.mkdir()
    safe_child = root / "valid.txt"
    safe_child.write_text("ok", encoding="utf-8")

    # Safe inside
    assert verify_contained_path(root, "valid.txt") == safe_child.resolve()

    # Outside traversal
    with pytest.raises(SecurityViolationError):
        verify_contained_path(root, "../outside.txt")

    with pytest.raises(SecurityViolationError):
        verify_contained_path(root, "../../etc/passwd")


def test_safe_destination_path_renaming(tmp_path: Path) -> None:
    """Safe destination must append numeric counters and never overwrite."""
    dest_dir = tmp_path / "Bunker"
    dest_dir.mkdir()

    # First one
    p1 = get_safe_destination_path(dest_dir, "document.pdf")
    assert p1 == dest_dir / "document.pdf"
    p1.touch()

    # Collision 1
    p2 = get_safe_destination_path(dest_dir, "document.pdf")
    assert p2 == dest_dir / "document (1).pdf"
    p2.touch()

    # Collision 2
    p3 = get_safe_destination_path(dest_dir, "document.pdf")
    assert p3 == dest_dir / "document (2).pdf"


def test_build_plan_dry_run(tmp_path: Path) -> None:
    """build_plan must be completely dry-run: files should remain untouched on disk."""
    f1 = tmp_path / "report.pdf"
    f1.write_text("content", encoding="utf-8")
    f2 = tmp_path / "temp.log"
    f2.write_text("log", encoding="utf-8")

    decisions = [
        Decision(relative_path="report.pdf", bunker=Bunker.DOCUMENTS.value),
        Decision(relative_path="temp.log", bunker=Bunker.TRASH.value),
    ]

    plan = build_plan(str(tmp_path), decisions, csrf_token="token123")
    assert plan.total_moves == 1
    assert plan.total_quarantined == 1
    assert plan.total_kept == 0
    assert len(plan.items) == 2

    # Verify no disk mutations happened
    assert f1.exists()
    assert f2.exists()
    assert not (tmp_path / "Documents").exists()
    assert not (tmp_path / ".taskocalypse_quarantine").exists()


def test_execute_and_undo_lifecycle(tmp_path: Path) -> None:
    """Full execution followed by undo restoration."""
    f1 = tmp_path / "photo.jpg"
    f1.write_bytes(b"photo bytes")
    f2 = tmp_path / "spam.tmp"
    f2.write_bytes(b"junk bytes")

    items = [
        PlanItem(
            source_path="photo.jpg",
            target_path="Images/photo.jpg",
            action="move",
            size_bytes=len(b"photo bytes"),
            bunker=Bunker.IMAGES.value,
        ),
        PlanItem(
            source_path="spam.tmp",
            target_path=".taskocalypse_quarantine/spam.tmp",
            action="quarantine",
            size_bytes=len(b"junk bytes"),
            bunker=Bunker.TRASH.value,
        ),
    ]

    # Must fail without confirmation
    with pytest.raises(ValueError):
        execute_plan(str(tmp_path), items, confirmed=False)

    # Execute with confirmation
    res = execute_plan(str(tmp_path), items, confirmed=True)
    assert res.success is True
    assert res.executed_count == 2
    assert not f1.exists()
    assert not f2.exists()
    assert (tmp_path / "Images" / "photo.jpg").exists()
    assert (tmp_path / ".taskocalypse_quarantine" / "spam.tmp").exists()

    # Revert with undo
    undo_res = undo_run(str(tmp_path), res.journal_id)
    assert undo_res.success is True
    assert undo_res.restored_count == 2
    assert f1.exists()
    assert f2.exists()

    # Trying to undo a second time should fail gracefully
    second_undo = undo_run(str(tmp_path), res.journal_id)
    assert second_undo.success is False
    assert "already been undone" in second_undo.message
