"""Tests for the active-conversations board: service, overview payload, routes."""

import asyncio
import contextlib
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from typing import Any, cast
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.core.state_machine import OfficePhase, StateMachine
from app.models.agents import Agent, AgentState, BossState
from app.services import conversations_service
from app.services.app_sessions_service import AppSession
from app.services.conversations_service import (
    IDLE_RELEASE_SECONDS,
    ConversationInputs,
    build_conversations,
    gather_conversation_inputs,
    reset_conversation_inputs_cache,
)

NOW = datetime(2026, 10, 11, 12, 0, tzinfo=UTC)
ORIGIN = {"Origin": "http://localhost:8000"}
LOAD_APP = "app.services.conversations_service.load_app_sessions"
LOAD_USAGE = "app.services.conversations_service.compute_session_usage"


def _sm(
    boss: BossState = BossState.IDLE,
    *,
    last: datetime | None = NOW - timedelta(seconds=30),
    turn_active: bool = False,
    attention: str | None = None,
    phase: OfficePhase = OfficePhase.IDLE,
) -> StateMachine:
    sm = StateMachine()
    sm.boss_state = boss
    sm.turn_active = turn_active
    sm.phase = phase
    sm.attention_reason = attention
    if last is not None:
        sm.last_event_at = last
    return sm


def _inputs(
    apps: dict[str, dict[str, Any]] | None = None,
    usage: dict[str, dict[str, Any]] | None = None,
) -> ConversationInputs:
    return ConversationInputs(
        app_sessions=cast(dict[str, AppSession], _AppRecords(apps or {})),
        usage=usage or {},
    )


class _AppRecords(dict[str, Any]):
    """App records: every session has one (with an app id) unless it is listed without."""

    def __init__(self, apps: dict[str, dict[str, Any]]) -> None:
        super().__init__({k: {"app_session_id": f"local_{k}", **v} for k, v in apps.items()})

    def get(self, key: str, default: Any = None) -> Any:
        return super().get(key, {"app_session_id": f"local_{key}"})


def _one(sm: StateMachine, inputs: ConversationInputs | None = None) -> Any:
    entries = build_conversations({"s1": sm}, inputs or _inputs(), now=NOW)
    assert len(entries) == 1
    return entries[0]


def test_session_without_app_record_is_hidden() -> None:
    """Terminal sessions (no Claude app record) never appear on the board."""
    bare = ConversationInputs(app_sessions={}, usage={})
    assert build_conversations({"s1": _sm()}, bare, now=NOW) == []


class TestStatus:
    def test_working(self) -> None:
        entry = _one(_sm(BossState.WORKING, turn_active=True))
        assert entry.status == "working"
        assert entry.needs_reason is None

    def test_idle_mid_turn_is_working(self) -> None:
        assert _one(_sm(BossState.IDLE, turn_active=True)).status == "working"

    @pytest.mark.parametrize(
        ("boss", "attention", "reason"),
        [
            (BossState.WAITING_PERMISSION, None, "permission"),
            (BossState.WAITING_PERMISSION, "permission", "permission"),
            (BossState.WAITING_PERMISSION, "question", "question"),
            (BossState.NEEDS_ATTENTION, "elicitation_dialog", "elicitation_dialog"),
            (BossState.NEEDS_ATTENTION, "attention", "attention"),
            (BossState.NEEDS_ATTENTION, None, "attention"),
        ],
    )
    def test_needs_you(self, boss: BossState, attention: str | None, reason: str) -> None:
        entry = _one(_sm(boss, attention=attention))
        assert entry.status == "needs_you"
        assert entry.needs_reason == reason

    def test_stale_attention_reason_ignored_when_boss_is_not_waiting(self) -> None:
        entry = _one(_sm(BossState.WORKING, turn_active=True, attention="question"))
        assert entry.status == "working"
        assert entry.needs_reason is None

    def test_waiting_agent_needs_you(self) -> None:
        sm = _sm(BossState.WORKING, turn_active=True)
        sm.agents = {
            "a": Agent(id="a", color="#fff", number=0, state=AgentState.WAITING_PERMISSION)
        }
        entry = _one(sm)
        assert entry.status == "needs_you"
        assert entry.needs_reason == "permission"

    def test_idle_prompt_is_idle(self) -> None:
        entry = _one(_sm(BossState.NEEDS_ATTENTION, attention="idle_prompt"))
        assert entry.status == "idle"
        assert entry.needs_reason is None

    def test_idle_prompt_with_waiting_agent_still_needs_you(self) -> None:
        sm = _sm(BossState.NEEDS_ATTENTION, attention="idle_prompt")
        sm.agents = {
            "a": Agent(id="a", color="#fff", number=0, state=AgentState.WAITING_PERMISSION)
        }
        entry = _one(sm)
        assert entry.status == "needs_you"
        assert entry.needs_reason == "permission"

    def test_finished_turn_is_idle(self) -> None:
        assert _one(_sm(BossState.IDLE)).status == "idle"


