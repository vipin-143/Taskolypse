"""Creates a messy demo folder for safe, instant testing of Taskocalypse."""

from __future__ import annotations

import os
import time
from pathlib import Path


def create_demo_folder(base_dir: Path | None = None) -> Path:
    """Generate a realistic messy folder with varied files and duplicates."""
    target_dir = (base_dir or Path.cwd()) / "demo_folder"
    target_dir.mkdir(parents=True, exist_ok=True)

    # 1. Documents & Invoices
    (target_dir / "invoice_q1_acme.pdf").write_bytes(b"%PDF-1.4 simulated pdf invoice content")
    (target_dir / "annual_tax_statement_2023.docx").write_text(
        "Quarterly financial tax breakdown...", encoding="utf-8"
    )
    (target_dir / "grocery_receipt_oct.txt").write_text("Milk $3.50, Bread $2.00", encoding="utf-8")

    # 2. Images & Screenshots
    png_header = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"
    (target_dir / "Screenshot 2024-01-15 at 14.30.00.png").write_bytes(
        png_header + b"fake png data"
    )
    (target_dir / "vacation_sunset.jpg").write_bytes(b"\xff\xd8\xff\xe0\x00\x10JFIF" + b"fake jpg")
    (target_dir / "Screen Shot 2024-02-20.png").write_bytes(png_header + b"fake screenshot 2")

    # 3. Videos
    (target_dir / "screen_recording_demo.mp4").write_bytes(
        b"\x00\x00\x00\x18ftypmp42" + b"\x00" * 4096
    )

    # 4. Code & Data
    (target_dir / "data_cleanup.py").write_text("print('Cleaning data...')\n", encoding="utf-8")
    (target_dir / "config_backup.json").write_text('{"env": "production"}\n', encoding="utf-8")
    (target_dir / "legacy_style.css").write_text("body { margin: 0; }\n", encoding="utf-8")

    # 5. Archives
    (target_dir / "project_assets.zip").write_bytes(b"PK\x03\x04" + b"\x00" * 512)

    # 6. Installers (recent and old)
    recent_installer = target_dir / "SlackSetup.exe"
    recent_installer.write_bytes(b"MZ" + b"\x00" * 1024)

    old_installer = target_dir / "vlc_media_player_setup.exe"
    old_installer.write_bytes(b"MZ" + b"\x00" * 2048)
    # Backdate modified time to 300 days ago
    old_time = time.time() - (300 * 86400)
    os.utime(old_installer, (old_time, old_time))

    # 7. Exact Duplicates (standalone duplicate + hydra cluster)
    dup_bytes = b"EXACT_DUPLICATE_REPORT_PAYLOAD_ABC123"
    (target_dir / "monthly_financial_report.pdf").write_bytes(dup_bytes)
    (target_dir / "monthly_financial_report (1).pdf").write_bytes(dup_bytes)
    (target_dir / "monthly_financial_report_copy.pdf").write_bytes(dup_bytes)

    # Standalone duplicate (Glitch Monster)
    logo_bytes = png_header + b"brand_logo_payload_789"
    (target_dir / "company_logo.png").write_bytes(logo_bytes)
    (target_dir / "company_logo (1).png").write_bytes(logo_bytes)

    # 8. Empty 0-byte files and temporary junk
    (target_dir / "empty_error.log").write_bytes(b"")
    (target_dir / "download_package.crdownload").write_bytes(b"partial temp chunk")
    (target_dir / "cache_session.tmp").write_bytes(b"temp data")

    print(f"\nCreated messy demo folder at:\n  {target_dir.resolve()}\n")
    print(f"Total test files generated: {len(list(target_dir.glob('*')))}")
    return target_dir


if __name__ == "__main__":
    create_demo_folder()
