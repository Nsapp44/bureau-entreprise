"""Tests for session-title based project names."""

import json
from pathlib import Path

from claude_office_hooks.event_mapper import get_project_name, get_session_title


def _write(tmp_path: Path, lines: list[dict]) -> str:
    projects = tmp_path / "projects" / "C--bo-test"
    projects.mkdir(parents=True)
    path = projects / "s.jsonl"
    path.write_text("\n".join(json.dumps(x, ensure_ascii=False) for x in lines), encoding="utf-8")
    return str(path)


def test_latest_custom_title_wins(tmp_path: Path) -> None:
    path = _write(
        tmp_path,
        [
            {"type": "custom-title", "customTitle": "Ancien"},
            {"type": "user", "message": "x"},
            {"type": "custom-title", "customTitle": "Configurations et résultats montage"},
        ],
    )
    assert get_session_title(path) == "Configurations et résultats montage"
    assert get_project_name({"transcript_path": path}) == "Configurations et résultats montage"


def test_no_title_falls_back_to_project_dir(tmp_path: Path) -> None:
    path = _write(tmp_path, [{"type": "user", "message": "x"}])
    assert get_session_title(path) is None
    assert get_project_name({"transcript_path": path}, strip_prefixes=[]) == "C--bo-test"


def test_missing_transcript_is_none() -> None:
    assert get_session_title("/nope/none.jsonl") is None
    assert get_session_title(None) is None
