"""Pure, context-aware classification engine for Taskocalypse.

This module contains NO filesystem I/O. It evaluates file metadata and
produces deterministic bunker suggestions, confidence scores, and human-readable
reasons.
"""

from __future__ import annotations

import re
import time
from collections.abc import Mapping

from app.config import (
    BUNKER_EXTENSIONS,
    OLD_FILE_AGE_SECONDS,
    PATTERN_COPY,
    PATTERN_INSTALLER,
    PATTERN_INVOICE,
    PATTERN_SCREENSHOT,
    PATTERN_TEMP,
    Bunker,
)
from app.models import FileInfo, Suggestion


def get_extension_bunker(ext: str) -> Bunker | None:
    """Return the primary bunker corresponding to a file extension."""
    ext_lower = ext.lower()
    for bunker_name, extensions in BUNKER_EXTENSIONS.items():
        if ext_lower in extensions:
            return Bunker(bunker_name)
    return None


def get_mime_bunker(mime_type: str) -> Bunker | None:
    """Return the suggested bunker according to MIME type prefix."""
    mime_lower = mime_type.lower()
    if mime_lower.startswith("image/"):
        return Bunker.IMAGES
    if mime_lower.startswith("video/"):
        return Bunker.VIDEOS
    if mime_lower.startswith("audio/"):
        return Bunker.VIDEOS  # Group media with videos or documents
    if mime_lower.startswith("text/") or "pdf" in mime_lower or "word" in mime_lower:
        return Bunker.DOCUMENTS
    if "zip" in mime_lower or "tar" in mime_lower or "compressed" in mime_lower:
        return Bunker.ARCHIVES
    return None


def classify_file(
    file_info: FileInfo,
    current_time: float | None = None,
    history_weights: Mapping[str, Mapping[str, int]] | None = None,
) -> Suggestion:
    """Classify a file based on metadata, pattern heuristics, and user history.

    This function is completely pure and performs no filesystem I/O.

    Args:
        file_info: File metadata describing the file.
        current_time: Epoch timestamp used to evaluate file age (defaults to current time).
        history_weights: Nested mapping of extension -> {bunker: count} representing
            learned user overrides.

    Returns:
        Suggestion containing chosen bunker, confidence (0.0 - 1.0), and human rationale.
    """
    now = current_time if current_time is not None else time.time()
    name = file_info.name
    name_no_ext = name.rsplit(".", 1)[0] if "." in name else name
    ext = file_info.extension.lower()
    file_age = max(0.0, now - file_info.mtime)

    # 1. Exact Duplicate Content Detection
    if file_info.is_duplicate:
        dup_target = file_info.duplicate_of or "another file"
        return Suggestion(
            bunker=Bunker.TRASH.value,
            confidence=0.98,
            reason=f"Identical duplicate of '{dup_target}' (identical byte hash).",
        )

    # 2. Empty 0-byte Files
    if file_info.size_bytes == 0:
        return Suggestion(
            bunker=Bunker.TRASH.value,
            confidence=0.95,
            reason="Empty zero-byte file containing no data.",
        )

    # 3. Incomplete / Temp Download Files
    if re.search(PATTERN_TEMP, name, re.IGNORECASE) or ext in {".crdownload", ".part", ".tmp"}:
        return Suggestion(
            bunker=Bunker.TRASH.value,
            confidence=0.96,
            reason="Incomplete or temporary download fragment.",
        )

    # 4. User Learned Preferences / Overrides
    if history_weights and ext in history_weights:
        bunker_counts = history_weights[ext]
        total_overrides = sum(bunker_counts.values())
        if total_overrides >= 2:
            top_bunker = max(bunker_counts.items(), key=lambda item: item[1])[0]
            top_ratio = bunker_counts[top_bunker] / total_overrides
            if top_ratio >= 0.65:
                return Suggestion(
                    bunker=top_bunker,
                    confidence=min(0.95, 0.75 + (top_ratio * 0.2)),
                    reason=f"Based on your previous organization habits for {ext} files.",
                )

    # 5. Pattern-driven Heuristics (Screenshots, Invoices, Installers, Copy suffixes)
    is_screenshot = bool(re.search(PATTERN_SCREENSHOT, name_no_ext, re.IGNORECASE))
    is_invoice = bool(re.search(PATTERN_INVOICE, name_no_ext, re.IGNORECASE))
    is_installer_name = bool(re.search(PATTERN_INSTALLER, name_no_ext, re.IGNORECASE))
    has_copy_suffix = bool(re.search(PATTERN_COPY, name_no_ext, re.IGNORECASE))

    # Screenshots -> Images
    if is_screenshot:
        return Suggestion(
            bunker=Bunker.IMAGES.value,
            confidence=0.93,
            reason="Filename pattern identifies this as a screenshot / screen capture.",
        )

    # Financial / Invoices -> Documents
    if is_invoice and ext in BUNKER_EXTENSIONS[Bunker.DOCUMENTS.value]:
        return Suggestion(
            bunker=Bunker.DOCUMENTS.value,
            confidence=0.94,
            reason="Identified as an invoice, receipt, or financial statement.",
        )

    # Old downloaded installers -> Quarantine suggestion
    if ext in BUNKER_EXTENSIONS[Bunker.INSTALLERS.value] or is_installer_name:
        if file_age > OLD_FILE_AGE_SECONDS and ext in BUNKER_EXTENSIONS[Bunker.INSTALLERS.value]:
            return Suggestion(
                bunker=Bunker.TRASH.value,
                confidence=0.88,
                reason="Setup installer older than 6 months; safe to quarantine.",
            )
        return Suggestion(
            bunker=Bunker.INSTALLERS.value,
            confidence=0.92,
            reason="Software installer or application executable package.",
        )

    # Suffix copy without confirmed hash duplicate
    if has_copy_suffix:
        base_bunker = get_extension_bunker(ext)
        if base_bunker:
            return Suggestion(
                bunker=base_bunker.value,
                confidence=0.80,
                reason=f"Categorized as {base_bunker.value}; note duplicate copy suffix '({name})'.",
            )

    # 6. Primary Extension Matching
    ext_bunker = get_extension_bunker(ext)
    if ext_bunker:
        return Suggestion(
            bunker=ext_bunker.value,
            confidence=0.90,
            reason=f"Standard file type recognized ({ext} -> {ext_bunker.value}).",
        )

    # 7. MIME Type Matching
    mime_bunker = get_mime_bunker(file_info.mime_type)
    if mime_bunker:
        return Suggestion(
            bunker=mime_bunker.value,
            confidence=0.75,
            reason=f"Content MIME type identified as {file_info.mime_type}.",
        )

    # 8. Stale or untouched miscellaneous files
    if file_age > OLD_FILE_AGE_SECONDS:
        return Suggestion(
            bunker=Bunker.KEEP.value,
            confidence=0.55,
            reason="Older unclassified file; recommended to keep in place unless manually sorted.",
        )

    # 9. Fallback Safe Default
    return Suggestion(
        bunker=Bunker.KEEP.value,
        confidence=0.45,
        reason="Unrecognized format; kept in place to prevent accidental displacement.",
    )
