"""API route to stop the backend process (local "stop point" button)."""

import asyncio
import logging
import os
import re
import shutil
import signal
import sys
import time
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from app.services.app_sessions_service import _default_root as _default_sessions_root
from app.services.app_sessions_service import load_app_sessions

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/shutdown", tags=["shutdown"])

_ALLOWED_CLIENT_HOSTS = frozenset({"127.0.0.1", "::1"})
_ALLOWED_ORIGINS = frozenset(
    {
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:3210",
        "http://127.0.0.1:3210",
    }
)

_SHUTDOWN_DELAY_SECONDS = 0.5
_FORCE_EXIT_DELAY_SECONDS = 5.0

# Keep a strong reference so the background task is not garbage-collected.
_shutdown_tasks: set["asyncio.Task[None]"] = set()


def _terminate_process() -> None:
    """Ask uvicorn to shut down gracefully via SIGINT."""
    signal.raise_signal(signal.SIGINT)


def _force_exit() -> None:
    """Hard-exit the process (fallback when graceful shutdown stalls)."""
    os._exit(0)


async def _shutdown_later() -> None:
    """Wait briefly so the HTTP response is sent, then stop the process."""
    await asyncio.sleep(_SHUTDOWN_DELAY_SECONDS)
    logger.warning("Shutdown requested via API; stopping process")
    # Back up first: on Windows the SIGINT path may not run the lifespan
    # shutdown hook before the forced exit below.
    from app.services.backup_service import run_backup

    await run_backup()
    _terminate_process()
    await asyncio.sleep(_FORCE_EXIT_DELAY_SECONDS)
    logger.warning("Graceful shutdown did not complete; forcing exit")
    _force_exit()


def _check_local_request(request: Request) -> None:
    """Raise 403 unless the caller is loopback with an allowed browser Origin."""
    client_host = request.client.host if request.client else None
    if client_host not in _ALLOWED_CLIENT_HOSTS:
        raise HTTPException(status_code=403, detail="Shutdown allowed from localhost only")
    if request.headers.get("origin") not in _ALLOWED_ORIGINS:
        raise HTTPException(status_code=403, detail="Origin not allowed")


