"""Active conversations for the main desk board ("bureau principal").

One desk = one Claude conversation currently open.  The list is derived from
the live session registry (``StateMachine`` per hook session) enriched with what
the Claude desktop app knows (title, folder, model, effort) and with the token
usage computed from the transcripts.

Reading the app files and the transcripts is blocking I/O, so it is done once
per ``_CACHE_TTL_SECONDS`` by :func:`gather_conversation_inputs` (outside any
lock).  :func:`build_conversations` is then pure, synchronous and cheap, so it
can run under the sessions lock.
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any

from app.core.providers import provider_for_model
from app.core.room_orchestrator import _overview_bucket  # pyright: ignore[reportPrivateUsage]
from app.core.state_machine import OfficePhase
from app.models.agents import AgentState, BossState
from app.models.conversations import ActiveConversation, ConversationStatus
from app.services.app_sessions_service import AppSession, load_app_sessions
from app.services.usage_service import compute_session_usage

if TYPE_CHECKING:
    from app.core.state_machine import StateMachine

logger = logging.getLogger(__name__)

__all__ = [
    "IDLE_RELEASE_SECONDS",
    "ConversationInputs",
    "build_conversations",
    "gather_conversation_inputs",
    "reset_conversation_inputs_cache",
]

# A conversation with no activity for this long is released (its desk is freed),
# whatever its status.
IDLE_RELEASE_SECONDS = 3600

# How long the app files / transcript usage are reused between two builds.
_CACHE_TTL_SECONDS = 10.0


@dataclass(frozen=True)
class ConversationInputs:
    """Blocking-I/O data needed by :func:`build_conversations`."""

    app_sessions: dict[str, AppSession]
    usage: dict[str, dict[str, Any]]


# Max time the first broadcast waits for the (slow when cold) transcript usage.
_USAGE_TIMEOUT_SECONDS = 1.5

_cache: tuple[float, ConversationInputs] | None = None
# Shared usage computation: concurrent callers join the same task.
_usage_task: asyncio.Task[dict[str, dict[str, Any]]] | None = None
_usage_started: float = 0.0
_last_usage: dict[str, dict[str, Any]] = {}
_usage_degraded = False


def reset_conversation_inputs_cache() -> None:
    """Forget the cached inputs (used by tests)."""
    global _cache, _usage_task, _last_usage, _usage_degraded
    _cache = None
    _usage_task = None
    _last_usage = {}
    _usage_degraded = False


async def _compute_usage() -> dict[str, dict[str, Any]]:
    """Compute the usage off the loop; never raises (falls back to the last value)."""
    global _cache, _last_usage, _usage_degraded
    try:
        usage = await asyncio.to_thread(compute_session_usage)
    except Exception:
        logger.exception("Could not compute the per-session token usage")
        usage = _last_usage
    _last_usage = usage
    if _usage_degraded:
        # A build went out without tokens: let the next one pick this result up.
        _usage_degraded = False
        _cache = None
    return usage


def _usage_future() -> asyncio.Task[dict[str, dict[str, Any]]]:
    """The running (or still fresh) usage task, started if needed."""
    global _usage_task, _usage_started
    now = time.monotonic()
    task = _usage_task
    if task is None or (task.done() and now - _usage_started >= _CACHE_TTL_SECONDS):
        task = asyncio.ensure_future(_compute_usage())
        _usage_task = task
        _usage_started = now
    return task


async def gather_conversation_inputs() -> ConversationInputs:
    """Load app sessions and token usage off the event loop, cached for 10 s.

    The usage waits at most ``_USAGE_TIMEOUT_SECONDS``; past it the inputs have
    an empty usage and the (shared) computation finishes in the background.

    Never raises: a failing source is logged and replaced by an empty mapping,
    so the board keeps working (without titles / token counts) instead of
    breaking the whole overview broadcast.
    """
    global _cache
    cached = _cache
    if cached is not None and time.monotonic() - cached[0] < _CACHE_TTL_SECONDS:
        return cached[1]

    app_sessions: dict[str, AppSession] = {}
    usage: dict[str, dict[str, Any]] = {}
    try:
        app_sessions = await asyncio.to_thread(load_app_sessions)
    except Exception:
        logger.exception("Could not read the Claude app sessions")
    global _usage_degraded
    try:
        usage = await asyncio.wait_for(
            asyncio.shield(_usage_future()), timeout=_USAGE_TIMEOUT_SECONDS
        )
    except TimeoutError:
        # Cold transcripts: send the board without tokens now, the computation
        # keeps running and the next build uses its result.
        logger.warning("Token usage still computing, sending conversations without it")
        usage = {}
        _usage_degraded = True

    inputs = ConversationInputs(app_sessions=app_sessions, usage=usage)
    _cache = (time.monotonic(), inputs)
    return inputs


# ---------------------------------------------------------------------------
# Pure helpers
# ---------------------------------------------------------------------------


def _text(value: object) -> str | None:
    """A non-empty string, else ``None``."""
    return value if isinstance(value, str) and value else None


def _count(value: object) -> int:
    """A non-negative integer token count, else 0."""
    if isinstance(value, bool) or not isinstance(value, int | float):
        return 0
    return max(int(value), 0)


def _from_epoch(value: object) -> datetime | None:
    """Seconds since the epoch -> aware UTC datetime, else ``None``."""
    if isinstance(value, bool) or not isinstance(value, int | float):
        return None
    try:
        return datetime.fromtimestamp(value, UTC)
    except (OverflowError, OSError, ValueError):
        return None


def _aware_utc(ts: datetime) -> datetime:
    return ts if ts.tzinfo is not None else ts.replace(tzinfo=UTC)


def _needs_reason(sm: StateMachine) -> str | None:
    """Why the conversation is blocked on the user, or ``None`` when it is not.

    ``idle_prompt`` (Claude simply waiting for the next prompt) is not a need.
    """
    attention = getattr(sm, "attention_reason", None)
    if sm.boss_state == BossState.WAITING_PERMISSION:
        return attention or "permission"
    if sm.boss_state == BossState.NEEDS_ATTENTION and attention != "idle_prompt":
        return attention or "attention"
    if any(agent.state == AgentState.WAITING_PERMISSION for agent in sm.agents.values()):
        return "permission"
    return None


def _build_entry(
    session_id: str,
    sm: StateMachine,
    inputs: ConversationInputs,
    now: datetime,
) -> ActiveConversation | None:
    if sm.phase == OfficePhase.ENDED:
        return None

    app: Mapping[str, object] = inputs.app_sessions.get(session_id) or {}
    # Only conversations that exist in the Claude desktop app (terminal sessions and
    # ones deleted from the app have no record there); archived ones are hidden too.
    if not app.get("app_session_id") or app.get("archived") is True:
        return None

    # ``last_event_at`` is an aware UTC datetime refreshed on every event.
    last_activity = _aware_utc(sm.last_event_at) if sm.last_event_at else None
    if last_activity is None:
        last_activity = _from_epoch(app.get("last_activity"))
    if last_activity is not None and (now - last_activity).total_seconds() > IDLE_RELEASE_SECONDS:
        return None

    needs_reason = _needs_reason(sm)
    status: ConversationStatus
    if needs_reason is not None:
        status = "needs_you"
    elif _overview_bucket(sm) == "working":
        status = "working"
    else:
        status = "idle"

    usage = inputs.usage.get(session_id) or {}
    model = _text(app.get("model")) or _text(sm.token_tracker.model) or _text(usage.get("model"))

    return ActiveConversation(
        session_id=session_id,
        app_session_id=_text(app.get("app_session_id")),
        title=_text(app.get("title")),
        folder=_text(app.get("folder")),
        client=sm.client,
        provider=provider_for_model(model) if model else None,
        model=model,
        effort=_text(app.get("effort")),
        status=status,
        needs_reason=needs_reason,
        current_task=sm.boss_current_task,
        started_at=_from_epoch(app.get("created")),
        last_activity_at=last_activity,
        tokens_today=_count(usage.get("today")),
        tokens_total=_count(usage.get("total")),
    )


def build_conversations(
    sessions: dict[str, StateMachine],
    inputs: ConversationInputs,
    now: datetime | None = None,
) -> list[ActiveConversation]:
    """Active conversations, oldest first.

    Pure and synchronous: call it under the sessions lock.  Ended, archived and
    inactive-for-over-an-hour conversations are left out.
    """
    current = _aware_utc(now) if now is not None else datetime.now(UTC)
    entries: list[ActiveConversation] = []
    for session_id, sm in sessions.items():
        entry = _build_entry(session_id, sm, inputs, current)
        if entry is not None:
            entries.append(entry)
    entries.sort(
        key=lambda e: (
            e.started_at is None,
            e.started_at or datetime.min.replace(tzinfo=UTC),
            e.session_id,
        )
    )
    return entries
