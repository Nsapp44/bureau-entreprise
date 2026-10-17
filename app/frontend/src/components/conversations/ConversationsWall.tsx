"use client";

import { extend } from "@pixi/react";
import {
  CanvasTextMetrics,
  Container,
  Graphics,
  Text,
  TextStyle,
} from "pixi.js";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQuota, useTodayUsage } from "@/hooks/useUsage";
import type { ActiveConversation } from "@/types";
import { WallClock } from "../game/WallClock";
import { nowCounts } from "./conversationsLogic";
import {
  clip,
  conversationsTokensToday,
  identifyProvider,
  planOf,
  providerTotals,
  quotaRows,
  readAgeText,
  tokensLabel,
  tokensShort,
  type Provider,
} from "./wallLogic";

extend({ Container, Text, Graphics });

const FONT = "Consolas, 'Courier New', monospace";
const TEXT = "#F3F1EC";
const MUTED = "#B4ADA4";
const ATTN = "#FF5A3C";
const CLAUDE = "#FF8A4C";
const OPENAI = "#10A37F";
const PROVIDER_COLOR: Record<Provider, string> = {
  claude: CLAUDE,
  openai: OPENAI,
};

interface TProps {
  text: string;
  x: number;
  y: number;
  color?: string;
  size?: number;
  bold?: boolean;
  right?: boolean;
  center?: boolean;
  spacing?: number;
  alpha?: number;
}

/** Texte du mur : (x, y) = coin haut-gauche (ou droit / centre) de la ligne. */
function T({
  text,
  x,
  y,
  color = TEXT,
  size = 11,
  bold = false,
  right = false,
  center = false,
  spacing = 0,
  alpha = 1,
}: TProps): ReactNode {
  return (
    <pixiText
      text={text}
      x={x}
      y={y}
      alpha={alpha}
      anchor={{ x: right ? 1 : center ? 0.5 : 0, y: 0 }}
      resolution={2}
      style={{
        fontFamily: FONT,
        fontSize: size,
        fill: color,
        fontWeight: bold ? "bold" : "normal",
        letterSpacing: spacing,
      }}
    />
  );
}

function measure(
  text: string,
  size: number,
  bold: boolean,
  spacing: number,
): number {
  return Math.ceil(
    CanvasTextMetrics.measureText(
      text,
      new TextStyle({
        fontFamily: FONT,
        fontSize: size,
        fontWeight: bold ? "bold" : "normal",
        letterSpacing: spacing,
      }),
    ).width,
  );
}

/** Rectangle plein avec bordure intérieure (box-sizing: border-box). */
function box(
  g: Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: number,
  border?: number,
  bw = 0,
): void {
  if (border !== undefined && bw > 0) {
    g.rect(x, y, w, h).fill(border);
    g.rect(x + bw, y + bw, w - 2 * bw, h - 2 * bw).fill(fill);
  } else {
    g.rect(x, y, w, h).fill(fill);
  }
}

const SCREEN_BORDER = 0x716a61;
const SCREEN_BG = 0x161514;

function screen(
  g: Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  bw = 4,
): void {
  box(g, x, y, w, h, SCREEN_BG, SCREEN_BORDER, bw);
}

/** Contenu des bannières CONSO / EN CE MOMENT : décalées au-dessus des pièces pour libérer le mur au-dessus de la cafetière (x ~ 560-690). */
const CONSO_X = 700;
const NOW_X = 944;
/** Décalages x des bandeaux (répartis sur 1920 comme la maquette, cafetière x≈890 libre au-dessus : CONSO commence à x=960). */
const ABO_SHIFT = 195; // cadre ABONNEMENTS : x 427-727
const CONSO_SHIFT = 274; // cadre CONSO : x 960-1200
const NOW_SHIFT = 380; // cadre EN CE MOMENT : x 1310-1500

/** Bord gauche des casiers (à droite de l'ascenseur de l'ancien bureau). */
const LOCKER_X = 152;

