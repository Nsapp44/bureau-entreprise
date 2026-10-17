"""Tests for per-conversation token usage (usage_service.compute_session_usage)."""

import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

from app.services import usage_service


def _rec(
    msg_id: str,
    req: str,
    ts: str,
    model: str = "claude-opus-5-5",
    session: str = "s1",
    **usage: int,
) -> str:
    base = {
        "input_tokens": 0,
        "output_tokens": 0,
        "cache_creation_input_tokens": 0,
        "cache_read_input_tokens": 0,
    }
    base.update(usage)
    return json.dumps(
        {
            "type": "assistant",
            "sessionId": session,
            "requestId": req,
            "timestamp": ts,
            "message": {"id": msg_id, "model": model, "usage": base},
        }
    )


@pytest.fixture
def projects(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    root = tmp_path / ".claude" / "projects"
    root.mkdir(parents=True)
    monkeypatch.setattr(Path, "home", classmethod(lambda cls: tmp_path))
    usage_service._cache.clear()  # pyright: ignore[reportPrivateUsage]
    return root


def _local_noon_utc(days_ago: int = 0, hour: int = 12) -> str:
    local = datetime.now().astimezone().replace(hour=hour, minute=0, second=0, microsecond=0)
    return (local - timedelta(days=days_ago)).astimezone(UTC).isoformat()


def test_total_today_and_last_model_per_session(projects: Path) -> None:
    proj = projects / "p"
    proj.mkdir()
    yesterday, noon, evening = _local_noon_utc(1), _local_noon_utc(0), _local_noon_utc(0, 18)
    (proj / "s1.jsonl").write_text(
        "\n".join(
            [
                # Most recent entry of s1 comes first in the file on purpose.
                _rec(
                    "m3", "r3", evening, model="claude-sonnet-5-5", input_tokens=1, output_tokens=2
                ),
                _rec(
                    "m1",
                    "r1",
                    yesterday,
                    model="claude-opus-5-5",
                    input_tokens=100,
                    output_tokens=50,
                ),
                _rec(
                    "m2",
                    "r2",
                    noon,
                    model="claude-opus-5-5",
                    input_tokens=10,
                    cache_read_input_tokens=5,
                ),
                _rec(
                    "m2",
                    "r2",
                    noon,
                    model="claude-opus-5-5",
                    input_tokens=10,
                    cache_read_input_tokens=5,
                ),
                # Synthetic model: never counted, never reported as the model.
                _rec("m4", "r4", _local_noon_utc(0, 23), model="<synthetic>", input_tokens=999),
            ]
        )
        + "\n",
        encoding="utf-8",
    )
    (proj / "s2.jsonl").write_text(
        _rec("n1", "q1", yesterday, model="claude-opus-5-5", session="s2", input_tokens=7) + "\n",
        encoding="utf-8",
    )

    got = usage_service.compute_session_usage()

    assert got == {
        "s1": {
            "total": 100 + 50 + 10 + 5 + 1 + 2,
            "today": 10 + 5 + 1 + 2,
            "model": "claude-sonnet-5-5",
        },
        "s2": {"total": 7, "today": 0, "model": "claude-opus-5-5"},
    }


def test_today_parameter_selects_the_day(projects: Path) -> None:
    proj = projects / "p"
    proj.mkdir()
    (proj / "s1.jsonl").write_text(
        "\n".join(
            [
                _rec("m1", "r1", _local_noon_utc(1), input_tokens=100),
                _rec("m2", "r2", _local_noon_utc(0), input_tokens=10),
            ]
        )
        + "\n",
        encoding="utf-8",
    )
    yesterday = (datetime.now().astimezone() - timedelta(days=1)).date()

    assert usage_service.compute_session_usage(today=yesterday)["s1"] == {
        "total": 110,
        "today": 100,
        "model": "claude-opus-5-5",
    }
    assert usage_service.compute_session_usage()["s1"]["today"] == 10


def test_total_matches_compute_sessions(projects: Path) -> None:
    proj = projects / "p"
    (proj / "s1" / "subagents").mkdir(parents=True)
    now = _local_noon_utc(0)
    (proj / "s1.jsonl").write_text(
        _rec("m1", "r1", now, input_tokens=10, output_tokens=5) + "\n", encoding="utf-8"
    )
    (proj / "s1" / "subagents" / "agent-a.jsonl").write_text(
        _rec("m9", "r9", now, model="claude-haiku-4-5", output_tokens=3) + "\n", encoding="utf-8"
    )
    (proj / "s2.jsonl").write_text(
        _rec("n1", "q1", _local_noon_utc(2), session="s2", cache_creation_input_tokens=4) + "\n",
        encoding="utf-8",
    )

    per_session = usage_service.compute_sessions()
    usage = usage_service.compute_session_usage()

    assert set(usage) == set(per_session)
    for sid, info in usage.items():
        assert info["total"] == per_session[sid]["totals"]["total"]
    assert usage["s1"]["total"] == 18  # sub-agent transcript counts in its parent
    assert usage["s2"]["today"] == 0


def test_no_transcripts_gives_empty_dict(projects: Path) -> None:
    assert usage_service.compute_session_usage() == {}
