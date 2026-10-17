"use client";

/**
 * ConsoMode — consommation quotidienne Claude / OpenAI + compteur de cafés.
 * Les quotas sont des fractions indépendantes du contexte de 150 K.
 */

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Graphics } from "pixi.js";
import { useQuota, useTodayUsage, type QuotaReading } from "@/hooks/useUsage";
import { formatTokens } from "@/utils/tokenFormat";
import { groupByFamily } from "@/utils/usageFamilies";
import { useCoffeeStore } from "@/stores/coffeeStore";

interface ConsoModeProps {
  quota?: {
    claude?: number;
    openai?: number;
  };
}

type Provider = "claude" | "openai";

interface ProviderTotals {
  claude: number;
  openai: number;
  unassigned: number;
}

const MONO = '"Courier New", monospace';
const BAR_X = 18;
const BAR_W = 294;
const BAR_Y = 25;
const BAR_H = 7;

const PROVIDERS: ReadonlyArray<{
  key: Provider;
  label: string;
  color: number;
}> = [
  { key: "claude", label: "Claude", color: 0xff8a4c },
  { key: "openai", label: "OpenAI", color: 0x10a37f },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteTotal(value: unknown): number | undefined {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0
    ? value
    : undefined;
}

function readTotal(value: unknown): number | undefined {
  const direct = finiteTotal(value);
  if (direct !== undefined) return direct;
  if (!isRecord(value)) return undefined;

  return (
    finiteTotal(value.total) ??
    finiteTotal(value.totalTokens) ??
    finiteTotal(value.total_tokens)
  );
}

function identifyProvider(name: string): Provider | undefined {
  const normalized = name.toLowerCase();

  if (
    /(^|[^a-z0-9])(anthropic|claude|sonnet|opus|haiku)(?=$|[^a-z0-9])/.test(
      normalized,
    )
  ) {
    return "claude";
  }

  if (
    /(^|[^a-z0-9])(openai|chatgpt|gpt|o[134])(?=$|[^a-z0-9])/.test(
      normalized,
    )
  ) {
    return "openai";
  }

  return undefined;
}

function readProvider(key: string, value: unknown): Provider | undefined {
  if (isRecord(value)) {
    // Un fournisseur explicite prime sur le nom du modèle.
    for (const field of ["provider", "vendor", "model", "modelId", "name"]) {
      const candidate = value[field];
      if (typeof candidate !== "string") continue;

      const provider = identifyProvider(candidate);
      if (provider !== undefined) return provider;
    }
  }

  return identifyProvider(key);
}

function normalizeQuota(value: number | undefined): number | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  return Math.min(1, Math.max(0, value));
}

const ACCOUNT: Record<Provider, QuotaReading["account"]> = {
  claude: "claude",
  openai: "chatgpt",
};

/** Dernière lecture officielle d'une fenêtre ; ignorée si la fenêtre est déjà réinitialisée. */
function liveReading(
  readings: QuotaReading[] | null,
  provider: Provider,
  window: QuotaReading["window"],
  nowSec: number,
): QuotaReading | undefined {
  const r = readings?.find(
    (q) => q.account === ACCOUNT[provider] && q.window === window,
  );
  return r && (r.resetsAt === null || r.resetsAt > nowSec) ? r : undefined;
}

function ageText(readAt: number | null, nowSec: number): string {
  if (readAt === null) return "";
  const min = Math.max(0, Math.floor((nowSec - readAt) / 60));
  if (min < 1) return " · à l'instant";
  if (min < 60) return ` · il y a ${min} min`;
  return ` · il y a ${Math.floor(min / 60)} h`;
}

