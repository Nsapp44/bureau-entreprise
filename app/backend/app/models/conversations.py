"""Active-conversation models for the main desk board ("bureau principal").

One desk = one Claude conversation currently open.  The list is derived from the
live session registry (hooks) enriched with what the Claude desktop app knows
(title, folder, model, effort) and with the token usage computed from transcripts.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

__all__ = [
    "ActiveConversation",
    "ConversationStatus",
]

# working   = the conversation is busy (turn running, subagents alive)
# needs_you = blocked on the user (permission, question, attention, ...)
# idle      = waiting for the next prompt (finished turn)
ConversationStatus = Literal["working", "needs_you", "idle"]


class ActiveConversation(BaseModel):
    """A single active conversation shown as one desk on the main board."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    session_id: str
    app_session_id: str | None = None  # "local_..." id of the Claude desktop app
    title: str | None = None
    folder: str | None = None
    client: str | None = None
    provider: str | None = None
    model: str | None = None
    effort: str | None = None
    status: ConversationStatus
    needs_reason: str | None = None
    current_task: str | None = None
    started_at: datetime | None = None
    last_activity_at: datetime | None = None
    tokens_today: int = 0
    tokens_total: int = 0
