"""Unit tests for pure classification engine."""

import time

from app.classifier import classify_file, get_extension_bunker, get_mime_bunker
from app.config import Bunker
from app.models import FileInfo


def make_file(
    name: str,
    size: int = 1024,
    mtime: float | None = None,
    is_duplicate: bool = False,
    duplicate_of: str | None = None,
    mime_type: str = "application/octet-stream",
) -> FileInfo:
    """Helper to instantiate FileInfo for pure testing."""
    ext = ("." + name.rsplit(".", 1)[1]) if "." in name else ""
    return FileInfo(
        relative_path=name,
        name=name,
        extension=ext.lower(),
        size_bytes=size,
        mtime=mtime if mtime is not None else time.time(),
        mime_type=mime_type,
        is_duplicate=is_duplicate,
        duplicate_of=duplicate_of,
    )


def test_duplicate_classification() -> None:
    """Duplicates must always be suggested for Trash-Quarantine with high confidence."""
    f = make_file("report (1).pdf", is_duplicate=True, duplicate_of="report.pdf")
    s = classify_file(f)
    assert s.bunker == Bunker.TRASH.value
    assert s.confidence >= 0.95
    assert "report.pdf" in s.reason
    assert "duplicate" in s.reason.lower()


def test_zero_byte_empty_file() -> None:
    """Empty files must be classified as Trash-Quarantine."""
    f = make_file("blank.txt", size=0)
    s = classify_file(f)
    assert s.bunker == Bunker.TRASH.value
    assert s.confidence >= 0.95
    assert "0 bytes" in s.reason or "empty" in s.reason.lower()


def test_temporary_download_files() -> None:
    """Incomplete/temp downloads should be routed to Trash-Quarantine."""
    f1 = make_file("big_video.mp4.crdownload", size=50000)
    f2 = make_file("download.part", size=1200)
    f3 = make_file("system.tmp", size=800)

    for item in [f1, f2, f3]:
        s = classify_file(item)
        assert s.bunker == Bunker.TRASH.value
        assert s.confidence >= 0.90


def test_screenshots_pattern() -> None:
    """Screenshots should route to Images even with unusual names."""
    f1 = make_file("Screenshot 2024-03-01 at 12.00.00.png")
    f2 = make_file("screen shot test.jpg")
    f3 = make_file("snip_capture.png")

    for item in [f1, f2, f3]:
        s = classify_file(item)
        assert s.bunker == Bunker.IMAGES.value
        assert s.confidence >= 0.90
        assert "screenshot" in s.reason.lower() or "capture" in s.reason.lower()


def test_invoices_and_financial() -> None:
    """Financial filenames should route to Documents."""
    f = make_file("invoice_vendor_4910.pdf")
    s = classify_file(f)
    assert s.bunker == Bunker.DOCUMENTS.value
    assert s.confidence >= 0.90
    assert "invoice" in s.reason.lower() or "financial" in s.reason.lower()


def test_all_standard_bunker_extensions() -> None:
    """Verify primary extensions map accurately to expected bunkers."""
    cases = [
        ("report.pdf", Bunker.DOCUMENTS.value),
        ("notes.docx", Bunker.DOCUMENTS.value),
        ("data.csv", Bunker.DOCUMENTS.value),
        ("photo.jpg", Bunker.IMAGES.value),
        ("vector.svg", Bunker.IMAGES.value),
        ("movie.mp4", Bunker.VIDEOS.value),
        ("recording.mov", Bunker.VIDEOS.value),
        ("app.py", Bunker.CODE.value),
        ("component.tsx", Bunker.CODE.value),
        ("schema.json", Bunker.CODE.value),
        ("archive.zip", Bunker.ARCHIVES.value),
        ("tarball.tar.gz", Bunker.ARCHIVES.value),
        ("setup.exe", Bunker.INSTALLERS.value),
        ("package.dmg", Bunker.INSTALLERS.value),
    ]

    for filename, expected_bunker in cases:
        f = make_file(filename)
        s = classify_file(f)
        assert s.bunker == expected_bunker, f"Failed for {filename}: got {s.bunker}"
        assert 0.0 <= s.confidence <= 1.0


def test_stale_installer_quarantine() -> None:
    """Installers older than 180 days should suggest Trash-Quarantine."""
    now = time.time()
    old_time = now - (200 * 86400)
    f = make_file("old_game_installer.exe", mtime=old_time)
    s = classify_file(f, current_time=now)
    assert s.bunker == Bunker.TRASH.value
    assert "older than 6 months" in s.reason.lower()


def test_user_history_learned_weights() -> None:
    """Heuristic engine should weight towards past user overrides."""
    history_weights = {
        ".log": {Bunker.CODE.value: 5, Bunker.DOCUMENTS.value: 1},
    }
    f = make_file("server.log")
    s = classify_file(f, history_weights=history_weights)
    assert s.bunker == Bunker.CODE.value
    assert "previous" in s.reason.lower() or "habits" in s.reason.lower()


def test_mime_type_fallback() -> None:
    """MIME type should provide a suggestion when extension is absent or uncommon."""
    f = make_file("unknown_media", mime_type="video/webm")
    s = classify_file(f)
    assert s.bunker == Bunker.VIDEOS.value


def test_unrecognized_file_fallback_keep() -> None:
    """Unknown formats should fallback safely to Keep."""
    f = make_file("mystery.xyz123")
    s = classify_file(f)
    assert s.bunker == Bunker.KEEP.value
    assert s.confidence <= 0.60


def test_get_mime_and_extension_helpers() -> None:
    """Test individual helper mappings."""
    assert get_extension_bunker(".py") == Bunker.CODE
    assert get_extension_bunker(".nonexistent") is None
    assert get_mime_bunker("image/png") == Bunker.IMAGES
    assert get_mime_bunker("video/mp4") == Bunker.VIDEOS
    assert get_mime_bunker("text/plain") == Bunker.DOCUMENTS
    assert get_mime_bunker("unknown/unknown") is None
