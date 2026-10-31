"""Read-only file scanning, path security verification, and duplicate detection."""

from __future__ import annotations

import hashlib
import mimetypes
import os
from collections.abc import Generator
from pathlib import Path

from app.classifier import classify_file
from app.config import (
    HASH_CHUNK_SIZE,
    IGNORED_DIRS,
    MAX_FILES_PER_SCAN,
)
from app.history import history_manager
from app.models import ClassifiedFile, FileInfo, ScanResponse


class PathSecurityError(ValueError):
    """Raised when an illegal or escaping path is provided."""


# In-memory hash cache: (real_path, mtime, size) -> sha256_hex
_HASH_CACHE: dict[tuple[str, float, int], str] = {}


def validate_and_resolve_root(folder_path: str) -> Path:
    """Validate and resolve the target root directory.

    Rejects paths containing traversal tricks, non-existent directories,
    or files that are not directories.
    """
    if not folder_path or not folder_path.strip():
        raise PathSecurityError("Folder path cannot be empty.")

    raw_path = Path(folder_path)
    try:
        resolved = raw_path.resolve(strict=True)
    except (FileNotFoundError, RuntimeError) as err:
        raise PathSecurityError(f"Directory not found: {folder_path}") from err

    if not resolved.is_dir():
        raise PathSecurityError(f"Path is not a directory: {folder_path}")

    return resolved


def compute_file_hash(real_path: Path, mtime: float, size: int) -> str:
    """Compute SHA-256 hash using chunked streaming reads with in-memory caching."""
    cache_key = (str(real_path), mtime, size)
    if cache_key in _HASH_CACHE:
        return _HASH_CACHE[cache_key]

    hasher = hashlib.sha256()
    try:
        with open(real_path, "rb") as f:
            while chunk := f.read(HASH_CHUNK_SIZE):
                hasher.update(chunk)
    except OSError as err:
        raise OSError(f"Could not read file for hashing: {real_path}") from err

    digest = hasher.hexdigest()
    _HASH_CACHE[cache_key] = digest
    return digest


def scan_directory(
    root_path: Path,
    include_subfolders: bool = False,
    max_files: int = MAX_FILES_PER_SCAN,
) -> list[FileInfo]:
    """Perform read-only scan of directory entries using os.scandir."""
    discovered: list[FileInfo] = []

    def _walk(current_dir: Path) -> Generator[FileInfo, None, None]:
        try:
            with os.scandir(current_dir) as iterator:
                for entry in iterator:
                    try:
                        # Follow_symlinks=False prevents symlink escape during stat
                        stat_result = entry.stat(follow_symlinks=False)
                    except OSError:
                        continue

                    if entry.is_dir(follow_symlinks=False):
                        if entry.name in IGNORED_DIRS or entry.name.startswith("."):
                            continue
                        if include_subfolders:
                            yield from _walk(Path(entry.path))
                    elif entry.is_file(follow_symlinks=False):
                        if entry.name.startswith(".taskocalypse"):
                            continue
                        rel_path = os.path.relpath(entry.path, start=root_path)
                        _, ext = os.path.splitext(entry.name)
                        mime_type, _ = mimetypes.guess_type(entry.name)

                        yield FileInfo(
                            relative_path=rel_path.replace("\\", "/"),
                            name=entry.name,
                            extension=ext.lower(),
                            size_bytes=stat_result.st_size,
                            mtime=stat_result.st_mtime,
                            mime_type=mime_type or "application/octet-stream",
                            is_duplicate=False,
                            duplicate_of=None,
                        )
        except OSError:
            return

    for item in _walk(root_path):
        discovered.append(item)
        if len(discovered) >= max_files:
            break

    return discovered


def detect_duplicates(root_path: Path, files: list[FileInfo]) -> list[FileInfo]:
    """Detect byte-exact duplicate files using size grouping followed by chunked hash.

    Never hashes files that have a unique size. Only hashes candidates sharing an
    identical non-zero size.
    """
    # Group by size
    size_groups: dict[int, list[FileInfo]] = {}
    for f in files:
        if f.size_bytes > 0:
            size_groups.setdefault(f.size_bytes, []).append(f)

    # Hash collisions
    seen_hashes: dict[str, str] = {}  # sha256 -> original relative path
    for _size, group in size_groups.items():
        if len(group) < 2:
            continue
        for f in group:
            real_file_path = (root_path / Path(f.relative_path)).resolve()
            # Double check path containment
            if not str(real_file_path).startswith(str(root_path)):
                continue
            try:
                digest = compute_file_hash(real_file_path, f.mtime, f.size_bytes)
            except OSError:
                continue

            if digest in seen_hashes:
                f.is_duplicate = True
                f.duplicate_of = seen_hashes[digest]
            else:
                seen_hashes[digest] = f.relative_path

    return files


def run_scan(
    folder_path: str,
    include_subfolders: bool = False,
    max_files: int = MAX_FILES_PER_SCAN,
    csrf_token: str = "",
) -> ScanResponse:
    """Execute a complete scan, duplicate detection, and classification pipeline."""
    root = validate_and_resolve_root(folder_path)
    raw_files = scan_directory(root, include_subfolders=include_subfolders, max_files=max_files)
    analyzed_files = detect_duplicates(root, raw_files)
    history_weights = history_manager.get_history_weights()

    classified: list[ClassifiedFile] = []
    duplicate_count = 0
    total_size = 0

    for f in analyzed_files:
        total_size += f.size_bytes
        if f.is_duplicate:
            duplicate_count += 1
        suggestion = classify_file(f, history_weights=history_weights)
        classified.append(ClassifiedFile(file=f, suggestion=suggestion))

    return ScanResponse(
        root_path=str(root).replace("\\", "/"),
        total_files=len(classified),
        total_size_bytes=total_size,
        duplicate_count=duplicate_count,
        files=classified,
        csrf_token=csrf_token,
    )
