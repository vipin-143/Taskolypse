"""Integration tests using FastAPI TestClient covering complete user workflows."""

from pathlib import Path

from fastapi.testclient import TestClient

from app.api import app
from app.config import Bunker
from app.history import history_manager

client = TestClient(app)


def test_health_check() -> None:
    """Check health endpoint response."""
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json().get("status") == "ok"


def test_get_session() -> None:
    """Session endpoint must issue a CSRF token."""
    res = client.get("/api/session")
    assert res.status_code == 200
    data = res.json()
    assert "csrf_token" in data
    assert len(data["csrf_token"]) > 20


def test_full_workflow_scan_plan_execute_undo(tmp_path: Path) -> None:
    """Full lifecycle: scan -> plan -> execute -> undo via API."""
    # Setup test clutter
    (tmp_path / "invoice_test.pdf").write_bytes(b"%PDF simulated data")
    (tmp_path / "screenshot_test.png").write_bytes(b"\x89PNG test image")
    (tmp_path / "temp.log").write_bytes(b"log data")

    # 1. Start session
    session_res = client.get("/api/session")
    token = session_res.json()["csrf_token"]

    # 2. Scan folder
    scan_res = client.post(
        "/api/scan",
        json={"folder_path": str(tmp_path), "include_subfolders": False},
    )
    assert scan_res.status_code == 200
    scan_data = scan_res.json()
    assert scan_data["total_files"] == 3
    token = scan_data["csrf_token"]

    # 3. Formulate decisions
    decisions = [
        {"relative_path": "invoice_test.pdf", "bunker": Bunker.DOCUMENTS.value},
        {"relative_path": "screenshot_test.png", "bunker": Bunker.IMAGES.value},
        {"relative_path": "temp.log", "bunker": Bunker.TRASH.value},
    ]

    # 4. Generate plan (dry-run)
    plan_res = client.post(
        "/api/plan",
        json={
            "root_path": str(tmp_path),
            "decisions": decisions,
            "csrf_token": token,
        },
    )
    assert plan_res.status_code == 200
    plan_data = plan_res.json()
    assert plan_data["total_moves"] == 2
    assert plan_data["total_quarantined"] == 1

    # Verify no files were moved yet (dry run)
    assert (tmp_path / "invoice_test.pdf").exists()

    # 5. Execute plan
    exec_res = client.post(
        "/api/execute",
        json={
            "root_path": str(tmp_path),
            "items": plan_data["items"],
            "confirmed": True,
            "csrf_token": token,
        },
    )
    assert exec_res.status_code == 200
    exec_data = exec_res.json()
    assert exec_data["success"] is True
    assert exec_data["executed_count"] == 3
    journal_id = exec_data["journal_id"]

    # Files should now be moved
    assert not (tmp_path / "invoice_test.pdf").exists()
    assert (tmp_path / "Documents" / "invoice_test.pdf").exists()
    assert (tmp_path / "Images" / "screenshot_test.png").exists()
    assert (tmp_path / ".taskocalypse_quarantine" / "temp.log").exists()

    # 6. Undo run
    undo_res = client.post(
        "/api/undo",
        json={
            "root_path": str(tmp_path),
            "journal_id": journal_id,
            "csrf_token": token,
        },
    )
    assert undo_res.status_code == 200
    undo_data = undo_res.json()
    assert undo_data["success"] is True
    assert undo_data["restored_count"] == 3

    # Files should be back in original place
    assert (tmp_path / "invoice_test.pdf").exists()
    assert (tmp_path / "screenshot_test.png").exists()
    assert (tmp_path / "temp.log").exists()


def test_override_feedback(tmp_path: Path) -> None:
    """Override feedback endpoint records preference in history manager."""
    session_res = client.get("/api/session")
    token = session_res.json()["csrf_token"]

    res = client.post(
        "/api/override",
        json={
            "extension": ".xyz",
            "chosen_bunker": Bunker.CODE.value,
            "original_bunker": Bunker.KEEP.value,
            "csrf_token": token,
        },
    )
    assert res.status_code == 200
    weights = history_manager.get_history_weights()
    assert ".xyz" in weights
    assert weights[".xyz"][Bunker.CODE.value] >= 1
