"""Tests for configured agent names, per-agent model tracking and the shutdown route."""

# pyright: reportPrivateUsage=false

import json
import sys
from collections.abc import Iterator
from datetime import UTC, datetime
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.core.summary_service import SummaryService
from app.core.transcript_poller import PolledAgent, TranscriptPoller
from app.models.events import AgentEvent, AgentEventData, EventType

NAMES = ["Florian", "Germain"]


def _service(_unused: str = "") -> SummaryService:
    svc = SummaryService()
    svc.enabled = False
    return svc


@pytest.fixture
def names_setting() -> Iterator[Settings]:
    settings = Settings()
    with patch("app.core.summary_service.get_settings", return_value=settings):
        yield settings


class TestConfiguredAgentNames:
    def test_default_list_has_eight_names(self) -> None:
        assert len(Settings().AGENT_NAMES.split(",")) == 8

    def test_picks_from_list(self, names_setting: Settings) -> None:
        names_setting.AGENT_NAMES = " Florian , Germain ,, "
        svc = _service("")
        for _ in range(20):
            assert svc.generate_agent_name_fallback("write tests", None, "Explore") in NAMES

    def test_skips_taken_names(self, names_setting: Settings) -> None:
        names_setting.AGENT_NAMES = "Florian,Germain"
        svc = _service("")
        assert svc.generate_agent_name_fallback("x", {"Florian"}) == "Germain"

    def test_dedupes_when_all_taken(self, names_setting: Settings) -> None:
        names_setting.AGENT_NAMES = "Florian"
        svc = _service("")
        assert svc.generate_agent_name_fallback("x", {"Florian"}) == "Florian 2"

    def test_empty_list_keeps_original_behaviour(self, names_setting: Settings) -> None:
        names_setting.AGENT_NAMES = ""
        svc = _service("")
        assert svc.generate_agent_name_fallback("", None) == "The Intern"
        assert svc.generate_agent_name_fallback("write unit tests", None) not in NAMES

    @pytest.mark.asyncio
    async def test_ai_path_not_called_when_names_configured(self, names_setting: Settings) -> None:
        names_setting.AGENT_NAMES = "Florian,Germain"
        svc = _service("")
        svc.enabled = True
        svc._call_with_retry = AsyncMock(return_value="Test Pilot")  # type: ignore[method-assign]
        assert await svc.generate_agent_name("write unit tests") in NAMES
        svc._call_with_retry.assert_not_called()  # type: ignore[attr-defined]


class TestPollerModelExtraction:
    def _agent(self) -> PolledAgent:
        return PolledAgent(agent_id="a1", session_id="s1", transcript_path=Path("x.jsonl"))

    @staticmethod
    def _record(model: str | None) -> str:
        message: dict[str, object] = {"role": "assistant", "content": []}
        if model is not None:
            message["model"] = model
        return json.dumps({"type": "assistant", "message": message}) + "\n"

    def test_model_event_emitted_once(self) -> None:
        poller = TranscriptPoller(AsyncMock())
        agent = self._agent()
        events = poller._parse_content(agent, self._record("claude-opus-4-8"))
        assert len(events) == 1
        evt = events[0]
        assert isinstance(evt, AgentEvent)
        assert evt.event_type == EventType.AGENT_UPDATE
        assert evt.data.model == "claude-opus-4-8"
        assert evt.data.bubble_content is None
        assert agent.model == "claude-opus-4-8"
        # Same model again: no new event; a changed model: new event.
        assert poller._parse_content(agent, self._record("claude-opus-4-8")) == []
        assert len(poller._parse_content(agent, self._record("claude-haiku-4-5"))) == 1

    @pytest.mark.parametrize("model", ["<synthetic>", "", None])
    def test_ignores_synthetic_or_missing_model(self, model: str | None) -> None:
        poller = TranscriptPoller(AsyncMock())
        agent = self._agent()
        assert poller._parse_content(agent, self._record(model)) == []
        assert agent.model is None


class TestAgentModelState:
    def test_agent_model_serialized_camel_case(self) -> None:
        from app.models.agents import Agent, AgentState

        agent = Agent(id="a", color="#fff", number=1, state=AgentState.IDLE, model="m")
        assert agent.model_dump(by_alias=True)["model"] == "m"

    def test_model_survives_replay_transition(self) -> None:
        from app.core.state_machine import StateMachine
        from app.models.agents import Agent, AgentState

        sm = StateMachine()
        sm.agents["a1"] = Agent(id="a1", color="#fff", number=1, state=AgentState.IDLE)
        sm.transition(
            AgentEvent(
                event_type=EventType.AGENT_UPDATE,
                session_id="s1",
                timestamp=datetime.now(UTC),
                data=AgentEventData(agent_id="a1", model="claude-opus-4-8"),
            )
        )
        assert sm.agents["a1"].model == "claude-opus-4-8"

    def test_desk_grid_is_8(self) -> None:
        from app.core.state_machine import StateMachine

        assert (StateMachine.MAX_AGENTS, StateMachine.DESKS_PER_ROW) == (8, 4)
        assert StateMachine.MIN_DESK_COUNT == 8


