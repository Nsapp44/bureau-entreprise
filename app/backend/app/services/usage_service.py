"""Token usage aggregation from Claude Code JSONL transcripts (~/.claude/projects)."""

import json
import logging
import time
import urllib.request
from collections import defaultdict
from datetime import UTC, date, datetime
from pathlib import Path
from threading import Lock
from typing import Any, cast

from app.core.path_utils import is_safe_transcript_path

logger = logging.getLogger(__name__)

_FIELDS = ("input", "output", "cacheRead", "cacheWrite")
_USAGE_KEYS = {
    "input": "input_tokens",
    "output": "output_tokens",
    "cacheRead": "cache_read_input_tokens",
    "cacheWrite": "cache_creation_input_tokens",
}

Counts = dict[str, int]
# One deduplicated usage entry:
# (dedup key or None, sessionId, local day, model, counts, epoch seconds)
Entry = tuple[tuple[str, str] | None, str, str, str, Counts, float]
FileAgg = list[Entry]
# (mtime_ns, size, aggregates)
_cache: dict[str, tuple[int, int, FileAgg]] = {}
_cache_lock = Lock()


def projects_dir() -> Path:
    """Directory holding Claude Code transcripts."""
    return Path.home() / ".claude" / "projects"


def _empty() -> Counts:
    return dict.fromkeys(_FIELDS, 0)


def _add(target: Counts, source: Counts) -> None:
    for f in _FIELDS:
        target[f] += source[f]


def _totals(counts: Counts) -> dict[str, int]:
    return {**counts, "total": sum(counts[f] for f in _FIELDS)}


def _as_int(value: object) -> int:
    return value if isinstance(value, int) and not isinstance(value, bool) else 0


def _parse_ts(timestamp: str) -> datetime | None:
    try:
        dt = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
    except ValueError:
        return None
    return dt.replace(tzinfo=UTC) if dt.tzinfo is None else dt


def _parse_file(path: Path) -> FileAgg:
    """Aggregate one transcript file, deduplicating by (message.id, requestId)."""
    seen: set[tuple[str, str]] = set()
    agg: FileAgg = []
    try:
        with open(path, encoding="utf-8", errors="replace") as f:
            for line in f:
                if '"usage"' not in line:
                    continue
                try:
                    parsed: object = json.loads(line)
                except ValueError:
                    continue
                if not isinstance(parsed, dict):
                    continue
                rec = cast(dict[str, Any], parsed)
                if rec.get("type") != "assistant":
                    continue
                raw_msg = rec.get("message")
                if not isinstance(raw_msg, dict):
                    continue
                msg = cast(dict[str, Any], raw_msg)
                raw_usage = msg.get("usage")
                model = msg.get("model")
                if not isinstance(raw_usage, dict) or not isinstance(model, str):
                    continue
                usage = cast(dict[str, Any], raw_usage)
                if not model or model.startswith("<"):
                    continue
                msg_id, req_id = msg.get("id"), rec.get("requestId")
                key = (str(msg_id), str(req_id)) if msg_id and req_id else None
                if key is not None:
                    if key in seen:
                        continue
                    seen.add(key)
                ts, session = rec.get("timestamp"), rec.get("sessionId")
                if not isinstance(ts, str) or not isinstance(session, str):
                    continue
                dt = _parse_ts(ts)
                if dt is None:
                    continue
                day = dt.astimezone().date().isoformat()
                counts = {f: _as_int(usage.get(k)) for f, k in _USAGE_KEYS.items()}
                agg.append((key, session, day, model, counts, dt.timestamp()))
    except OSError:
        logger.debug("Cannot read transcript %s", path)
    return agg


def _collect() -> list[Entry]:
    """Return entries for all transcripts (deduplicated across files).

    Only files whose mtime/size changed are re-read.
    """
    root = projects_dir()
    if not root.is_dir():
        return []
    result: list[Entry] = []
    seen: set[tuple[str, str]] = set()
    live: set[str] = set()
    for path in root.rglob("*.jsonl"):
        if not is_safe_transcript_path(path):
            continue
        try:
            st = path.stat()
        except OSError:
            continue
        key = str(path)
        live.add(key)
        with _cache_lock:
            cached = _cache.get(key)
        if cached and cached[0] == st.st_mtime_ns and cached[1] == st.st_size:
            agg = cached[2]
        else:
            agg = _parse_file(path)
            with _cache_lock:
                _cache[key] = (st.st_mtime_ns, st.st_size, agg)
        for entry in agg:
            if entry[0] is not None:
                if entry[0] in seen:
                    continue
                seen.add(entry[0])
            result.append(entry)
    with _cache_lock:
        for stale in set(_cache) - live:
            del _cache[stale]
    return result


