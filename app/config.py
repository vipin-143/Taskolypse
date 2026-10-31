"""Application configuration, constants, and bunker definitions."""

from enum import Enum
from pathlib import Path


class Bunker(str, Enum):
    """Supported destination bunkers for file classification."""

    DOCUMENTS = "Documents"
    IMAGES = "Images"
    VIDEOS = "Videos"
    CODE = "Code"
    ARCHIVES = "Archives"
    INSTALLERS = "Installers"
    TRASH = "Trash-Quarantine"
    KEEP = "Keep"


# Network and server binding
HOST: str = "127.0.0.1"
PORT: int = 8000
DEBUG: bool = False

# File scanning constants
MAX_FILES_PER_SCAN: int = 500
HASH_CHUNK_SIZE: int = 65536  # 64 KB chunk size for memory-safe hashing
QUARANTINE_DIR_NAME: str = ".taskocalypse_quarantine"
JOURNAL_PREFIX: str = ".taskocalypse_journal_"

# Ignored directory names during scanning
IGNORED_DIRS: frozenset[str] = frozenset(
    {
        ".git",
        ".svn",
        ".hg",
        ".taskocalypse_quarantine",
        "node_modules",
        "__pycache__",
        ".pytest_cache",
        ".ruff_cache",
        "$RECYCLE.BIN",
        "System Volume Information",
    }
)

# Extension sets mapped to Bunkers
BUNKER_EXTENSIONS: dict[str, frozenset[str]] = {
    Bunker.DOCUMENTS.value: frozenset(
        {
            ".pdf",
            ".docx",
            ".doc",
            ".xlsx",
            ".xls",
            ".pptx",
            ".ppt",
            ".txt",
            ".rtf",
            ".odt",
            ".ods",
            ".odp",
            ".csv",
            ".tsv",
            ".epub",
            ".md",
        }
    ),
    Bunker.IMAGES.value: frozenset(
        {
            ".jpg",
            ".jpeg",
            ".png",
            ".gif",
            ".bmp",
            ".webp",
            ".svg",
            ".ico",
            ".tiff",
            ".tif",
            ".heic",
            ".raw",
            ".psd",
            ".ai",
        }
    ),
    Bunker.VIDEOS.value: frozenset(
        {
            ".mp4",
            ".mkv",
            ".mov",
            ".avi",
            ".wmv",
            ".flv",
            ".webm",
            ".m4v",
            ".3gp",
        }
    ),
    Bunker.CODE.value: frozenset(
        {
            ".py",
            ".js",
            ".ts",
            ".jsx",
            ".tsx",
            ".html",
            ".css",
            ".json",
            ".yaml",
            ".yml",
            ".xml",
            ".sql",
            ".sh",
            ".bash",
            ".ps1",
            ".bat",
            ".cmd",
            ".c",
            ".cpp",
            ".h",
            ".hpp",
            ".java",
            ".rs",
            ".go",
            ".php",
            ".rb",
        }
    ),
    Bunker.ARCHIVES.value: frozenset(
        {
            ".zip",
            ".tar",
            ".gz",
            ".bz2",
            ".xz",
            ".7z",
            ".rar",
            ".tgz",
            ".iso",
        }
    ),
    Bunker.INSTALLERS.value: frozenset(
        {
            ".exe",
            ".msi",
            ".dmg",
            ".pkg",
            ".deb",
            ".rpm",
            ".appimage",
            ".apk",
        }
    ),
}

# Heuristic filename patterns
PATTERN_SCREENSHOT = r"(?i)(?:screenshot|screen\s*shot|captura|screengrab|prtscr|snip)"
PATTERN_INVOICE = r"(?i)(?:invoice|receipt|bill|statement|tax|factura|rechnung|payroll)"
PATTERN_INSTALLER = r"(?i)(?:setup|installer|install|update|patch|downloader)"
PATTERN_TEMP = r"(?i)(?:tmp|temp|cache|thumb|dump|\.part|\.crdownload|\.tmp)$"
PATTERN_COPY = r"(?i)(?:\(\d+\)|_copy| - copy|\.copy\d*)$"

# Age thresholds (seconds)
OLD_FILE_AGE_SECONDS: float = 180 * 86400.0  # 180 days
STALE_DOWNLOAD_AGE_SECONDS: float = 30 * 86400.0  # 30 days

# Rate limiting
RATE_LIMIT_MUTATION_MAX_REQUESTS: int = 30
RATE_LIMIT_MUTATION_WINDOW_SECONDS: int = 60

# History storage
HISTORY_FILE_PATH: Path = Path("history_overrides.json")
