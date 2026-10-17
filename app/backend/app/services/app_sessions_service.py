"""Titres et dossiers des conversations, lus dans les fichiers de l'appli Claude.

L'onglet Code de l'appli de bureau garde un petit JSON par conversation
(``%APPDATA%/Claude/claude-code-sessions/<compte>/<org>/local_*.json``) avec le
titre affiché dans sa barre latérale, le dossier de travail et la dernière
activité. ``cliSessionId`` est l'identifiant de session vu par les hooks ;
``priorCliSessionIds`` liste ses identifiants précédents (reprise de conversation).

Lecture seule, aucun réseau. Absent (terminal ``claude``, Linux, Mac) : le
dictionnaire est simplement vide et le Bureau garde ses noms habituels.
"""

import json
import logging
import os
import re
import time
from pathlib import Path
from typing import TypedDict

logger = logging.getLogger(__name__)

_SCAN_TTL = 5.0
"""Secondes entre deux listages du dossier (les fichiers inchangés ne sont pas relus)."""

_APP_SESSION_ID = re.compile(r"local_[A-Za-z0-9-]{1,64}")
"""Forme acceptée pour ``sessionId`` (identifiant de la conversation dans l'appli)."""


class AppSession(TypedDict):
    """Ce que l'appli sait d'une conversation."""

    title: str | None
    folder: str | None
    last_activity: float | None
    """Dernière activité, en secondes depuis l'époque."""
    created: float | None
    """Création de la conversation dans l'appli, en secondes depuis l'époque."""
    app_session_id: str | None
    """``sessionId`` de l'appli (``local_...``), None s'il n'a pas la forme attendue."""
    model: str | None
    effort: str | None
    archived: bool


_CacheEntry = tuple[float, str, tuple[str, ...], AppSession | None]
"""(mtime, cliSessionId, priorCliSessionIds, conversation) pour un fichier."""

_file_cache: dict[Path, _CacheEntry] = {}
_scan: tuple[float, dict[str, AppSession]] = (0.0, {})


def _default_root() -> Path | None:
    base = os.environ.get("APPDATA")
    if not base:
        return None
    return Path(base) / "Claude" / "claude-code-sessions"


def _folder_name(cwd: str | None) -> str | None:
    if not cwd:
        return None
    parts = [p for p in cwd.replace("\\", "/").split("/") if p]
    return parts[-1] if parts else None


def _text(value: object) -> str | None:
    return value.strip() if isinstance(value, str) and value.strip() else None


def _parse(path: Path) -> tuple[str, tuple[str, ...], AppSession] | None:
    """(cliSessionId, priorCliSessionIds, conversation) d'un fichier, None si inutilisable."""
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    if not isinstance(data, dict):
        return None
    cli_id = data.get("cliSessionId")
    if not isinstance(cli_id, str) or not cli_id:
        return None
    title = data.get("title")
    activity = data.get("lastActivityAt")
    created = data.get("createdAt")
    app_id = data.get("sessionId")
    prior = data.get("priorCliSessionIds")
    prior_ids = tuple(
        dict.fromkeys(p for p in prior if isinstance(p, str) and p and p != cli_id)
        if isinstance(prior, list)
        else ()
    )
    return (
        cli_id,
        prior_ids,
        {
            "title": title.strip() if isinstance(title, str) and title.strip() else None,
            "folder": _folder_name(data.get("originCwd") or data.get("cwd")),
            "last_activity": activity / 1000 if isinstance(activity, int | float) else None,
            "created": created / 1000 if isinstance(created, int | float) else None,
            "app_session_id": (
                app_id if isinstance(app_id, str) and _APP_SESSION_ID.fullmatch(app_id) else None
            ),
            "model": _text(data.get("model")),
            "effort": _text(data.get("effort")),
            # Les routines (tâches planifiées) ne sont pas des conversations : écartées comme les archivées.
            "archived": data.get("isArchived") is True or bool(data.get("scheduledTaskId")),
        },
    )


def invalidate_app_sessions() -> None:
    """Oublie le dernier listage (après une suppression dans l'appli)."""
    global _scan
    _scan = (0.0, {})


def load_app_sessions(root: Path | None = None, now: float | None = None) -> dict[str, AppSession]:
    """Conversations de l'appli, indexées par identifiant de session Claude.

    Les anciens identifiants (``priorCliSessionIds``) pointent vers la même
    conversation, sans jamais écraser l'identifiant principal d'un autre fichier.
    """
    global _scan
    now = time.time() if now is None else now
    if root is None and now - _scan[0] < _SCAN_TTL:
        return _scan[1]

    base = root if root is not None else _default_root()
    result: dict[str, AppSession] = {}
    priors: dict[str, AppSession] = {}
    if base is not None and base.is_dir():
        for path in sorted(base.glob("*/*/local_*.json")):
            try:
                mtime = path.stat().st_mtime
            except OSError:
                continue
            cached = _file_cache.get(path)
            if cached is not None and cached[0] == mtime:
                entry = cached
            else:
                got = _parse(path)
                entry = (mtime, got[0], got[1], got[2]) if got else (mtime, "", (), None)
                _file_cache[path] = entry
            _, cli_id, prior_ids, session = entry
            if session is None or not cli_id:
                continue
            result[cli_id] = session
            for prior_id in prior_ids:
                priors.setdefault(prior_id, session)
        for prior_id, session in priors.items():
            result.setdefault(prior_id, session)

    if root is None:
        _scan = (now, result)
    return result