/** Décor fixe du mur : casiers, plante, cadres des panneaux. */
function drawWallDecor(g: Graphics): void {
  g.clear();
  // Ascenseur et horloge : composants de l'ancien bureau (voir le rendu ci-dessous).
  // Casiers : 5 rangées de 2 tiroirs.
  box(g, LOCKER_X, 86, 76, 98, 0x3a4040, 0x272b2c, 2);
  for (let i = 0; i < 10; i++) {
    const dx = LOCKER_X + 2 + 4 + (i % 2) * 34;
    const dy = 88 + 4 + Math.floor(i / 2) * 18;
    box(g, dx, dy, 30, 16, 0x303536, 0x272b2c, 2);
    g.rect(dx + 2 + 9, dy + 2 + 5, 8, 2).fill(0x646d6d);
    if (i < 8) g.rect(dx + 2 + 2, dy + 2 + 2, 5, 4).fill(0xb4ada4);
  }
}

function drawFrameAbo(g: Graphics): void {
  g.clear();
  screen(g, 232, 16, 300, 156);
}

function drawFrameConso(g: Graphics): void {
  g.clear();
  screen(g, CONSO_X - 14, 16, 240, 156);
}

function drawFrameNow(g: Graphics): void {
  g.clear();
  screen(g, NOW_X - 14, 16, 190, 156);
}

/** Étagère murale du coin droit : dessinée dans un conteneur décalé de rightShift. */
function drawWallRight(g: Graphics): void {
  g.clear();
  // Étagère murale du coin droit : trophée, livres, mini-plante, imprimante 3D jouet.
  const shelfY = 118;
  g.rect(1156, shelfY, 100, 5).fill(0x8a6a44);
  g.rect(1156, shelfY + 5, 100, 2).fill(0x4a3822);
  g.rect(1162, shelfY + 7, 4, 10).fill(0x2c2a27);
  g.rect(1246, shelfY + 7, 4, 10).fill(0x2c2a27);
  // Trophée
  g.rect(1166, shelfY - 6, 12, 3).fill(0xffd23f);
  g.rect(1170, shelfY - 3, 4, 3).fill(0xffd23f);
  g.rect(1164, shelfY - 18, 16, 12).fill(0xffd23f);
  g.rect(1167, shelfY - 15, 3, 6).fill(0xfff1a8);
  // Livres
  g.rect(1190, shelfY - 24, 7, 24).fill(0xff6a13);
  g.rect(1197, shelfY - 20, 6, 20).fill(0x38d9f5);
  g.rect(1203, shelfY - 26, 8, 26).fill(0x43c35b);
  g.rect(1211, shelfY - 18, 6, 18).fill(0xb06bff);
  // Mini-plante
  g.rect(1228, shelfY - 8, 12, 8).fill(0xb45309);
  g.rect(1232, shelfY - 18, 4, 10).fill(0x22c55e);
  g.rect(1226, shelfY - 16, 6, 4).fill(0x22c55e);
  g.rect(1236, shelfY - 16, 6, 4).fill(0x22c55e);
  // Cadre au-dessus
  box(g, 1176, 46, 60, 40, 0x1c1f20, 0x8a6a44, 2);
  g.rect(1184, 54, 44, 24).fill(0x303c47);
  g.rect(1196, 62, 20, 8).fill(0xff6a13);
}

interface SignProps {
  text: string;
  x: number;
  y: number;
}

/** Enseigne : fond #161514, bordure 2 px, texte 10 px espacé de 1 px. */
function Sign({ text, x, y }: SignProps): ReactNode {
  const w = useMemo(() => measure(text, 10, false, 1), [text]);
  const draw = useCallback(
    (g: Graphics) => {
      g.clear();
      box(g, x, y, w + 12 + 4, 10 * 1.35 + 2 + 4, SCREEN_BG, SCREEN_BORDER, 2);
    },
    [x, y, w],
  );
  return (
    <pixiContainer>
      <pixiGraphics draw={draw} />
      <T text={text} x={x + 2 + 6} y={y + 2 + 1} size={10} spacing={1} />
    </pixiContainer>
  );
}

function Bar({
  x,
  y,
  w,
  fraction,
  color,
}: {
  x: number;
  y: number;
  w: number;
  fraction: number;
  color: number;
}): ReactNode {
  const draw = useCallback(
    (g: Graphics) => {
      g.clear();
      g.rect(x, y, w, 4).fill(0x393632);
      const fw = Math.round(w * Math.min(1, Math.max(0, fraction)));
      if (fw > 0) g.rect(x, y, fw, 4).fill(color);
    },
    [x, y, w, fraction, color],
  );
  return <pixiGraphics draw={draw} />;
}

function hex(color: string): number {
  return parseInt(color.slice(1), 16);
}

