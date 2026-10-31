"""Security verification tests.

Validates path confinement, CSRF anti-forgery, header injection,
confirmation requirements, and input validation.
"""

from pathlib import Path

from fastapi.testclient import TestClient

from app.api import app, generate_csrf_token
from app.config import RATE_LIMIT_MUTATION_MAX_REQUESTS
from app.executor import SecurityViolationError, verify_contained_path

client = TestClient(app)


def test_security_headers_present() -> None:
    """Security headers must be present on every response."""
    response = client.get("/api/health")
    assert response.status_code == 200
    headers = response.headers
    assert "Content-Security-Policy" in headers
    assert "default-src 'self'" in headers["Content-Security-Policy"]
    assert headers.get("X-Content-Type-Options") == "nosniff"
    assert headers.get("X-Frame-Options") == "DENY"


def test_csrf_token_required_on_mutating_endpoints() -> None:
    """Mutating endpoints must reject requests lacking valid CSRF tokens."""
    # Plan endpoint without CSRF
    res_plan = client.post(
        "/api/plan",
        json={"root_path": "C:/dummy", "decisions": [], "csrf_token": "invalid_token"},
    )
    assert res_plan.status_code in {400, 403, 422}

    # Execute endpoint without CSRF
    res_exec = client.post(
        "/api/execute",
        json={
            "root_path": "C:/dummy",
            "items": [],
            "confirmed": True,
            "csrf_token": "fake_token",
        },
    )
    assert res_exec.status_code in {400, 403, 422}

    # Undo endpoint without CSRF
    res_undo = client.post(
        "/api/undo",
        json={
            "root_path": "C:/dummy",
            "journal_id": "test_id",
            "csrf_token": "bad_token",
        },
    )
    assert res_undo.status_code in {400, 403, 422}


def test_path_traversal_blocked(tmp_path: Path) -> None:
    """Verify paths attempting traversal beyond the sandbox are blocked."""
    root = tmp_path / "sandbox"
    root.mkdir()

    traversal_attempts = [
        "../escaped.txt",
        "../../boot.ini",
        "nested/../../secret.txt",
        "/etc/passwd",
        "C:\\Windows\\System32\\cmd.exe",
    ]

    for attempt in traversal_attempts:
        try:
            verify_contained_path(root, attempt)
            # If it didn't raise, verify it resolved inside root
            resolved = (root / attempt).resolve()
            assert resolved.is_relative_to(root.resolve())
        except SecurityViolationError:
            pass  # Expected


def test_execution_requires_explicit_confirmation(tmp_path: Path) -> None:
    """Plan execution must fail if confirmed=False."""
    token = generate_csrf_token()
    payload = {
        "root_path": str(tmp_path),
        "items": [
            {
                "source_path": "test.txt",
                "target_path": "Documents/test.txt",
                "action": "move",
                "size_bytes": 10,
                "bunker": "Documents",
            }
        ],
        "confirmed": False,
        "csrf_token": token,
    }
    res = client.post("/api/execute", json=payload)
    assert res.status_code == 400
    assert "explicit player confirmation" in res.json().get("detail", "")


def test_invalid_payload_schema_rejection() -> None:
    """Invalid types or missing required fields must return 422 Unprocessable Entity."""
    # Negative file size
    bad_payload = {
        "root_path": "D:/test",
        "items": [{"source_path": "test.txt", "size_bytes": -50}],
        "confirmed": True,
        "csrf_token": "token",
    }
    res = client.post("/api/execute", json=bad_payload)
    assert res.status_code == 422


def test_rate_limiting_on_mutations(tmp_path: Path) -> None:
    """Repeated calls exceeding the mutation threshold must return 429 Too Many Requests."""
    token = generate_csrf_token()
    payload = {
        "root_path": str(tmp_path),
        "journal_id": "test_rate_limit",
        "csrf_token": token,
    }

    # Trigger multiple requests up to threshold
    hit_rate_limit = False
    for _ in range(RATE_LIMIT_MUTATION_MAX_REQUESTS + 5):
        res = client.post("/api/undo", json=payload)
        if res.status_code == 429:
            hit_rate_limit = True
            break

    assert hit_rate_limit, "Rate limiter failed to throttle excessive requests"
