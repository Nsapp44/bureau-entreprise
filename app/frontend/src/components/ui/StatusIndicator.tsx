type Tone = "ok" | "warn" | "error" | "idle" | "claude" | "openai";

const TONES: Record<Tone, string> = {
  ok: "#22c55e",
  warn: "#f59e0b",
  error: "#ef4444",
  idle: "#85827d",
  claude: "#ff8a4c",
  openai: "#10a37f",
};

interface StatusIndicatorProps {
  tone: Tone;
  label: string;
  pulse?: boolean;
}

/** Pastille + libellé texte (jamais la couleur seule). */
export function StatusIndicator({ tone, label, pulse = false }: StatusIndicatorProps) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-300">
      <span
        aria-hidden="true"
        className={`h-2 w-2 rounded-full ${pulse ? "animate-pulse" : ""}`}
        style={{ backgroundColor: TONES[tone] }}
      />
      {label}
    </span>
  );
}
