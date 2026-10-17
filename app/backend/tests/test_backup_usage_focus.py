"""Tests for DB backups, token usage aggregation and app-focus route."""

import json
import sqlite3
import sys
from datetime import UTC, datetime
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.services import backup_service, usage_service


class TestBackup:
    @pytest.mark.asyncio
    async def test_copy_and_rotation(self, tmp_path: Path) -> None:
        db = tmp_path / "visualizer.db"
        con = sqlite3.connect(db)
        con.execute("create table t (x integer)")
        con.execute("insert into t values (42)")
        con.commit()
        con.close()
        out = tmp_path / "bk"
        out.mkdir()
        # Pre-existing backups (old names) plus an unrelated file that must survive.
        for i in range(4):
            (out / f"visualizer-2020010{i + 1}-000000.db").write_bytes(b"x")
        (out / "keepme.txt").write_text("x")

        dest = await backup_service.run_backup(db, str(out), 3)

        assert dest is not None and dest.exists()
        copy = sqlite3.connect(dest)
        assert copy.execute("select x from t").fetchone() == (42,)
        copy.close()
        names = sorted(p.name for p in out.glob("visualizer-*.db"))
        assert len(names) == 3 and dest.name in names
        assert (out / "keepme.txt").exists()

    @pytest.mark.asyncio
    async def test_disabled_and_errors_not_fatal(self, tmp_path: Path) -> None:
        assert await backup_service.run_backup(tmp_path / "x.db", "", 3) is None
        assert await backup_service.run_backup(tmp_path / "missing.db", str(tmp_path), 3) is None


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


def _utc_noon_today() -> str:
    local = datetime.now().astimezone()
    return local.replace(hour=12, minute=0, second=0, microsecond=0).astimezone(UTC).isoformat()


class TestUsage:
    def test_dedupe_models_subagent_and_local_day(self, projects: Path) -> None:
        proj = projects / "p"
        (proj / "s1" / "subagents").mkdir(parents=True)
        now = _utc_noon_today()
        main = [
            _rec("m1", "r1", now, input_tokens=10, output_tokens=5),
            _rec("m1", "r1", now, input_tokens=10, output_tokens=7),  # streaming dup
            _rec("m2", "r2", now, model="claude-haiku-4-5", cache_read_input_tokens=100),
            _rec("m3", "r3", now, model="<synthetic>", input_tokens=999),
            _rec("m4", "r4", "2020-01-01T00:00:00Z", input_tokens=1000),  # old day
            "not json",
        ]
        (proj / "s1.jsonl").write_text("\n".join(main), encoding="utf-8")
        sub = _rec("m5", "r5", now, cache_creation_input_tokens=3)
        (proj / "s1" / "subagents" / "agent-a.jsonl").write_text(sub, encoding="utf-8")

        today = usage_service.compute_today()
        assert today["date"] == datetime.now().astimezone().date().isoformat()
        assert today["totals"] == {
            "input": 10,
            "output": 5,
            "cacheRead": 100,
            "cacheWrite": 3,
            "total": 118,
        }
        assert set(today["byModel"]) == {"claude-opus-5-5", "claude-haiku-4-5"}
        assert today["byModel"]["claude-haiku-4-5"]["total"] == 100

        sessions = usage_service.compute_sessions()
        assert set(sessions) == {"s1"}
        assert sessions["s1"]["totals"]["total"] == 1118

    def test_cache_reuses_unchanged_file(self, projects: Path) -> None:
        f = projects / "a.jsonl"
        f.write_text(_rec("m", "r", _utc_noon_today(), input_tokens=1), encoding="utf-8")
        usage_service.compute_sessions()
        with patch.object(usage_service, "_parse_file") as parse:
            usage_service.compute_sessions()
        parse.assert_not_called()

    def test_routes(self, projects: Path) -> None:
        from app.main import app

        (projects / "a.jsonl").write_text(
            _rec("m", "r", _utc_noon_today(), input_tokens=2), encoding="utf-8"
        )
        c = TestClient(app, client=("127.0.0.1", 50000))
        assert c.get("/api/v1/usage/today").json()["totals"]["total"] == 2
        assert c.get("/api/v1/usage/sessions").json()["s1"]["totals"]["input"] == 2


class TestCurrentContext:
    def test_levels(self) -> None:
        assert usage_service.context_level(59_999) == "ok"
        assert usage_service.context_level(60_000) == "heavy"
        assert usage_service.context_level(110_000) == "critical"

    def test_latest_session_and_idle(self, projects: Path) -> None:
        (projects / "a.jsonl").write_text(
            "\n".join(
                [
                    _rec("m1", "r1", "2026-10-07T08:00:00Z", input_tokens=5),
                    _rec(
                        "m2",
                        "r2",
                        "2026-10-07T09:00:00Z",
                        input_tokens=10,
                        cache_read_input_tokens=70_000,
                        cache_creation_input_tokens=5,
                    ),
                ]
            ),
            encoding="utf-8",
        )
        at = datetime(2026, 10, 7, 9, 5, tzinfo=UTC).timestamp()
        cur = usage_service.current_context(now=at)
        assert cur["sessionId"] == "s1"
        assert cur["context"] == 70_015
        assert cur["level"] == "heavy"
        idle = usage_service.current_context(now=at + 7200)
        assert idle["sessionId"] is None

    def test_route(self, projects: Path) -> None:
        from app.main import app

        c = TestClient(app, client=("127.0.0.1", 50000))
        assert c.get("/api/v1/usage/current").json()["level"] == "ok"


class TestAppFocus:
    @pytest.fixture
    def client(self) -> TestClient:
        from app.main import app

        return TestClient(app, client=("127.0.0.1", 50000))

    @pytest.mark.parametrize("headers", [{}, {"Origin": "http://evil.com"}])
    def test_refused_without_good_origin(self, client: TestClient, headers: dict[str, str]) -> None:
        with patch("app.api.routes.shutdown._focus_claude_window") as focus:
            resp = client.post("/api/v1/app/focus", headers=headers)
        assert resp.status_code == 403
        focus.assert_not_called()

    @pytest.mark.skipif(sys.platform != "win32", reason="Windows only")
    @pytest.mark.parametrize(("found", "status"), [(True, "ok"), (False, "not_found")])
    def test_focus_mocked(self, client: TestClient, found: bool, status: str) -> None:
        with patch("app.api.routes.shutdown._focus_claude_window", return_value=found) as focus:
            resp = client.post("/api/v1/app/focus", headers={"Origin": "http://localhost:8000"})
        assert resp.status_code == 200
        assert resp.json() == {"status": status}
        focus.assert_called_once()

    @pytest.mark.skipif(sys.platform == "win32", reason="non-Windows only")
    def test_not_implemented_elsewhere(self, client: TestClient) -> None:
        resp = client.post("/api/v1/app/focus", headers={"Origin": "http://localhost:8000"})
        assert resp.status_code == 501