class TestExclusion:
    def test_recent_idle_is_kept(self) -> None:
        assert _one(_sm(BossState.IDLE, last=NOW - timedelta(minutes=59))).status == "idle"

    def test_release_boundary(self) -> None:
        inside = _sm(last=NOW - timedelta(seconds=IDLE_RELEASE_SECONDS))
        outside = _sm(last=NOW - timedelta(seconds=IDLE_RELEASE_SECONDS + 1))
        got = build_conversations({"in": inside, "out": outside}, _inputs(), now=NOW)
        assert [e.session_id for e in got] == ["in"]

    @pytest.mark.parametrize(
        "boss", [BossState.IDLE, BossState.WORKING, BossState.WAITING_PERMISSION]
    )
    def test_inactive_over_an_hour_excluded_whatever_the_status(self, boss: BossState) -> None:
        sm = _sm(boss, last=NOW - timedelta(hours=2), turn_active=True)
        assert build_conversations({"s1": sm}, _inputs(), now=NOW) == []

    def test_ended_excluded(self) -> None:
        sm = _sm(BossState.WORKING, phase=OfficePhase.ENDED)
        assert build_conversations({"s1": sm}, _inputs(), now=NOW) == []

    def test_archived_excluded(self) -> None:
        inputs = _inputs({"s1": {"archived": True}, "s2": {"archived": False}})
        got = build_conversations({"s1": _sm(), "s2": _sm()}, inputs, now=NOW)
        assert [e.session_id for e in got] == ["s2"]

    def test_naive_datetimes_are_read_as_utc(self) -> None:
        sm = _sm(last=(NOW - timedelta(minutes=5)).replace(tzinfo=None))
        got = build_conversations({"s1": sm}, _inputs(), now=NOW.replace(tzinfo=None))
        assert len(got) == 1
        assert got[0].last_activity_at == NOW - timedelta(minutes=5)

    def test_now_defaults_to_the_clock(self) -> None:
        fresh = StateMachine()  # last_event_at defaults to "now"
        assert len(build_conversations({"s1": fresh}, _inputs())) == 1


class TestFields:
    def test_app_fields(self) -> None:
        created = NOW - timedelta(hours=3)
        sm = _sm(BossState.WORKING, turn_active=True, last=NOW - timedelta(seconds=5))
        sm.boss_current_task = "refactor auth"
        sm.client = "claude-code"
        inputs = _inputs(
            {
                "s1": {
                    "title": "Refonte",
                    "folder": "backend",
                    "app_session_id": "local_abc-123",
                    "model": "claude-opus-4-5",
                    "effort": "high",
                    "created": created.timestamp(),
                }
            },
            {"s1": {"total": 1234, "today": 56, "model": "claude-haiku-4-5"}},
        )
        entry = _one(sm, inputs)
        assert entry.session_id == "s1"
        assert entry.title == "Refonte"
        assert entry.folder == "backend"
        assert entry.app_session_id == "local_abc-123"
        assert entry.effort == "high"
        assert entry.client == "claude-code"
        assert entry.current_task == "refactor auth"
        assert entry.started_at == created
        assert entry.last_activity_at == NOW - timedelta(seconds=5)
        assert (entry.tokens_today, entry.tokens_total) == (56, 1234)
        assert (entry.model, entry.provider) == ("claude-opus-4-5", "anthropic")

    def test_without_app_or_usage(self) -> None:
        entry = _one(_sm())
        assert entry.title is None and entry.folder is None
        assert entry.started_at is None
        assert (entry.tokens_today, entry.tokens_total) == (0, 0)
        assert entry.model is None and entry.provider is None

    def test_model_falls_back_to_tracker_then_usage(self) -> None:
        sm = _sm()
        sm.token_tracker.model = "gpt-5"
        entry = _one(sm, _inputs({"s1": {}}, {"s1": {"model": "claude-haiku-4-5"}}))
        assert (entry.model, entry.provider) == ("gpt-5", "openai")

        entry = _one(_sm(), _inputs({"s1": {}}, {"s1": {"model": "deepseek-chat"}}))
        assert (entry.model, entry.provider) == ("deepseek-chat", "deepseek")

    def test_unknown_model_gets_unknown_provider(self) -> None:
        entry = _one(_sm(), _inputs({"s1": {"model": "mystery-model"}}))
        assert entry.provider == "unknown"