class TestShutdownRoute:
    @pytest.fixture
    def client(self) -> TestClient:
        from app.main import app

        return TestClient(app, client=("127.0.0.1", 50000))

    def test_available(self, client: TestClient) -> None:
        resp = client.get("/api/v1/shutdown/available")
        assert resp.status_code == 200
        assert resp.json() == {
            "available": True,
            "focus": sys.platform != "win32",
            "appFocus": sys.platform == "win32",
        }

    @pytest.mark.parametrize("headers", [{}, {"Origin": "http://evil.com"}])
    def test_refused_without_good_origin(self, client: TestClient, headers: dict[str, str]) -> None:
        with patch("app.api.routes.shutdown._terminate_process") as term:
            resp = client.post("/api/v1/shutdown", headers=headers)
        assert resp.status_code == 403
        term.assert_not_called()

    def test_refused_from_non_loopback_client(self) -> None:
        from app.main import app

        c = TestClient(app, client=("testclient", 50000))
        with patch("app.api.routes.shutdown._terminate_process") as term:
            resp = c.post("/api/v1/shutdown", headers={"Origin": "http://localhost:8000"})
        assert resp.status_code == 403
        term.assert_not_called()

    def test_accepted_with_good_origin_schedules_stop(self, client: TestClient) -> None:
        with patch("app.api.routes.shutdown._shutdown_later", new=MagicMock()) as later:
            later.return_value = AsyncMock()()
            resp = client.post("/api/v1/shutdown", headers={"Origin": "http://localhost:3210"})
        assert resp.status_code == 200
        assert resp.json() == {"status": "stopping"}
        later.assert_called_once()


def test_new_agent_takes_lowest_free_desk() -> None:
    """A newcomer must not reuse a desk still held by an earlier agent."""
    from app.core.state_machine import StateMachine
    from app.models.events import AgentEventData

    sm = StateMachine()
    for i in range(3):
        agent = sm.create_agent(AgentEventData(agent_id=f"a{i}"))
        sm.agents[agent.id] = agent
    # a0 (desk 1) leaves; a1 (desk 2) and a2 (desk 3) stay.
    del sm.agents["a0"]
    newcomer = sm.create_agent(AgentEventData(agent_id="new"))
    assert newcomer.desk == 1
    sm.agents["new"] = newcomer
    assert len({a.desk for a in sm.agents.values()}) == len(sm.agents)


def test_restore_prunes_stale_agents_and_fills_model(tmp_path) -> None:  # type: ignore[no-untyped-def]
    """Replayed agents with a lost stop are pruned; live ones get their model."""
    import asyncio
    import json
    from datetime import UTC, datetime, timedelta

    from app.core.event_processor import _prune_stale_agents
    from app.core.state_machine import StateMachine
    from app.models.events import AgentEventData

    sm = StateMachine()
    for aid in ("ghost", "live", "recent"):
        agent = sm.create_agent(AgentEventData(agent_id=aid))
        sm.agents[agent.id] = agent
    sm.agents["live"].native_id = "nat-live"

    transcript = tmp_path / "agent-nat-live.jsonl"
    transcript.write_text(
        json.dumps({"type": "assistant", "message": {"model": "claude-haiku-4-5-20251001"}}) + "\n",
        encoding="utf-8",
    )
    now = datetime.now(UTC)
    last_seen = {
        "ghost": now - timedelta(hours=1),
        "recent": now - timedelta(seconds=5),
    }  # within zombie window

    asyncio.run(_prune_stale_agents(sm, "s1", last_seen, {"nat-live": str(transcript)}))

    assert "ghost" not in sm.agents
    assert "recent" in sm.agents
    assert sm.agents["live"].model == "claude-haiku-4-5-20251001"


def test_restore_prunes_agents_that_already_stopped() -> None:
    """An agent in the hand-in queue after replay has finished: prune it."""
    import asyncio
    from datetime import UTC, datetime

    from app.core.event_processor import _prune_stale_agents
    from app.core.state_machine import StateMachine
    from app.models.events import AgentEventData

    sm = StateMachine()
    agent = sm.create_agent(AgentEventData(agent_id="done"))
    sm.agents["done"] = agent
    sm.handin_queue.append("done")

    asyncio.run(_prune_stale_agents(sm, "s1", {"done": datetime.now(UTC)}, {}))

    assert "done" not in sm.agents