def _by_model(items: dict[str, Counts]) -> dict[str, dict[str, int]]:
    return {m: _totals(c) for m, c in sorted(items.items())}


def compute_today(today: date | None = None) -> dict[str, Any]:
    """Token totals for the current local day, overall and per model."""
    day = (today or datetime.now().astimezone().date()).isoformat()
    total, models, cumul = _empty(), defaultdict[str, Counts](_empty), _empty()
    for _key, _session, d, model, counts, _ts in _collect():
        _add(cumul, counts)
        if d == day:
            _add(total, counts)
            _add(models[model], counts)
    return {
        "date": day,
        "totals": _totals(total),
        "byModel": _by_model(dict(models)),
        "allTime": _totals(cumul),
    }


def compute_sessions() -> dict[str, Any]:
    """Token totals per session id (sub-agent transcripts count in their parent)."""
    totals: dict[str, Counts] = {}
    models: dict[str, dict[str, Counts]] = {}
    latest: dict[str, tuple[float, int]] = {}
    for _key, session, _d, model, counts, ts in _collect():
        # Contexte = ce que le dernier message a relu (entrée + cache lu + cache écrit).
        prompt = counts["input"] + counts["cacheRead"] + counts["cacheWrite"]
        if session not in latest or ts >= latest[session][0]:
            latest[session] = (ts, prompt)
        _add(totals.setdefault(session, _empty()), counts)
        _add(models.setdefault(session, {}).setdefault(model, _empty()), counts)
    return {
        s: {
            "totals": _totals(totals[s]),
            "byModel": _by_model(models[s]),
            "context": latest[s][1],
        }
        for s in sorted(totals)
    }


def compute_session_usage(today: date | None = None) -> dict[str, dict[str, Any]]:
    """Tokens par conversation : cumulés, du jour (local) et dernier modèle vu."""
    day = (today or datetime.now().astimezone().date()).isoformat()
    totals: dict[str, Counts] = {}
    today_totals: dict[str, Counts] = {}
    latest_model: dict[str, tuple[float, str]] = {}
    for _key, session, d, model, counts, ts in _collect():
        _add(totals.setdefault(session, _empty()), counts)
        day_counts = today_totals.setdefault(session, _empty())
        if d == day:
            _add(day_counts, counts)
        if (
            model
            and not model.startswith("<")
            and (session not in latest_model or ts >= latest_model[session][0])
        ):
            latest_model[session] = (ts, model)
    return {
        s: {
            "total": _totals(totals[s])["total"],
            "today": _totals(today_totals[s])["total"],
            "model": latest_model[s][1] if s in latest_model else None,
        }
        for s in sorted(totals)
    }


CONTEXT_HEAVY = 60_000
CONTEXT_CRITICAL = 110_000
CONTEXT_FRESH_S = 3600


def context_level(context: int) -> str:
    """ok / heavy / critical from the prompt size of the last message."""
    if context >= CONTEXT_CRITICAL:
        return "critical"
    return "heavy" if context >= CONTEXT_HEAVY else "ok"


def current_context(now: float | None = None) -> dict[str, Any]:
    """Context size of the most recently active session (None if idle > 1 h)."""
    latest: tuple[float, str, int] | None = None
    for _key, session, _d, _model, counts, ts in _collect():
        if latest is None or ts >= latest[0]:
            latest = (ts, session, counts["input"] + counts["cacheRead"] + counts["cacheWrite"])
    if latest is None or (now if now is not None else time.time()) - latest[0] > CONTEXT_FRESH_S:
        return {"sessionId": None, "context": 0, "level": "ok", "updatedAt": None}
    ts, session, context = latest
    return {
        "sessionId": session,
        "context": context,
        "level": context_level(context),
        "updatedAt": ts,
    }


def rate_limits_file() -> Path:
    """File written by ~/.claude/hooks/conso_5h.py (Claude Code status line)."""
    return Path.home() / ".claude" / "bureau_conso.json"