class TestOrdering:
    def test_started_at_ascending_none_last_then_session_id(self) -> None:
        def ts(hours: int) -> float:
            return (NOW - timedelta(hours=hours)).timestamp()

        inputs = _inputs({"new": {"created": ts(1)}, "old": {"created": ts(5)}})
        sessions = {
            "zz-none": _sm(),
            "new": _sm(),
            "aa-none": _sm(),
            "old": _sm(),
        }
        got = build_conversations(sessions, inputs, now=NOW)
        assert [e.session_id for e in got] == ["old", "new", "aa-none", "zz-none"]

    def test_empty(self) -> None:
        assert build_conversations({}, _inputs(), now=NOW) == []


class TestGatherInputs:
    @pytest.mark.asyncio
    async def test_loads_and_caches(self) -> None:
        apps: dict[str, Any] = {"s1": {"title": "T"}}
        usage: dict[str, Any] = {"s1": {"total": 1, "today": 1, "model": None}}
        with (
            patch(LOAD_APP, return_value=apps) as load,
            patch(LOAD_USAGE, return_value=usage) as use,
        ):
            first = await gather_conversation_inputs()
            second = await gather_conversation_inputs()
            assert first is second
            assert first.app_sessions == apps and first.usage == usage
            assert load.call_count == 1 and use.call_count == 1

            reset_conversation_inputs_cache()
            await gather_conversation_inputs()
            assert load.call_count == 2 and use.call_count == 2

    @pytest.mark.asyncio
    async def test_cache_expires_after_ttl(self) -> None:
        with (
            patch(LOAD_APP, return_value={}) as load,
            patch(LOAD_USAGE, return_value={}),
            patch.object(conversations_service, "time") as fake_time,
        ):
            fake_time.monotonic.return_value = 1000.0
            await gather_conversation_inputs()
            fake_time.monotonic.return_value = 1009.0
            await gather_conversation_inputs()
            assert load.call_count == 1
            fake_time.monotonic.return_value = 1011.0
            await gather_conversation_inputs()
            assert load.call_count == 2

    @pytest.mark.asyncio
    async def test_errors_are_logged_and_swallowed(self) -> None:
        with (
            patch(LOAD_APP, side_effect=RuntimeError("boom")),
            patch(LOAD_USAGE, side_effect=OSError("disk")),
        ):
            got = await gather_conversation_inputs()
        assert got == ConversationInputs({}, {})

    @pytest.mark.asyncio
    async def test_one_failing_source_keeps_the_other(self) -> None:
        apps: dict[str, Any] = {"s1": {"title": "T"}}
        with patch(LOAD_APP, return_value=apps), patch(LOAD_USAGE, side_effect=OSError("disk")):
            got = await gather_conversation_inputs()
        assert got.app_sessions == apps and got.usage == {}


