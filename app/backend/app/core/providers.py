"""Provider (who serves the model) and client (program running the conversation).

Single source of truth for both dimensions; the frontend only displays what the
backend computes (see docs/architecture/fournisseurs-conso-conversations.md §1).
"""

from pathlib import PurePath

__all__ = [
    "PROVIDERS",
    "CLIENTS",
    "provider_for_model",
    "client_for_transcript",
]

PROVIDERS = ("anthropic", "openai", "deepseek", "google", "local", "unknown")
CLIENTS = ("claude-code", "openclaude", "codex-cli", "opencode", "unknown")

_ANTHROPIC_NAMES = ("opus", "sonnet", "haiku", "fable")
_LOCAL_PREFIXES = ("qwen", "llama", "mistral", "phi", "gemma", "codellama", "mixtral")


def provider_for_model(model: str | None) -> str:
    """Return the provider id for a model name (``unknown`` if not recognised)."""
    if not model:
        return "unknown"
    name = model.strip().lower()
    # Strip a routing prefix such as "openai/gpt-5" or "anthropic/claude-3".
    if "/" in name:
        name = name.rsplit("/", 1)[-1]
    if not name or name.startswith("<"):  # e.g. "<synthetic>"
        return "unknown"
    if name.startswith("claude") or name.startswith(_ANTHROPIC_NAMES):
        return "anthropic"
    if name.startswith(("gpt", "o3", "o4", "codex")):
        return "openai"
    if name.startswith("deepseek"):
        return "deepseek"
    if name.startswith("gemini"):
        return "google"
    if name.startswith(_LOCAL_PREFIXES) or ":" in name:
        return "local"
    return "unknown"


def client_for_transcript(path: str | PurePath | None) -> str:
    """Return the client id for a transcript path (``unknown`` if not recognised)."""
    if not path:
        return "unknown"
    parts = [p.lower() for p in PurePath(str(path).replace("\\", "/")).parts]
    # ".openclaude" must be tested before ".claude" (distinct directory names).
    if ".openclaude" in parts:
        return "openclaude"
    if ".codex" in parts:
        return "codex-cli"
    if ".claude" in parts:
        return "claude-code"
    return "unknown"
