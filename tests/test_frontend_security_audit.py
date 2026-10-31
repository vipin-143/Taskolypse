"""Security and Code Quality audit for static frontend files.

Enforces zero external CDNs, zero innerHTML with file data, zero eval,
and strict CSP compliance without requiring npm/ESLint.
"""

import re
from pathlib import Path

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"


def test_no_banned_patterns_in_javascript() -> None:
    """Verify JS files contain no dangerous dynamic execution patterns."""
    banned_patterns = [
        (re.compile(r"\binnerHTML\b"), "innerHTML (use textContent or safe DOM nodes)"),
        (re.compile(r"\beval\s*\("), "eval() is prohibited by CSP"),
        (re.compile(r"new\s+Function\s*\("), "new Function() is prohibited by CSP"),
        (re.compile(r"document\.write\s*\("), "document.write is prohibited"),
    ]

    js_files = list(STATIC_DIR.rglob("*.js"))
    assert len(js_files) > 0, "No JavaScript files found in static/"

    for js_path in js_files:
        content = js_path.read_text(encoding="utf-8")
        for pattern, reason in banned_patterns:
            matches = pattern.findall(content)
            assert len(matches) == 0, (
                f"Banned pattern '{pattern.pattern}' found in {js_path.name}: {reason}"
            )


def test_no_inline_event_handlers_in_html() -> None:
    """Verify HTML contains no inline on* event handlers violating strict CSP."""
    html_files = list(STATIC_DIR.rglob("*.html"))
    assert len(html_files) > 0, "No HTML files found in static/"

    inline_handler_pattern = re.compile(r'\s+on[a-z]+\s*=\s*["\']', re.IGNORECASE)

    for html_path in html_files:
        content = html_path.read_text(encoding="utf-8")
        matches = inline_handler_pattern.findall(content)
        assert len(matches) == 0, f"Inline event handlers found in {html_path.name}: {matches}"


def test_no_external_cdn_dependencies() -> None:
    """Verify HTML and CSS contain no external CDN scripts, styles, or fonts."""
    external_url_pattern = re.compile(
        r'(?:src|href)\s*=\s*["\']https?://(?!localhost|127\.0\.0\.1)',
        re.IGNORECASE,
    )

    for file_path in STATIC_DIR.rglob("*"):
        if file_path.suffix in {".html", ".css", ".js"}:
            content = file_path.read_text(encoding="utf-8")
            matches = external_url_pattern.findall(content)
            assert len(matches) == 0, (
                f"External URL dependency found in {file_path.name}: {matches}"
            )