class TestOverviewPayload:
    @pytest.mark.asyncio
    @pytest.mark.parametrize("with_lock", [True, False])
    async def test_state_update_contains_conversations(self, with_lock: bool) -> None:
        from starlette.websockets import WebSocketState

        from app.api import websocket as ws_module
        from app.core.broadcast_service import broadcast_overview_state

        ws = AsyncMock()
        ws.client_state = WebSocketState.CONNECTED
        await ws_module.manager.connect_overview(ws, max_connections=16)
        try:
            sm = StateMachine()
            sm.boss_state = BossState.WAITING_PERMISSION
            sm.attention_reason = "question"
            apps: dict[str, Any] = {"sess-1": {"title": "Ma conv", "app_session_id": "local_x1"}}
            with patch(LOAD_APP, return_value=apps), patch(LOAD_USAGE, return_value={}):
                await broadcast_overview_state(
                    {"sess-1": sm}, asyncio.Lock() if with_lock else None
                )

            ws.send_json.assert_called_once()
            state = ws.send_json.call_args[0][0]["state"]
            assert state["entries"][0]["sessionId"] == "sess-1"
            conv = state["conversations"]
            assert len(conv) == 1
            assert conv[0]["sessionId"] == "sess-1"
            assert conv[0]["appSessionId"] == "local_x1"
            assert conv[0]["title"] == "Ma conv"
            assert conv[0]["status"] == "needs_you"
            assert conv[0]["needsReason"] == "question"
        finally:
            await ws_module.manager.disconnect_overview(ws)

    @pytest.mark.asyncio
    async def test_overview_snapshot_and_conversations_snapshot(self) -> None:
        from app.core.event_processor import get_event_processor

        proc = get_event_processor()
        sm = _sm(BossState.WORKING, turn_active=True, last=datetime.now(UTC))
        with (
            patch.dict(proc.sessions, {"sess-9": sm}, clear=True),
            patch(LOAD_APP, return_value={"sess-9": {"app_session_id": "local_9"}}),
            patch(LOAD_USAGE, return_value={}),
        ):
            overview = await proc.build_overview_snapshot()
            reset_conversation_inputs_cache()
            snapshot = await proc.build_conversations_snapshot()
        assert [c.session_id for c in overview.conversations] == ["sess-9"]
        assert [c.session_id for c in snapshot] == ["sess-9"]
        assert snapshot[0].status == "working"

    @pytest.mark.asyncio
    async def test_remove_session_and_refresh_schedule_a_broadcast(self) -> None:
        from app.core.event_processor import get_event_processor

        proc = get_event_processor()
        with (
            patch.dict(proc.sessions, {"sess-9": _sm()}, clear=True),
            patch.object(proc, "_schedule_overview_broadcast") as schedule,
        ):
            await proc.remove_session("sess-9")
            assert "sess-9" not in proc.sessions
            assert schedule.call_count == 1
            proc.refresh_overview()
            assert schedule.call_count == 2


class TestHeartbeatLoop:
    @pytest.mark.asyncio
    async def test_refreshes_periodically_and_survives_errors(self) -> None:
        from app.main import _conversations_heartbeat_loop  # pyright: ignore[reportPrivateUsage]

        calls: list[int] = []

        def refresh() -> None:
            calls.append(1)
            if len(calls) == 1:
                raise RuntimeError("boom")

        proc = MagicMock()
        proc.refresh_overview.side_effect = refresh
        task = asyncio.create_task(_conversations_heartbeat_loop(proc, 0.005))
        await asyncio.sleep(0.15)
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task
        assert len(calls) >= 2  # kept going after the first tick raised


