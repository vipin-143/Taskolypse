"""Unit tests for scanner and duplicate detection."""

from pathlib import Path

import pytest

from app.config import IGNORED_DIRS
from app.scanner import (
    PathSecurityError,
    compute_file_hash,
    detect_duplicates,
    run_scan,
    scan_directory,
    validate_and_resolve_root,
)


def test_validate_and_resolve_root_valid(tmp_path: Path) -> None:
    """Resolving a valid directory must succeed and return resolved path."""
    resolved = validate_and_resolve_root(str(tmp_path))
    assert resolved == tmp_path.resolve()


def test_validate_and_resolve_root_invalid(tmp_path: Path) -> None:
    """Non-existent or empty path must raise PathSecurityError."""
    with pytest.raises(PathSecurityError):
        validate_and_resolve_root("")

    with pytest.raises(PathSecurityError):
        validate_and_resolve_root(str(tmp_path / "does_not_exist"))

    # File instead of directory
    a_file = tmp_path / "file.txt"
    a_file.write_text("hello", encoding="utf-8")
    with pytest.raises(PathSecurityError):
        validate_and_resolve_root(str(a_file))


def test_scan_directory_and_ignored(tmp_path: Path) -> None:
    """Scanner should find files and ignore hidden/system directories."""
    (tmp_path / "doc1.txt").write_text("Hello doc1", encoding="utf-8")
    (tmp_path / "photo.png").write_bytes(b"image bytes")

    # Ignored directory
    for ign in IGNORED_DIRS:
        ign_dir = tmp_path / ign
        ign_dir.mkdir(parents=True, exist_ok=True)
        (ign_dir / "should_ignore.txt").write_text("ignore me", encoding="utf-8")

    sub = tmp_path / "nested"
    sub.mkdir()
    (sub / "nested_doc.pdf").write_bytes(b"pdf data")

    # Non-recursive
    files_flat = scan_directory(tmp_path, include_subfolders=False)
    assert len(files_flat) == 2
    names = {f.name for f in files_flat}
    assert "doc1.txt" in names
    assert "photo.png" in names
    assert "nested_doc.pdf" not in names

    # Recursive
    files_rec = scan_directory(tmp_path, include_subfolders=True)
    names_rec = {f.name for f in files_rec}
    assert "nested_doc.pdf" in names_rec
    assert "should_ignore.txt" not in names_rec


def test_duplicate_detection(tmp_path: Path) -> None:
    """Duplicate detection must match identical byte files and preserve originals."""
    payload = b"IDENTICAL_CONTENT_HASH_STREAM"
    (tmp_path / "original.txt").write_bytes(payload)
    (tmp_path / "copy.txt").write_bytes(payload)
    (tmp_path / "different.txt").write_bytes(b"DIFFERENT_CONTENT_HERE")

    files = scan_directory(tmp_path)
    analyzed = detect_duplicates(tmp_path, files)

    duplicates = [f for f in analyzed if f.is_duplicate]
    assert len(duplicates) == 1
    assert duplicates[0].duplicate_of is not None
    assert "original.txt" in duplicates[0].duplicate_of or "copy.txt" in duplicates[0].duplicate_of


def test_hash_caching(tmp_path: Path) -> None:
    """File hash should be cached on identical (path, mtime, size)."""
    target = tmp_path / "sample.bin"
    target.write_bytes(b"HASH_ME_NOW")
    stat = target.stat()

    hash1 = compute_file_hash(target, stat.st_mtime, stat.st_size)
    hash2 = compute_file_hash(target, stat.st_mtime, stat.st_size)
    assert hash1 == hash2


def test_run_scan_complete_pipeline(tmp_path: Path) -> None:
    """run_scan should return a valid ScanResponse with classified items."""
    (tmp_path / "invoice_123.pdf").write_bytes(b"invoice data")
    (tmp_path / "game_screenshot.png").write_bytes(b"screenshot png")

    response = run_scan(str(tmp_path), csrf_token="test_csrf_token")
    assert response.total_files == 2
    assert response.duplicate_count == 0
    assert response.csrf_token == "test_csrf_token"
    assert len(response.files) == 2