def read_rate_limits() -> dict[str, Any]:
    """Last known 5h / 7-day usage; empty dict when unknown or unreadable."""
    try:
        data = json.loads(rate_limits_file().read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    return data if isinstance(data, dict) else {}


def _codex_sessions_dir() -> Path:
    return Path.home() / ".codex" / "sessions"


def _last_codex_rate_limits() -> tuple[dict[str, Any], float] | None:
    """Official ChatGPT meters from the newest Codex rollout holding a token_count."""
    root = _codex_sessions_dir()
    try:
        files = sorted(root.glob("*/*/*/rollout-*.jsonl"), key=lambda f: f.stat().st_mtime)
    except OSError:
        return None
    for path in reversed(files[-5:]):
        try:
            with path.open("rb") as fh:
                fh.seek(0, 2)
                fh.seek(max(0, fh.tell() - 400_000))
                tail = fh.read().decode("utf-8", errors="ignore").splitlines()
        except OSError:
            continue
        for line in reversed(tail):
            if '"rate_limits"' not in line:
                continue
            try:
                rec = json.loads(line)
                limits = rec["payload"]["rate_limits"]
                read_at = datetime.fromisoformat(rec["timestamp"].replace("Z", "+00:00"))
            except (ValueError, KeyError, TypeError):
                continue
            if isinstance(limits, dict) and isinstance(limits.get("primary"), dict):
                return limits, read_at.timestamp()
    return None


_OAUTH_TTL = 300.0
"""Seconds between two calls to the usage endpoint (5 min, prudent: no official limit)."""
_oauth_cache: tuple[float, list[dict[str, Any]]] = (0.0, [])


def _oauth_usage(now: float | None = None) -> list[dict[str, Any]]:
    """Real 5h / 7-day Claude meters from Anthropic's usage endpoint (same as /usage).

    Uses the access token Claude Code / the desktop app keep in ~/.claude/.credentials.json
    (read only, never refreshed or rewritten here). Empty list when unavailable.
    """
    global _oauth_cache
    now = time.time() if now is None else now
    if now - _oauth_cache[0] < _OAUTH_TTL:
        return _oauth_cache[1]
    out: list[dict[str, Any]] = []
    try:
        creds = json.loads((Path.home() / ".claude" / ".credentials.json").read_text("utf-8"))
        token = creds["claudeAiOauth"]["accessToken"]
        req = urllib.request.Request(
            "https://api.anthropic.com/api/oauth/usage",
            headers={
                "Authorization": f"Bearer {token}",
                "anthropic-beta": "oauth-2025-04-20",
                "Accept": "application/json",
            },
        )
        with urllib.request.urlopen(req, timeout=8) as resp:  # noqa: S310 - fixed https URL
            data = json.loads(resp.read().decode("utf-8"))
        for key, window in (("five_hour", "5h"), ("seven_day", "7j")):
            win = data.get(key)
            if isinstance(win, dict) and isinstance(win.get("utilization"), int | float):
                resets = win.get("resets_at")
                out.append(
                    {
                        "account": "claude",
                        "window": window,
                        "percent": float(win["utilization"]),
                        "resetsAt": datetime.fromisoformat(resets).timestamp()
                        if isinstance(resets, str)
                        else None,
                        "readAt": now,
                        "source": "oauth",
                    }
                )
    except Exception:  # noqa: BLE001 - réseau, jeton expiré, fichier absent : repli sur l'estimation
        logger.info("Claude usage endpoint unavailable", exc_info=True)
    _oauth_cache = (now, out)
    return out


def read_quota() -> list[dict[str, Any]]:
    """Latest official subscription meters (percent USED, never estimated) with their age.

    Both accounts report percent used here. Note: the ChatGPT/Codex UI shows percent
    *remaining*; convert only for display labelled as such.
    """
    readings: list[dict[str, Any]] = []
    real_claude = _oauth_usage()
    readings.extend(real_claude)
    # The status line only runs in the terminal: when the real reading is stale or its
    # window is over, fall back on the live estimate so the wall never shows "—".
    claude = {} if real_claude else estimate_rate_limits()
    raw = read_rate_limits()
    updated = claude.get("updated_at")
    for key, window in (("five_hour", "5h"), ("seven_day", "7j")):
        win = claude.get(key)
        if isinstance(win, dict) and isinstance(win.get("used_percentage"), int | float):
            real = raw.get(key)
            estimated = not (
                isinstance(real, dict)
                and real.get("resets_at") == win.get("resets_at")
                and real.get("used_percentage") == win.get("used_percentage")
            )
            readings.append(
                {
                    "account": "claude",
                    "window": window,
                    "percent": float(win["used_percentage"]),
                    "resetsAt": win.get("resets_at"),
                    "readAt": time.time() if estimated else updated,
                    "source": "estimate" if estimated else "statusline",
                    **({"margin": win["margin"]} if estimated and "margin" in win else {}),
                }
            )
    codex = _last_codex_rate_limits()
    if codex:
        limits, read_at = codex
        for key, window in (("primary", "5h"), ("secondary", "7j")):
            win = limits.get(key)
            if isinstance(win, dict) and isinstance(win.get("used_percent"), int | float):
                readings.append(
                    {
                        "account": "chatgpt",
                        "window": window,
                        "percent": float(win["used_percent"]),
                        "resetsAt": win.get("resets_at"),
                        "readAt": read_at,
                        "source": "codex-rollout",
                        "plan": limits.get("plan_type"),
                    }
                )
    return readings


# Live estimate of the plan meters between two real readings (bureau_conso.json).
# Weights measured on 2026-10-04 (Pro plan, Opus): 519 k cache reads moved the
# 5-hour meter by ~1 point, 342 k cache writes (1-hour cache) by ~7 points, which
# matches API price ratios. Opus-equivalent tokens per meter point:
_TOKEN_WEIGHTS = {"input": 1.0, "cacheWrite": 2.0, "cacheRead": 0.1, "output": 5.0}
_MODEL_WEIGHTS = (("opus", 1.0), ("sonnet", 0.6), ("haiku", 0.2))
_EQ_PER_POINT = {"five_hour": 100_000.0, "seven_day": 700_000.0}
_WINDOW_SECONDS = {"five_hour": 5 * 3600, "seven_day": 7 * 86400}
# The weights are fitted on few readings (2026-10-05: the estimate read 42 % / 92 %
# against a real 55 % / 99 %), so the error grows with the estimated part: margin
# in points = base + share x (points added since the real reading), capped.
_MARGIN_ANCHORED = 1.0  # just after a real reading
_MARGIN_NEW_WINDOW = 2.0  # window opened since the last reading: nothing to anchor on
_MARGIN_SHARE = 0.4
_MARGIN_CAP = 25.0


def _weight(model: str, counts: Counts) -> float:
    factor = next((w for name, w in _MODEL_WEIGHTS if name in model), 1.0)
    return factor * sum(counts[f] * _TOKEN_WEIGHTS[f] for f in _FIELDS)


def _estimate_window(
    key: str, win: dict[str, Any], since: float, usage: list[tuple[float, float]], now: float
) -> dict[str, Any] | None:
    pct, resets = win.get("used_percentage"), win.get("resets_at")
    if not isinstance(pct, int | float) or not isinstance(resets, int | float):
        return None
    added = sum(w for t, w in usage if t > since) / _EQ_PER_POINT[key]
    used = pct + added
    margin = _MARGIN_ANCHORED + _MARGIN_SHARE * added
    # Window over: a new one opens (on the hour) with the first message after it.
    while now >= resets:
        later = [t for t, _w in usage if t >= resets]
        if not later:
            return None
        start = min(later) - min(later) % 3600
        resets = start + _WINDOW_SECONDS[key]
        used = sum(w for t, w in usage if t >= start) / _EQ_PER_POINT[key]
        margin = _MARGIN_NEW_WINDOW + _MARGIN_SHARE * used
    return {
        "used_percentage": round(min(100.0, used), 1),
        "resets_at": int(resets),
        "margin": round(min(_MARGIN_CAP, margin), 1),
    }


def estimate_rate_limits(now: float | None = None) -> dict[str, Any]:
    """Last real 5h / 7-day reading plus the tokens used since, weighted."""
    base = read_rate_limits()
    updated = base.get("updated_at")
    if not isinstance(updated, int | float):
        return base
    now = time.time() if now is None else now
    usage = [(e[5], _weight(e[3], e[4])) for e in _collect()]
    out: dict[str, Any] = {"updated_at": updated}
    for key in ("five_hour", "seven_day"):
        win = base.get(key)
        if isinstance(win, dict):
            est = _estimate_window(key, cast(dict[str, Any], win), updated, usage, now)
            if est is not None:
                out[key] = est
    return out


def set_manual_reading(
    five_hour_pct: float, seven_day_pct: float | None = None, now: float | None = None
) -> dict[str, Any]:
    """Record a reading typed by hand (the user read it on claude.ai) as the new anchor.

    The estimate then continues from it. Reset times come from the current estimate
    when known; otherwise the window is assumed to have opened on the current hour.
    The status line overwrites the file with a real reading as soon as it runs.
    """
    now = time.time() if now is None else now
    current = estimate_rate_limits(now)
    out: dict[str, Any] = {"updated_at": int(now)}
    for key, pct in (("five_hour", five_hour_pct), ("seven_day", seven_day_pct)):
        if pct is None:
            win = current.get(key)
            if isinstance(win, dict):  # keep the other meter as currently estimated
                out[key] = {
                    "used_percentage": win["used_percentage"],
                    "resets_at": win["resets_at"],
                }
            continue
        win = current.get(key)
        resets = win.get("resets_at") if isinstance(win, dict) else None
        if not isinstance(resets, int | float) or resets <= now:
            resets = now - now % 3600 + _WINDOW_SECONDS[key]
        out[key] = {"used_percentage": round(float(pct), 1), "resets_at": int(resets)}
    path = rate_limits_file()
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(out), encoding="utf-8")
    tmp.replace(path)
    return estimate_rate_limits(now)
