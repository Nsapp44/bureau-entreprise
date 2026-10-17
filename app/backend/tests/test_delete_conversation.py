"""Tests for POST /api/v1/app/delete-conversation (no access to the real APPDATA)."""

from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

ORIGIN = {"Origin": "http://localhost:8000"}
LOCAL_ID = "local_47e40cf7-4646-4db9-bf49-fe15e17342d5"
APPS: dict[str, Any] = {"sess-1": {"app_session_id": LOCAL_ID}}


@pytest.fixture
def client() -> TestClient:
    from app.main import app

    return TestClient(app, client=("127.0.0.1", 50000))


@pytest.fixture
def root(tmp_path: Path) -> Path:
    base = tmp_path / "claude-code-sessions"
    (base / "acct" / "org").mkdir(parents=True)
    return base


def _post(
    client: TestClient,
    root: Path,
    apps: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
) -> Any:
    with (
        patch(
            "app.api.routes.shutdown.load_app_sessions", return_value=APPS if apps is None else apps
        ),
        patch("app.api.routes.shutdown._sessions_root", return_value=root),
        patch("app.core.event_processor.EventProcessor.remove_session", new=AsyncMock()),
    ):
        return client.post(
            "/api/v1/app/delete-conversation",
            json={"sessionId": "sess-1"},
            headers=ORIGIN if headers is None else headers,
        )


def test_moves_to_trash_and_writes_marker(client: TestClient, root: Path) -> None:
    folder = root / "acct" / "org"
    (folder / f"{LOCAL_ID}.json").write_text("{}", encoding="utf-8")
    (folder / "deleted_other").write_text("1791138775000", encoding="utf-8")
    resp = _post(client, root)
    assert resp.status_code == 200
    assert resp.json() == {"deleted": True, "appSessionId": LOCAL_ID}
    assert not (folder / f"{LOCAL_ID}.json").exists()
    assert (root / ".bureau-entreprise-corbeille" / f"{LOCAL_ID}.json").read_text() == "{}"
    marker = folder / "deleted_47e40cf7-4646-4db9-bf49-fe15e17342d5"
    assert marker.read_text(encoding="utf-8").isdigit()


def test_no_marker_without_example(client: TestClient, root: Path) -> None:
    folder = root / "acct" / "org"
    (folder / f"{LOCAL_ID}.json").write_text("{}", encoding="utf-8")
    assert _post(client, root).status_code == 200
    assert (root / ".bureau-entreprise-corbeille" / f"{LOCAL_ID}.json").exists()
    assert not list(folder.glob("deleted_*"))


def test_404_when_file_missing_or_unknown(client: TestClient, root: Path) -> None:
    assert _post(client, root).status_code == 404  # no file on disk
    assert _post(client, root, apps={}).status_code == 404  # unknown conversation
    bad = {"sess-1": {"app_session_id": "local_../../x"}}
    assert _post(client, root, apps=bad).status_code == 404  # invalid id


@pytest.mark.parametrize("headers", [{}, {"Origin": "http://evil.com"}])
def test_refused_without_good_origin(
    client: TestClient, root: Path, headers: dict[str, str]
) -> None:
    folder = root / "acct" / "org"
    (folder / f"{LOCAL_ID}.json").write_text("{}", encoding="utf-8")
    assert _post(client, root, headers=headers).status_code == 403
    assert (folder / f"{LOCAL_ID}.json").exists()
