"""Token usage routes (read from local Claude Code transcripts)."""

import asyncio
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services import usage_service

router = APIRouter(prefix="/usage", tags=["usage"])


@router.get("/today")
async def usage_today() -> dict[str, Any]:
    """Token totals for today (local time), overall and per model."""
    return await asyncio.to_thread(usage_service.compute_today)


@router.get("/sessions")
async def usage_sessions() -> dict[str, Any]:
    """Token totals per session, including sub-agent transcripts."""
    return await asyncio.to_thread(usage_service.compute_sessions)


@router.get("/current")
async def usage_current() -> dict[str, Any]:
    """Context size (tokens) of the most recently active session, with its level."""
    return await asyncio.to_thread(usage_service.current_context)


@router.get("/quota")
async def usage_quota() -> list[dict[str, Any]]:
    """Latest official 5 h / 7 d meters per account (percent used) and when they were read."""
    return await asyncio.to_thread(usage_service.read_quota)


@router.get("/limits")
async def usage_limits() -> dict[str, Any]:
    """5-hour / 7-day subscription usage: last real reading plus tokens used since."""
    return await asyncio.to_thread(usage_service.estimate_rate_limits)


class ManualReading(BaseModel):
    """Real meter values read by hand on claude.ai (percent of the plan used)."""

    five_hour_pct: float = Field(ge=0, le=100)
    seven_day_pct: float | None = Field(default=None, ge=0, le=100)


@router.post("/limits")
async def usage_limits_set(reading: ManualReading) -> dict[str, Any]:
    """Re-anchor the estimate on a real reading typed by the user."""
    return await asyncio.to_thread(
        usage_service.set_manual_reading, reading.five_hour_pct, reading.seven_day_pct
    )
