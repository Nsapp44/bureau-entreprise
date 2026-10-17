"""Tests for provider/client detection and their relay on Agent and Boss."""

import pytest

from app.core.providers import client_for_transcript, provider_for_model
from app.core.state_machine import StateMachine
from app.models.agents import Agent, AgentState, Boss, BossState


@pytest.mark.parametrize(
    ("model", "expected"),
    [
        ("claude-opus-4-7", "anthropic"),
        ("claude-sonnet-5-5", "anthropic"),
        ("claude-haiku-4-5-20251001", "anthropic"),
        ("opus", "anthropic"),
        ("sonnet", "anthropic"),
        ("haiku", "anthropic"),
        ("fable", "anthropic"),
        ("Claude-Opus-4-7", "anthropic"),
        ("gpt-5.6-sol", "openai"),
        ("gpt-4o", "openai"),
        ("o3-mini", "openai"),
        ("o4-mini", "openai"),
        ("codex-mini-latest", "openai"),
        ("openai/gpt-5", "openai"),
        ("deepseek-chat", "deepseek"),
        ("deepseek-reasoner", "deepseek"),
        ("gemini-2.5-pro", "google"),
        ("qwen2.5-coder", "local"),
        ("llama3.1", "local"),
        ("mistral", "local"),
        ("foo:7b", "local"),
        ("<synthetic>", "unknown"),
        ("something-else", "unknown"),
        ("", "unknown"),
        (None, "unknown"),
    ],
)
def test_provider_for_model(model: str | None, expected: str) -> None:
    assert provider_for_model(model) == expected


@pytest.mark.parametrize(
    ("path", "expected"),
    [
        ("/home/u/.claude/projects/x/abc.jsonl", "claude-code"),
        ("C:\\Users\\u\\.claude\\projects\\x\\abc.jsonl", "claude-code"),
        ("/home/u/.openclaude/projects/x/abc.jsonl", "openclaude"),
        ("C:\\Users\\u\\.openclaude\\projects\\x\\abc.jsonl", "openclaude"),
        ("/home/u/.codex/sessions/2026/10/rollout-1.jsonl", "codex-cli"),
        ("/home/u/.local/share/opencode/x.jsonl", "unknown"),
        ("/tmp/other.jsonl", "unknown"),
        ("", "unknown"),
        (None, "unknown"),
    ],
)
def test_client_for_transcript(path: str | None, expected: str) -> None:
    assert client_for_transcript(path) == expected


def test_agent_provider_follows_model() -> None:
    agent = Agent(id="a", color="#fff", number=1, state=AgentState.WORKING)
    assert agent.provider == "unknown"
    agent.model = "gpt-5.6-sol"
    assert agent.provider == "openai"
    agent.model = "claude-sonnet-5-5"
    assert agent.provider == "anthropic"


def test_agent_serialises_provider_and_client_in_camel_case() -> None:
    agent = Agent(
        id="a",
        color="#fff",
        number=1,
        state=AgentState.WORKING,
        model="deepseek-chat",
        client="openclaude",
    )
    dumped = agent.model_dump(by_alias=True)
    assert dumped["provider"] == "deepseek"
    assert dumped["client"] == "openclaude"


def test_boss_serialises_model_provider_client() -> None:
    boss = Boss(state=BossState.IDLE, model="claude-opus-4-7", client="claude-code")
    dumped = boss.model_dump(by_alias=True)
    assert dumped["model"] == "claude-opus-4-7"
    assert dumped["provider"] == "anthropic"
    assert dumped["client"] == "claude-code"


def test_game_state_boss_carries_session_model_and_client() -> None:
    sm = StateMachine()
    sm.token_tracker.model = "gpt-5.6-sol"
    sm.client = "openclaude"
    state = sm.to_game_state("s1")
    assert state.boss.model == "gpt-5.6-sol"
    assert state.boss.provider == "openai"
    assert state.boss.client == "openclaude"