class TestRoutes:
    @pytest.fixture
    def client(self) -> TestClient:
        from app.main import app

        return TestClient(app, client=("127.0.0.1", 50000))

    def test_get_returns_camel_case(self, client: TestClient) -> None:
        from app.core.event_processor import get_event_processor

        sm = _sm(BossState.WORKING, turn_active=True, last=datetime.now(UTC))
        apps: dict[str, Any] = {
            "sess-1": {"title": "Ma conv", "app_session_id": "local_x1", "created": 1_700_000_000}
        }
        usage: dict[str, Any] = {"sess-1": {"total": 10, "today": 4, "model": "claude-opus-4-5"}}
        with (
            patch.dict(get_event_processor().sessions, {"sess-1": sm}, clear=True),
            patch(LOAD_APP, return_value=apps),
            patch(LOAD_USAGE, return_value=usage),
        ):
            resp = client.get("/api/v1/conversations")
        assert resp.status_code == 200
        body = resp.json()
        assert len(body) == 1
        item = body[0]
        assert item["sessionId"] == "sess-1"
        assert item["appSessionId"] == "local_x1"
        assert item["status"] == "working"
        assert item["tokensToday"] == 4 and item["tokensTotal"] == 10
        assert item["provider"] == "anthropic" and item["model"] == "claude-opus-4-5"
        assert item["startedAt"] is not None and item["lastActivityAt"] is not None
        assert "session_id" not in item

    def _post(
        self,
        client: TestClient,
        apps: dict[str, Any],
        *,
        session_id: str = "sess-1",
        headers: dict[str, str] | None = None,
        platform: str = "win32",
        startfile_error: OSError | None = None,
    ) -> tuple[Any, MagicMock]:
        with (
            patch("app.api.routes.shutdown.load_app_sessions", return_value=apps),
            patch("app.api.routes.shutdown.sys", SimpleNamespace(platform=platform)),
            patch("app.api.routes.shutdown.os.startfile", create=True) as startfile,
        ):
            startfile.side_effect = startfile_error
            resp = client.post(
                "/api/v1/app/open-conversation",
                json={"sessionId": session_id},
                headers=ORIGIN if headers is None else headers,
            )
        return resp, startfile

    @pytest.mark.parametrize("headers", [{}, {"Origin": "http://evil.com"}])
    def test_post_refused_without_good_origin(
        self, client: TestClient, headers: dict[str, str]
    ) -> None:
        apps = {"sess-1": {"app_session_id": "local_ok"}}
        resp, startfile = self._post(client, apps, headers=headers)
        assert resp.status_code == 403
        startfile.assert_not_called()

    def test_post_not_implemented_off_windows(self, client: TestClient) -> None:
        apps = {"sess-1": {"app_session_id": "local_ok"}}
        resp, startfile = self._post(client, apps, platform="linux")
        assert resp.status_code == 501
        startfile.assert_not_called()

    @pytest.mark.parametrize(
        ("apps", "session_id"),
        [
            ({}, "sess-1"),  # unknown conversation
            ({"sess-1": {"app_session_id": None}}, "sess-1"),  # no app id
            ({"sess-1": {}}, "sess-1"),  # no app id key at all
            ({"sess-1": {"app_session_id": "evil://x?y"}}, "sess-1"),  # invalid app id
            ({"sess-1": {"app_session_id": "local_a&b"}}, "sess-1"),
            ({"sess-1": {"app_session_id": "local_" + "a" * 65}}, "sess-1"),
            ({"sess-1": {"app_session_id": "local_ok"}}, "other"),
        ],
    )
    def test_post_404(self, client: TestClient, apps: dict[str, Any], session_id: str) -> None:
        resp, startfile = self._post(client, apps, session_id=session_id)
        assert resp.status_code == 404
        startfile.assert_not_called()

    def test_post_409_when_archived(self, client: TestClient) -> None:
        apps = {"sess-1": {"app_session_id": "local_ok", "archived": True}}
        resp, startfile = self._post(client, apps)
        assert resp.status_code == 409
        startfile.assert_not_called()

    def test_post_rejects_oversized_session_id(self, client: TestClient) -> None:
        resp, startfile = self._post(client, {}, session_id="x" * 129)
        assert resp.status_code == 422
        startfile.assert_not_called()

    def test_post_opens_the_conversation(self, client: TestClient) -> None:
        apps = {"sess-1": {"app_session_id": "local_ab12-CD", "archived": False}}
        resp, startfile = self._post(client, apps)
        assert resp.status_code == 200
        assert resp.json() == {"opened": True, "appSessionId": "local_ab12-CD"}
        startfile.assert_called_once_with("claude://code/continue?session=local_ab12-CD")

    def test_post_500_when_the_launch_fails(self, client: TestClient) -> None:
        apps = {"sess-1": {"app_session_id": "local_ok"}}
        resp, _ = self._post(client, apps, startfile_error=OSError("no handler"))
        assert resp.status_code == 500
        assert "no handler" not in resp.text
        assert resp.json()["detail"].startswith("Impossible d'ouvrir")
