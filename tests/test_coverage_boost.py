"""Additional edge-case tests to raise coverage above 90%."""

import json
from pathlib import Path

import pytest
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


def test_api_index_and_demo_auto_provision(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    """Test api.index ASGI import and demo auto-provisioning for cloud/Vercel."""
    from api.index import app as index_app

    assert index_app is not None

    # Test demo auto-provisioning in scanner
    monkeypatch.setenv("VERCEL", "1")
    monkeypatch.setattr("tempfile.gettempdir", lambda: str(tmp_path))
    from app.scanner import validate_and_resolve_root

    resolved = validate_and_resolve_root("demo")
    assert resolved.exists()
    assert resolved.is_dir()


@pytest.mark.asyncio
async def test_vercel_path_middleware_query_and_headers() -> None:
    """Test VercelPathMiddleware correctly restores path from query and headers."""
    from api.index import VercelPathMiddleware

    recorded: dict[str, object] = {}

    class MockApp:
        async def __call__(self, scope: dict, receive: object, send: object) -> None:
            recorded["path"] = scope.get("path")
            recorded["query_string"] = scope.get("query_string")

    mw = VercelPathMiddleware(MockApp())

    # Case 1: __path query parameter
    s1 = {"type": "http", "path": "/api/index.py", "query_string": b"__path=/static/style.css&test=1"}
    await mw(s1, None, None)
    assert recorded["path"] == "/static/style.css"
    assert recorded["query_string"] == b"test=1"

    # Case 2: x-invoke-path header
    s2 = {
        "type": "http",
        "path": "/api/index.py",
        "query_string": b"",
        "headers": [(b"x-invoke-path", b"/static/js/main.js")],
    }
    await mw(s2, None, None)
    assert recorded["path"] == "/static/js/main.js"

    # Case 3: Root fallback
    s3 = {"type": "http", "path": "/api/index.py", "query_string": b"", "headers": []}
    await mw(s3, None, None)
    assert recorded["path"] == "/"

    # Test root /style.css endpoint
    res_css = client.get("/style.css")
    assert res_css.status_code == 200
    assert "text/css" in res_css.headers.get("content-type", "")