export function ConsoMode({ quota }: ConsoModeProps = {}): ReactNode {
  const usage = useTodayUsage();
  const readings = useQuota();
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 30_000);
    return () => clearInterval(id);
  }, []);
  const coffeeCount = useCoffeeStore((s) => s.coffeeCount);

  const totals = useMemo<ProviderTotals>(() => {
    const result: ProviderTotals = {
      claude: 0,
      openai: 0,
      unassigned: 0,
    };

    if (!usage) return result;

    const source: unknown = usage.byModel;
    const entries: Array<[string, unknown]> = Array.isArray(source)
      ? source.map(
          (value: unknown, index: number): [string, unknown] => [
            String(index),
            value,
          ],
        )
      : isRecord(source)
        ? Object.entries(source)
        : [];

    let recognizedClaude = false;

    for (const [key, value] of entries) {
      const provider = readProvider(key, value);
      const total = readTotal(value);

      if (provider === undefined || total === undefined) continue;

      result[provider] += total;
      if (provider === "claude") recognizedClaude = true;
    }

    // Compatibilité avec le regroupement déjà utilisé par l'application.
    // « Autre » n'est jamais assimilé automatiquement à OpenAI.
    if (!recognizedClaude) {
      for (const family of groupByFamily(usage.byModel)) {
        if (identifyProvider(family.family) === "claude") {
          result.claude += finiteTotal(family.total) ?? 0;
        }
      }
    }

    const total = finiteTotal(usage.totals.total) ?? 0;
    result.unassigned = Math.max(
      0,
      total - result.claude - result.openai,
    );

    return result;
  }, [usage]);

  // OpenAI n'apparaît que si un compte ChatGPT est connecté ou a consommé.
  const openaiConnected =
    (readings ?? []).some((r) => r.account === "chatgpt") ||
    totals.openai > 0;

  const total = usage ? finiteTotal(usage.totals.total) ?? 0 : undefined;
  const totalText = total === undefined ? "—" : formatTokens(total);

  return (
    <pixiContainer>
      <pixiGraphics
        draw={(g: Graphics): void => {
          g.clear();
          g.rect(18, 24, 294, 1).fill({ color: 0xffffff, alpha: 0.1 });
          g.rect(18, 134, 294, 1).fill({ color: 0xffffff, alpha: 0.1 });
        }}
      />

      <pixiText
        text="CONSO DU JOUR"
        x={18}
        y={12}
        anchor={{ x: 0, y: 0.5 }}
        style={{
          fontFamily: MONO,
          fontSize: 12,
          fontWeight: "bold",
          fill: "#F3F1EC",
        }}
        resolution={2}
      />

      <pixiText
        text={totalText}
        x={312}
        y={12}
        anchor={{ x: 1, y: 0.5 }}
        style={{
          fontFamily: MONO,
          fontSize: Math.min(18, 132 / (totalText.length * 0.65)),
          fontWeight: "bold",
          fill: "#FF5A3C",
        }}
        resolution={2}
      />

      {PROVIDERS.filter(
        ({ key }) => key === "claude" || openaiConnected,
      ).map(({ key, label, color }, index) => {
        const five = liveReading(readings, key, "5h", nowSec);
        const seven = liveReading(readings, key, "7j", nowSec);
        const fraction = normalizeQuota(
          quota?.[key] ?? (five ? five.percent / 100 : undefined),
        );
        // Les lectures sont en % consommé ; l'interface ChatGPT affiche le % restant.
        const quotaText = !five
          ? "quota —"
          : `5h ${Math.round(five.percent)} %${
              seven ? ` · 7j ${Math.round(seven.percent)} %` : ""
            }${
              key === "openai"
                ? ` (reste ${Math.round(100 - five.percent)} %)`
                : ""
            }${ageText(five.readAt, nowSec)}`;
        const tokenText = usage ? formatTokens(totals[key]) : "—";
        const width =
          fraction === undefined ? 0 : Math.round(fraction * BAR_W);

        return (
          <pixiContainer key={key} y={30 + index * 50}>
            <pixiText
              text={label}
              x={18}
              y={10}
              anchor={{ x: 0, y: 0.5 }}
              style={{
                fontFamily: MONO,
                fontSize: 14,
                fontWeight: "bold",
                fill: color,
              }}
              resolution={2}
            />

            <pixiText
              text={tokenText}
              x={312}
              y={10}
              anchor={{ x: 1, y: 0.5 }}
              style={{
                fontFamily: MONO,
                fontSize: Math.min(20, 144 / (tokenText.length * 0.65)),
                fontWeight: "bold",
                fill: "#F3F1EC",
              }}
              resolution={2}
            />

            <pixiGraphics
              x={BAR_X}
              y={BAR_Y}
              draw={(g: Graphics): void => {
                g.clear();
                g.roundRect(0, 0, BAR_W, BAR_H, 2).fill(0x2a2d33);

                if (fraction !== undefined && width > 0) {
                  g.roundRect(
                    0,
                    0,
                    width,
                    BAR_H,
                    Math.min(2, width / 2),
                  ).fill(color);
                }
              }}
            />

            <pixiText
              text={quotaText}
              x={312}
              y={36}
              anchor={{ x: 1, y: 0 }}
              style={{
                fontFamily: MONO,
                fontSize: 10,
                fill: "#8A8F98",
              }}
              resolution={2}
            />
          </pixiContainer>
        );
      })}

      <pixiText
        text={
          !usage
            ? "chargement…"
            : totals.unassigned > 0
              ? `Non attribué : ${formatTokens(totals.unassigned)}`
              : "Tokens du jour · quota journalier"
        }
        x={18}
        y={143}
        anchor={{ x: 0, y: 0.5 }}
        style={{
          fontFamily: MONO,
          fontSize: 10,
          fill: "#B7BEC9",
        }}
        resolution={2}
      />

      <pixiText
        text={`Café : ${coffeeCount}`}
        x={312}
        y={143}
        anchor={{ x: 1, y: 0.5 }}
        style={{
          fontFamily: MONO,
          fontSize: 10,
          fontWeight: "bold",
          fill: "#FF8A4C",
        }}
        resolution={2}
      />
    </pixiContainer>
  );
}
