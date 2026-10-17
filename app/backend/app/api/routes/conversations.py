"""Active conversations route (main desk board: one desk = one conversation)."""

from fastapi import APIRouter

from app.core.event_processor import get_event_processor
from app.models.conversations import ActiveConversation

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.get("")
async def list_conversations() -> list[ActiveConversation]:
    """Conversations currently open, oldest first (camelCase fields)."""
    return await get_event_processor().build_conversations_snapshot()
