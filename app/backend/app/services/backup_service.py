"""Automatic backups of the SQLite database using the online backup API."""

import asyncio
import contextlib
import logging
import re
import sqlite3
from datetime import datetime
from pathlib import Path

from sqlalchemy.engine import make_url

from app.config import get_settings

logger = logging.getLogger("claude-office.backup")

_BACKUP_PATTERN = re.compile(r"^visualizer-\d{8}-\d{6}\.db$")


def resolve_db_path(database_url: str) -> Path | None:
    """Return the SQLite file path from a SQLAlchemy URL, or None if not a file DB."""
    url = make_url(database_url)
    if not url.drivername.startswith("sqlite") or not url.database or url.database == ":memory:":
        return None
    return Path(url.database)


def _backup_sync(src: Path, backup_dir: Path, keep: int) -> Path:
    """Copy *src* into *backup_dir* with the online backup API, then rotate."""
    backup_dir.mkdir(parents=True, exist_ok=True)
    dest = backup_dir / f"visualizer-{datetime.now():%Y%m%d-%H%M%S}.db"
    source = sqlite3.connect(src)
    try:
        target = sqlite3.connect(dest)
        try:
            source.backup(target)
        finally:
            target.close()
    finally:
        source.close()
    _rotate(backup_dir, keep)
    return dest


def _rotate(backup_dir: Path, keep: int) -> None:
    """Delete all but the *keep* most recent backups (matching files only)."""
    files = sorted(f for f in backup_dir.iterdir() if f.is_file() and _BACKUP_PATTERN.match(f.name))
    for old in files[: max(0, len(files) - max(keep, 1))]:
        with contextlib.suppress(OSError):
            old.unlink()


async def run_backup(
    src: Path | None = None, backup_dir: str | None = None, keep: int | None = None
) -> Path | None:
    """Run one backup. Never raises; returns the backup path or None."""
    try:
        settings = get_settings()
        target_dir = settings.BACKUP_DIR if backup_dir is None else backup_dir
        if not target_dir:
            return None
        db_path = src if src is not None else resolve_db_path(settings.DATABASE_URL)
        if db_path is None or not db_path.is_file():
            return None
        return await asyncio.to_thread(
            _backup_sync, db_path, Path(target_dir), settings.BACKUP_KEEP if keep is None else keep
        )
    except Exception:
        logger.exception("Database backup failed")
        return None


async def backup_loop(interval_minutes: float) -> None:
    """Back up periodically until cancelled."""
    try:
        while True:
            await asyncio.sleep(max(interval_minutes, 1) * 60)
            await run_backup()
    except asyncio.CancelledError:
        logger.info("Backup loop stopped")
