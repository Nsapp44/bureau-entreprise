"""Tests for the « Claude agité » flow: notification -> NEEDS_ATTENTION."""

from unittest.mock import AsyncMock, patch

import pytest

from app.core.event_processor import EventProcessor
from app.core.room_orchestrator import _BOSS_TO_AGENT, _BOSS_TO_BUCKET
from app.models.agents import AgentState, BossState
from app.models.events import EventAdapter, EventType


async def _send(ep: EventProcessor, event_type: EventType, data: dict) -> None:
    evt = EventAdapter.validate_python(
        {"event_type": event_type, "session_id": "s-attention", "data": data}
    )
    with patch.object(ep, "_persist_event", new=AsyncMock()):
        await ep.process_event(evt)


@pytest.mark.asyncio
async def test_attention_notification_agitates_boss_until_next_prompt() -> None:
    ep = EventProcessor()
    await _send(
        ep,
        EventType.NOTIFICATION,
        {"notification_type": "attention", "message": "Maquette à valider"},
    )
    sm = ep.sessions["s-attention"]
    assert sm.boss_state == BossState.NEEDS_ATTENTION

    await _send(ep, EventType.USER_PROMPT_SUBMIT, {"prompt": "ok", "project_name": "app"})
    assert sm.boss_state != BossState.NEEDS_ATTENTION


def test_needs_attention_mapping() -> None:
    assert _BOSS_TO_AGENT[BossState.NEEDS_ATTENTION] == AgentState.WAITING_PERMISSION
    assert _BOSS_TO_BUCKET[BossState.NEEDS_ATTENTION] == "needs_you"


@pytest.mark.asyncio
async def test_ask_user_question_sets_question_reason_until_post_tool_use() -> None:
    ep = EventProcessor()
    await _send(ep, EventType.PRE_TOOL_USE, {"tool_name": "AskUserQuestion"})
    sm = ep.sessions["s-attention"]
    assert sm.boss_state == BossState.NEEDS_ATTENTION
    assert sm.attention_reason == "question"
    assert sm.boss_bubble is not None
    assert sm.boss_bubble.text == "Question pour toi"

    await _send(ep, EventType.POST_TOOL_USE, {"tool_name": "AskUserQuestion"})
    assert sm.attention_reason is None
    assert sm.boss_state == BossState.IDLE


@pytest.mark.asyncio
async def test_ask_user_question_from_subagent_does_not_flag_boss() -> None:
    ep = EventProcessor()
    await _send(ep, EventType.PRE_TOOL_USE, {"tool_name": "Read"})
    sm = ep.sessions["s-attention"]
    assert sm.boss_state == BossState.WORKING
    assert sm.attention_reason is None

    await _send(ep, EventType.PRE_TOOL_USE, {"tool_name": "AskUserQuestion", "agent_id": "sub-1"})
    assert sm.boss_state == BossState.WORKING
    assert sm.attention_reason is None


@pytest.mark.asyncio
async def test_other_tool_use_clears_attention_reason() -> None:
    ep = EventProcessor()
    await _send(ep, EventType.PRE_TOOL_USE, {"tool_name": "AskUserQuestion"})
    sm = ep.sessions["s-attention"]
    assert sm.attention_reason == "question"

    await _send(ep, EventType.PRE_TOOL_USE, {"tool_name": "Read"})
    assert sm.boss_state == BossState.WORKING
    assert sm.attention_reason is None


@pytest.mark.asyncio
async def test_main_permission_request_sets_permission_reason() -> None:
    ep = EventProcessor()
    await _send(ep, EventType.PERMISSION_REQUEST, {"tool_name": "Bash"})
    sm = ep.sessions["s-attention"]
    assert sm.boss_state == BossState.WAITING_PERMISSION
    assert sm.attention_reason == "permission"


@pytest.mark.asyncio
async def test_notification_type_becomes_attention_reason() -> None:
    ep = EventProcessor()
    await _send(ep, EventType.NOTIFICATION, {"notification_type": "elicitation_dialog"})
    sm = ep.sessions["s-attention"]
    assert sm.boss_state == BossState.NEEDS_ATTENTION
    assert sm.attention_reason == "elicitation_dialog"


@pytest.mark.asyncio
async def test_unrelated_notification_leaves_attention_reason_untouched() -> None:
    ep = EventProcessor()
    await _send(ep, EventType.NOTIFICATION, {"notification_type": "auth_success"})
    sm = ep.sessions["s-attention"]
    assert sm.attention_reason is None
    assert sm.boss_state != BossState.NEEDS_ATTENTION


@pytest.mark.asyncio
async def test_user_prompt_submit_clears_attention_reason() -> None:
    ep = EventProcessor()
    await _send(ep, EventType.PERMISSION_REQUEST, {"tool_name": "Bash"})
    sm = ep.sessions["s-attention"]
    assert sm.attention_reason == "permission"

    await _send(ep, EventType.USER_PROMPT_SUBMIT, {"prompt": "go", "project_name": "app"})
    assert sm.attention_reason is None
