"""Pydantic data models for request and response validation."""

from typing import Any

from pydantic import BaseModel, Field


class FileInfo(BaseModel):
    """Metadata describing a single discovered file."""

    relative_path: str = Field(..., description="Path relative to the scan root")
    name: str = Field(..., description="File name including extension")
    extension: str = Field(default="", description="Lower-cased file extension with dot")
    size_bytes: int = Field(ge=0, description="Size of file in bytes")
    mtime: float = Field(..., description="Last modification timestamp (epoch)")
    mime_type: str = Field(default="application/octet-stream", description="Guessed MIME type")
    is_duplicate: bool = Field(default=False, description="Whether this file is a duplicate")
    duplicate_of: str | None = Field(
        default=None, description="Path of the original file if duplicate"
    )


class Suggestion(BaseModel):
    """Suggested bunker assignment and rationale from the classification engine."""

    bunker: str = Field(..., description="Suggested bunker name")
    confidence: float = Field(ge=0.0, le=1.0, description="Confidence score between 0.0 and 1.0")
    reason: str = Field(..., description="Human-readable rationale for the suggestion")


class ClassifiedFile(BaseModel):
    """File metadata combined with engine classification suggestion."""

    file: FileInfo
    suggestion: Suggestion


class ScanRequest(BaseModel):
    """Request payload to initiate a folder scan."""

    folder_path: str = Field(
        ..., min_length=1, max_length=1024, description="Target directory path"
    )
    include_subfolders: bool = Field(default=False, description="Whether to scan recursively")
    max_files: int = Field(default=200, ge=1, le=1000, description="Max files to scan")


class ScanResponse(BaseModel):
    """Response payload containing scanned files and classification."""

    root_path: str
    total_files: int
    total_size_bytes: int
    duplicate_count: int
    files: list[ClassifiedFile]
    csrf_token: str


class Decision(BaseModel):
    """Player decision for a single file."""

    relative_path: str = Field(..., description="Relative path of file")
    bunker: str = Field(..., description="Selected bunker destination")
    override: bool = Field(default=False, description="Whether user overrode engine suggestion")


class PlanRequest(BaseModel):
    """Request to generate a dry-run action plan from player decisions."""

    root_path: str = Field(..., description="Target root directory")
    decisions: list[Decision] = Field(..., min_length=1, description="List of decisions")
    csrf_token: str = Field(..., description="Anti-forgery token")


class PlanItem(BaseModel):
    """Individual item in the action plan."""

    source_path: str = Field(..., description="Relative source path")
    target_path: str | None = Field(default=None, description="Relative target path if moved")
    action: str = Field(..., description="Action: move, quarantine, or keep")
    size_bytes: int = Field(ge=0, description="File size in bytes")
    bunker: str = Field(..., description="Target bunker name")


class PlanResponse(BaseModel):
    """Dry-run preview response of the action plan."""

    root_path: str
    items: list[PlanItem]
    total_moves: int
    total_quarantined: int
    total_kept: int
    bytes_saved: int
    csrf_token: str


class ExecuteRequest(BaseModel):
    """Request to apply an action plan on disk."""

    root_path: str = Field(..., description="Root folder being organized")
    items: list[PlanItem] = Field(..., min_length=1, description="Items to execute")
    confirmed: bool = Field(..., description="Explicit user confirmation flag")
    csrf_token: str = Field(..., description="Anti-forgery token")


class ExecuteResult(BaseModel):
    """Result of plan execution."""

    success: bool
    journal_id: str
    executed_count: int
    failed_items: list[dict[str, Any]]
    message: str


class UndoRequest(BaseModel):
    """Request to revert an executed run."""

    root_path: str = Field(..., description="Root directory of previous run")
    journal_id: str = Field(..., min_length=1, description="ID of journal to undo")
    csrf_token: str = Field(..., description="Anti-forgery token")


class UndoResult(BaseModel):
    """Result of undo operation."""

    success: bool
    restored_count: int
    failed_count: int
    message: str


class OverrideFeedbackRequest(BaseModel):
    """User feedback when overriding a suggestion to train heuristics."""

    extension: str = Field(..., max_length=32)
    chosen_bunker: str = Field(...)
    original_bunker: str = Field(...)
    csrf_token: str = Field(...)