def _focus_claude_window() -> bool:
    """Bring the Claude desktop app window to the foreground (Windows only).

    Looks for a visible, unowned, titled top-level window belonging to a
    ``claude.exe`` process (CLI instances have no such window). Returns True
    when a window was found and a focus attempt was made.
    """
    import ctypes
    from ctypes import wintypes

    user32: Any = ctypes.windll.user32  # type: ignore[attr-defined]
    kernel32: Any = ctypes.windll.kernel32  # type: ignore[attr-defined]
    kernel32.OpenProcess.restype = wintypes.HANDLE
    kernel32.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    kernel32.QueryFullProcessImageNameW.argtypes = [
        wintypes.HANDLE,
        wintypes.DWORD,
        wintypes.LPWSTR,
        ctypes.POINTER(wintypes.DWORD),
    ]
    kernel32.CloseHandle.argtypes = [wintypes.HANDLE]
    user32.GetWindowTextLengthW.argtypes = [wintypes.HWND]
    user32.GetWindowTextW.argtypes = [wintypes.HWND, wintypes.LPWSTR, ctypes.c_int]
    user32.GetWindowThreadProcessId.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.DWORD)]
    user32.GetWindowRect.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.RECT)]
    user32.GetWindow.argtypes = [wintypes.HWND, ctypes.c_uint]
    user32.GetWindow.restype = wintypes.HWND
    user32.IsWindowVisible.argtypes = [wintypes.HWND]
    user32.IsIconic.argtypes = [wintypes.HWND]
    user32.ShowWindow.argtypes = [wintypes.HWND, ctypes.c_int]
    user32.SetForegroundWindow.argtypes = [wintypes.HWND]
    user32.GetForegroundWindow.restype = wintypes.HWND
    user32.AttachThreadInput.argtypes = [wintypes.DWORD, wintypes.DWORD, wintypes.BOOL]
    user32.BringWindowToTop.argtypes = [wintypes.HWND]

    best: list[tuple[int, int]] = []  # (area, hwnd)

    def _image_name(pid: int) -> str:
        handle = kernel32.OpenProcess(0x1000, False, pid)  # PROCESS_QUERY_LIMITED_INFORMATION
        if not handle:
            return ""
        try:
            buf = ctypes.create_unicode_buffer(1024)
            size = wintypes.DWORD(1024)
            if kernel32.QueryFullProcessImageNameW(handle, 0, buf, ctypes.byref(size)):
                return buf.value.rsplit("\\", 1)[-1].lower()
            return ""
        finally:
            kernel32.CloseHandle(handle)

    def _visit(hwnd: int, _lparam: int) -> bool:
        if not user32.IsWindowVisible(hwnd) or user32.GetWindow(hwnd, 4):  # GW_OWNER
            return True
        if user32.GetWindowTextLengthW(hwnd) == 0:
            return True
        pid = wintypes.DWORD()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
        if _image_name(pid.value) != "claude.exe":
            return True
        rect = wintypes.RECT()
        user32.GetWindowRect(hwnd, ctypes.byref(rect))
        best.append(((rect.right - rect.left) * (rect.bottom - rect.top), hwnd))
        return True

    enum_proc = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
    user32.EnumWindows.argtypes = [enum_proc, wintypes.LPARAM]
    user32.EnumWindows(enum_proc(_visit), 0)
    if not best:
        return False
    hwnd = max(best)[1]

    if user32.IsIconic(hwnd):
        user32.ShowWindow(hwnd, 9)  # SW_RESTORE
    if not user32.SetForegroundWindow(hwnd):
        # Windows refused: attach to the foreground thread's input queue and retry.
        fg = user32.GetForegroundWindow()
        fg_thread = user32.GetWindowThreadProcessId(fg, None) if fg else 0
        this_thread = kernel32.GetCurrentThreadId()
        attached = bool(fg_thread) and bool(user32.AttachThreadInput(this_thread, fg_thread, True))
        try:
            user32.BringWindowToTop(hwnd)
            if not user32.SetForegroundWindow(hwnd):
                # Last resort: a synthetic ALT key press unlocks foreground changes.
                user32.keybd_event(0x12, 0, 0, 0)
                user32.keybd_event(0x12, 0, 2, 0)
                user32.SetForegroundWindow(hwnd)
        finally:
            if attached:
                user32.AttachThreadInput(this_thread, fg_thread, False)
    return True


@router.get("/available")
async def shutdown_available() -> dict[str, bool]:
    """Tell the frontend what is available (stop button, terminal focus)."""
    return {
        "available": True,
        "focus": sys.platform != "win32",
        "appFocus": sys.platform == "win32",
    }


@router.post("")
async def shutdown(request: Request) -> dict[str, str]:
    """Stop the backend process.

    Restricted to loopback clients that send an allowed browser ``Origin``
    header (rejects cross-site and non-browser callers); otherwise 403.
    """
    _check_local_request(request)

    task = asyncio.create_task(_shutdown_later())
    _shutdown_tasks.add(task)
    task.add_done_callback(_shutdown_tasks.discard)
    return {"status": "stopping"}


app_router = APIRouter(prefix="/app", tags=["shutdown"])


@app_router.post("/focus")
async def focus_app(request: Request) -> dict[str, str]:
    """Bring the Claude desktop app to the foreground (Windows only).

    Same loopback + Origin checks as shutdown. 501 on other platforms.
    """
    _check_local_request(request)
    if sys.platform != "win32":
        raise HTTPException(status_code=501, detail="App focus is only supported on Windows")
    found = await asyncio.to_thread(_focus_claude_window)
    return {"status": "ok" if found else "not_found"}


_APP_SESSION_ID_RE = re.compile(r"local_[A-Za-z0-9-]{1,64}")


