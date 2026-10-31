"""Additional edge-case tests to raise coverage above 90%."""

import json
from pathlib import Path

from fastapi.testclient import TestClient

from app.api import app, generate_csrf_token
from app.classifier import classify_file, get_mime_bunker
from app.config import Bunker
from app.history import HistoryManager
from app.models import Decision, FileInfo

client = TestClient(app)


def test_classifier_additional_branches() -> None:
    """Test audio mime, compressed mime, and old unclassified file branches."""
    assert get_mime_bunker("audio/mpeg") == Bunker.VIDEOS
    assert get_mime_bunker("application/x-zip-compressed") == Bunker.ARCHIVES

    # Old unclassified file > 180 days
    old_f = FileInfo(
        relative_path="legacy_unknown.custom",
        name="legacy_unknown.custom",
        extension=".custom",
        size_bytes=100,
        mtime=1000.0,
        mime_type="application/octet-stream",
    )
    res = classify_file(old_f, current_time=200000000.0)
    assert res.bunker == Bunker.KEEP.value
    assert "older unclassified" in res.reason.lower()


def test_history_manager_edge_cases(tmp_path: Path) -> None:
    """Test corrupted json handling, empty extension, and clear()."""
    history_file = tmp_path / "test_history.json"
    hm = HistoryManager(history_file)

    # Empty extension should be ignored
    hm.record_override("", Bunker.DOCUMENTS.value)
    assert hm.get_history_weights() == {}

    # Valid override
    hm.record_override(".test", Bunker.DOCUMENTS.value)
    assert hm.get_history_weights()[".test"][Bunker.DOCUMENTS.value] == 1

    # Clear
    hm.clear()
    assert not history_file.exists()

    # Corrupted JSON handling
    history_file.write_text("invalid json{{{", encoding="utf-8")
    assert hm.get_history_weights() == {}

    # Non-dict JSON
    history_file.write_text(json.dumps(["not", "a", "dict"]), encoding="utf-8")
    assert hm.get_history_weights() == {}


def test_api_static_and_error_branches(tmp_path: Path) -> None:
    """Test root endpoint and API error pathways."""
    # Root index response
    res = client.get("/")
    assert res.status_code in {200, 404}

    # Scan invalid path
    res_bad_scan = client.post("/api/scan", json={"folder_path": str(tmp_path / "not_existing")})
    assert res_bad_scan.status_code == 400

    # Plan with escaping relative path
    token = generate_csrf_token()
    decisions = [Decision(relative_path="../../escaped.txt", bunker=Bunker.DOCUMENTS.value)]
    res_bad_plan = client.post(
        "/api/plan",
        json={
            "root_path": str(tmp_path),
            "decisions": [d.model_dump() for d in decisions],
            "csrf_token": token,
        },
    )
    assert res_bad_plan.status_code == 403


def test_api_execute_and_undo_error_branches(tmp_path: Path) -> None:
    """Test security violations and missing files during execute and undo."""
    token = generate_csrf_token()

    # Execute with invalid target
    payload = {
        "root_path": str(tmp_path),
        "items": [
            {
                "source_path": "nonexistent.txt",
                "target_path": "Documents/nonexistent.txt",
                "action": "move",
                "size_bytes": 10,
                "bunker": "Documents",
            }
        ],
        "confirmed": True,
        "csrf_token": token,
    }
    res = client.post("/api/execute", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is False
    assert len(data["failed_items"]) == 1
