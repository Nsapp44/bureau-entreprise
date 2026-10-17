"""Live estimate of the plan meters from the last real reading + tokens since."""

from typing import Any

import pytest

from app.services import usage_service as us


def _entry(ts: float, model: str = "claude-opus-5-5", **counts: int) -> us.Entry:
    full = {f: counts.get(f, 0) for f in us._FIELDS}
    return (None, "s", "2026-10-04", model, full, ts)


def _setup(monkeypatch: pytest.MonkeyPatch, base: dict[str, Any], entries: list[us.Entry]) -> None:
    monkeypatch.setattr(us, "read_rate_limits", lambda: base)
    monkeypatch.setattr(us, "_collect", lambda: entries)


def test_adds_weighted_tokens_since_reading(monkeypatch: pytest.MonkeyPatch) -> None:
    base = {"five_hour": {"used_percentage": 50, "resets_at": 10_000}, "updated_at": 1_000}
    entries = [
        _entry(900, cacheWrite=1_000_000),  # before the reading: already counted
        _entry(1_500, cacheRead=1_000_000),  # 0.1 x 1 M = 100 k -> +1 point
        _entry(1_600, model="claude-haiku-4-5", cacheWrite=250_000),  # 0.2 x 2 x 250 k -> +1
    ]
    _setup(monkeypatch, base, entries)
    est = us.estimate_rate_limits(now=2_000)
    assert est["five_hour"] == {"used_percentage": 52.0, "resets_at": 10_000, "margin": 1.8}


def test_new_window_after_reset(monkeypatch: pytest.MonkeyPatch) -> None:
    base = {"five_hour": {"used_percentage": 90, "resets_at": 7_200}, "updated_at": 1_000}
    entries = [_entry(2_000, input=500_000), _entry(7_300, input=300_000)]
    _setup(monkeypatch, base, entries)
    est = us.estimate_rate_limits(now=8_000)
    assert est["five_hour"] == {
        "used_percentage": 3.0,
        "resets_at": 7_200 + 5 * 3600,
        "margin": 3.2,
    }


def test_expired_window_without_new_messages_is_dropped(monkeypatch: pytest.MonkeyPatch) -> None:
    base = {"five_hour": {"used_percentage": 90, "resets_at": 7_200}, "updated_at": 1_000}
    _setup(monkeypatch, base, [])
    assert "five_hour" not in us.estimate_rate_limits(now=8_000)


def test_no_reading_returns_base(monkeypatch: pytest.MonkeyPatch) -> None:
    _setup(monkeypatch, {}, [])
    assert us.estimate_rate_limits(now=8_000) == {}


def test_margin_is_capped(monkeypatch: pytest.MonkeyPatch) -> None:
    base = {"five_hour": {"used_percentage": 10, "resets_at": 10_000}, "updated_at": 1_000}
    _setup(monkeypatch, base, [_entry(1_500, input=500_000_000)])
    est = us.estimate_rate_limits(now=2_000)
    assert est["five_hour"]["margin"] == 25.0
    assert est["five_hour"]["used_percentage"] == 100.0


def test_manual_reading_becomes_the_new_anchor(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Any
) -> None:
    f = tmp_path / "bureau_conso.json"
    f.write_text('{"five_hour": {"used_percentage": 40, "resets_at": 50000}, "updated_at": 1000}')
    monkeypatch.setattr(us, "rate_limits_file", lambda: f)
    monkeypatch.setattr(us, "_collect", lambda: [_entry(1_500, cacheRead=1_000_000)])
    est = us.set_manual_reading(60, now=2_000)
    # Anchored on 60 at t=2000: the earlier tokens (t=1500) no longer count.
    assert est["five_hour"] == {"used_percentage": 60.0, "resets_at": 50000, "margin": 1.0}
    assert us.read_rate_limits()["updated_at"] == 2_000


def test_manual_reading_without_known_window_assumes_current_hour(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Any
) -> None:
    f = tmp_path / "bureau_conso.json"
    monkeypatch.setattr(us, "rate_limits_file", lambda: f)
    monkeypatch.setattr(us, "_collect", lambda: [])
    est = us.set_manual_reading(30, seven_day_pct=70, now=7_300)
    assert est["five_hour"]["resets_at"] == 7_200 + 5 * 3600
    assert est["seven_day"]["used_percentage"] == 70.0