class OpenConversationRequest(BaseModel):
    """Which conversation to open in the Claude desktop app."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    session_id: str = Field(max_length=128)  # id of the conversation as the Desk sees it


@app_router.post("/open-conversation")
async def open_conversation(
    request: Request, body: OpenConversationRequest
) -> dict[str, str | bool]:
    """Open a conversation in the Claude desktop app (Windows only).

    Same loopback + Origin checks as shutdown. 501 on other platforms; 404 when
    the Desk has no app id for the conversation; 409 when it is archived.
    """
    _check_local_request(request)
    if sys.platform != "win32":
        raise HTTPException(status_code=501, detail="Opening a conversation needs Windows")

    app_sessions = await asyncio.to_thread(load_app_sessions)
    entry = app_sessions.get(body.session_id)
    local_id = entry.get("app_session_id") if entry is not None else None
    if entry is None or not local_id or not _APP_SESSION_ID_RE.fullmatch(local_id):
        raise HTTPException(status_code=404, detail="Conversation not found in the Claude app")
    if entry.get("archived") is True:
        raise HTTPException(status_code=409, detail="Conversation archived in the Claude app")

    try:
        await asyncio.to_thread(os.startfile, f"claude://code/continue?session={local_id}")
    except OSError:
        logger.exception("Could not open conversation %s in the Claude app", local_id)
        raise HTTPException(
            status_code=500, detail="Impossible d'ouvrir la conversation dans l'appli Claude"
        ) from None
    return {"opened": True, "appSessionId": local_id}


_TRASH_DIR_NAME = ".bureau-entreprise-corbeille"


def _sessions_root() -> Path | None:
    """Base folder of the Claude app conversations (patched in tests)."""
    return _default_sessions_root()


def _delete_app_conversation(local_id: str) -> bool:
    """Move ``<root>/*/*/<local_id>.json`` to the trash folder; never deletes for good.

    Also writes the ``deleted_<uuid>`` marker the Claude app leaves when it deletes a
    conversation (content: epoch milliseconds), copying the format of an existing one;
    no marker is written when no example exists. Returns False when no file matches.
    """
    root = _sessions_root()
    if root is None or not root.is_dir() or not _APP_SESSION_ID_RE.fullmatch(local_id):
        return False
    resolved_root = root.resolve()
    matches = [
        p
        for p in root.glob(f"*/*/{local_id}.json")
        if p.is_file() and p.resolve().is_relative_to(resolved_root)
    ]
    if not matches:
        return False
    source = matches[0]

    marker_is_known = False
    for example in root.glob("*/*/deleted_*"):
        if example.is_file():
            try:
                marker_is_known = example.read_text(encoding="utf-8").strip().isdigit()
            except OSError:
                marker_is_known = False
            if marker_is_known:
                break

    trash = root / _TRASH_DIR_NAME
    trash.mkdir(exist_ok=True)
    target = trash / source.name
    if target.exists():
        target = trash / f"{source.stem}.{time.time_ns()}.json"
    shutil.move(str(source), str(target))

    if marker_is_known:
        marker = source.parent / f"deleted_{local_id.removeprefix('local_')}"
        if not marker.exists():
            marker.write_text(str(int(time.time() * 1000)), encoding="utf-8")
    return True


@app_router.post("/delete-conversation")
async def delete_conversation(
    request: Request, body: OpenConversationRequest
) -> dict[str, str | bool]:
    """Delete a conversation in the Claude desktop app (file moved to a trash folder).

    Same loopback + Origin checks as shutdown. 404 when the Desk has no app id for
    the conversation or its file is missing. The path is recomputed server-side.
    """
    _check_local_request(request)

    app_sessions = await asyncio.to_thread(load_app_sessions)
    entry = app_sessions.get(body.session_id)
    local_id = entry.get("app_session_id") if entry is not None else None
    if entry is None or not local_id or not _APP_SESSION_ID_RE.fullmatch(local_id):
        raise HTTPException(status_code=404, detail="Conversation not found in the Claude app")

    try:
        found = await asyncio.to_thread(_delete_app_conversation, local_id)
    except OSError:
        logger.exception("Could not delete conversation %s in the Claude app", local_id)
        raise HTTPException(
            status_code=500, detail="Impossible de supprimer la conversation dans l'appli Claude"
        ) from None
    if not found:
        raise HTTPException(status_code=404, detail="Conversation file not found")

    from app.core.event_processor import get_event_processor

    await get_event_processor().remove_session(body.session_id)
    return {"deleted": True, "appSessionId": local_id}