/** Pastille d'état : plein = actif, anneau = attente, pointillé = libre, « ! » = attention. */
function StateDot({
  kind,
  x,
  y,
  alpha = 1,
}: {
  kind: "att" | "on" | "wait" | "free";
  x: number;
  y: number;
  alpha?: number;
}): ReactNode {
  const draw = useCallback(
    (g: Graphics) => {
      g.clear();
      if (kind === "att") return;
      if (kind === "on") g.circle(x + 4.5, y + 4.5, 4.5).fill(hex(TEXT));
      else if (kind === "wait") {
        g.circle(x + 4.5, y + 4.5, 3.5).stroke({ width: 2, color: hex(TEXT) });
      } else {
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          g.rect(
            x + 4.5 + Math.cos(a) * 3.5 - 1,
            y + 4.5 + Math.sin(a) * 3.5 - 1,
            2,
            2,
          );
        }
        g.fill(0x8e8a84);
      }
    },
    [kind, x, y],
  );
  if (kind === "att") {
    return (
      <pixiContainer alpha={alpha}>
        <pixiGraphics
          draw={(g: Graphics) => {
            g.clear();
            g.roundRect(x, y - 1, 13, 13, 2).fill(hex(ATTN));
          }}
        />
        <T text="!" x={x + 6.5} y={y - 1} color="#161514" bold center />
      </pixiContainer>
    );
  }
  return (
    <pixiContainer alpha={alpha}>
      <pixiGraphics draw={draw} />
    </pixiContainer>
  );
}

export interface ConversationsWallProps {
  conversations: ActiveConversation[];
  totalDesks: number;
  /** Décalage x (2 * side) des bandeaux de droite, collés au bord droit. */
  rightShift?: number;
}

export function ConversationsWall({
  conversations,
  totalDesks,
  rightShift = 0,
}: ConversationsWallProps): ReactNode {
  const usage = useTodayUsage();
  const readings = useQuota();
  const [now, setNow] = useState(() => new Date());
  const [blinkOff, setBlinkOff] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const counts = useMemo(
    () => nowCounts(conversations, totalDesks),
    [conversations, totalDesks],
  );
  const hasAttention = counts.needsYou > 0;
  useEffect(() => {
    if (!hasAttention) return;
    const id = setInterval(() => setBlinkOff((b) => !b), 500);
    return () => {
      clearInterval(id);
      setBlinkOff(false);
    };
  }, [hasAttention]);

  const nowSec = Math.floor(now.getTime() / 1000);
  const totals = useMemo(() => providerTotals(usage), [usage]);
  const convTokens = useMemo(
    () => conversationsTokensToday(conversations),
    [conversations],
  );
  const who = useMemo(
    () =>
      conversations
        .filter((c) => c.status === "needs_you")
        .map((c) => c.title || "Sans titre")
        .join(", "),
    [conversations],
  );

  // --- ABONNEMENTS : contenu à (246, 28) ---
  const openaiConnected =
    (readings ?? []).some((r) => r.account === "chatgpt") || totals.openai > 0;
  const openaiSessions = conversations.filter(
    (c) => identifyProvider(c.model ?? "") === "openai",
  ).length;
  const providers = openaiConnected
    ? (["claude", "openai"] as const)
    : (["claude"] as const);
  const subs = providers.map((p, i) => ({
    p,
    rows: quotaRows(readings, p, nowSec),
    plan: planOf(readings, p),
    titleY: i === 0 ? 49 : 102,
  }));
  const anyQuota = subs.some((s) => s.rows.some((r) => r.known));

  // --- CONSO : contenu à (CONSO_X = 700, 28), + rightShift ---
  const split = totals.claude + totals.openai;
  const frac = (n: number): number => (split > 0 ? n / split : 0);

  const blinkAlpha = blinkOff ? 0.25 : 1;

  return (
    <pixiContainer>
      <pixiGraphics draw={drawWallDecor} />

      <Sign text="BUREAU GÉNÉRAL" x={24} y={12} />
      {/* Même horloge que l'ancien bureau (analogique / numérique au clic), réduite à 0,7. */}
      <pixiContainer x={LOCKER_X + 38} y={36} scale={0.7}>
        <WallClock />
      </pixiContainer>
      <Sign text="DOSSIERS" x={LOCKER_X + 6} y={68} />

      {/* ABONNEMENTS */}
      <pixiContainer x={ABO_SHIFT}>
      <pixiGraphics draw={drawFrameAbo} />
      <T text="ABONNEMENTS" x={246} y={28} color={MUTED} bold spacing={1} />
      <T
        text={readAgeText(readings, nowSec)}
        x={518}
        y={28}
        color={MUTED}
        right
      />
      {!anyQuota && (
        <T
          text={
            readings === null ? "Lecture en cours…" : "Aucune lecture de quota"
          }
          x={246}
          y={49}
          color={MUTED}
        />
      )}
      {subs.map(({ p, rows, plan, titleY }) => (
        <pixiContainer key={p}>
          <T
            text={`${p === "claude" ? "CLAUDE" : "OPENAI"}${plan ? ` · ${plan}` : ""}`}
            x={246}
            y={titleY}
            color={PROVIDER_COLOR[p]}
          />
          {rows.map((r, j) => {
            const y = titleY + 17 + j * 17;
            return (
              <pixiContainer key={r.window}>
                <T text={r.label} x={246} y={y + 1} color={MUTED} />
                <Bar
                  x={278}
                  y={y + 6}
                  w={156}
                  fraction={r.fraction}
                  color={hex(PROVIDER_COLOR[p])}
                />
                <T text={r.text} x={440} y={y + 1} />
              </pixiContainer>
            );
          })}
        </pixiContainer>
      ))}
      </pixiContainer>

      <pixiContainer x={rightShift}>
        <pixiGraphics draw={drawWallRight} />
      </pixiContainer>

      <pixiContainer x={CONSO_SHIFT}>
      <pixiGraphics draw={drawFrameConso} />
      {/* CONSO */}
      <T text="CONSO" x={CONSO_X} y={28} color={MUTED} bold spacing={1} />
      <T text="aujourd'hui" x={CONSO_X + 212} y={28} color={MUTED} right />
      <T text={tokensShort(convTokens)} x={CONSO_X} y={55} size={18} bold />
      {providers.map((p, i) => (
        <pixiContainer key={p}>
          <T
            text={p === "claude" ? "Claude" : "OpenAI"}
            x={CONSO_X}
            y={82 + i * 17}
            color={PROVIDER_COLOR[p]}
          />
          <Bar
            x={CONSO_X + 58}
            y={87 + i * 17}
            w={104}
            fraction={frac(totals[p])}
            color={hex(PROVIDER_COLOR[p])}
          />
          <T
            text={usage ? tokensLabel(totals[p]) : "—"}
            x={CONSO_X + 168}
            y={82 + i * 17}
          />
        </pixiContainer>
      ))}

      </pixiContainer>

      <pixiContainer x={NOW_SHIFT}>
      <pixiGraphics draw={drawFrameNow} />
      {/* EN CE MOMENT */}
      <T text="EN CE MOMENT" x={NOW_X} y={28} color={MUTED} bold spacing={1} />
      <T
        text={`${conversations.length} conv.`}
        x={NOW_X + 162}
        y={28}
        color={MUTED}
        right
      />
      {(
        [
          ["att", counts.needsYou, "besoin de toi"],
          ["on", counts.working, "actives"],
          ["wait", counts.waiting, "en attente"],
          ["free", counts.freeDesks, "postes libres"],
        ] as const
      ).map(([kind, n, label], i) => {
        const y = 49 + i * 19;
        const iconW = kind === "att" ? 13 : 9;
        const numRight = NOW_X + iconW + 8 + 18;
        const alpha = kind === "att" && n > 0 ? blinkAlpha : 1;
        return (
          <pixiContainer key={kind}>
            <StateDot kind={kind} x={NOW_X} y={y + 3} alpha={alpha} />
            <T text={String(n)} x={numRight} y={y + 1} bold right />
            <T text={label} x={numRight + 8} y={y + 1} />
          </pixiContainer>
        );
      })}
      {who && <T text={`! ${clip(who, 26)}`} x={NOW_X} y={126} color={ATTN} />}
      {openaiConnected && (
        <>
          <T
            text={`Claude ${conversations.length - openaiSessions}`}
            x={NOW_X}
            y={146}
            color={PROVIDER_COLOR.claude}
          />
          <T
            text={`OpenAI ${openaiSessions}`}
            x={NOW_X + 90}
            y={146}
            color={PROVIDER_COLOR.openai}
          />
        </>
      )}
      </pixiContainer>
    </pixiContainer>
  );
}
