"use client";

/**
 * StarMode - Mode 1: le prénom de l'agent qui a le plus travaillé aujourd'hui,
 * avec le classement des suivants (temps passé en « working » / « thinking »).
 */

import { useMemo, type ReactNode } from "react";
import {
  formatDuration,
  ranking,
  topWorker,
  type WorkLog,
} from "@/systems/workTracker";

export interface StarModeProps {
  log: WorkLog;
}

const MONO = '"Courier New", monospace';
const MEDALS = ["🥈", "🥉"];

export function StarMode({ log }: StarModeProps): ReactNode {
  const star = useMemo(() => topWorker(log), [log]);
  const others = useMemo(() => ranking(log).slice(1, 3), [log]);

  return (
    <pixiContainer>
      <pixiText
        text="⭐ A LE PLUS BOSSÉ AUJOURD'HUI ⭐"
        x={165}
        y={5}
        anchor={0.5}
        style={{
          fontFamily: MONO,
          fontSize: 11,
          fontWeight: "bold",
          fill: "#FF8A4C",
        }}
        resolution={2}
      />

      {star ? (
        <>
          <pixiText
            text={star.name.toUpperCase()}
            x={165}
            y={52}
            anchor={0.5}
            style={{
              fontFamily: MONO,
              fontSize: 34,
              fontWeight: "bold",
              fill: "#F3F1EC",
            }}
            resolution={2}
          />
          <pixiText
            text={`${formatDuration(star.seconds)} de travail`}
            x={165}
            y={82}
            anchor={0.5}
            style={{ fontFamily: MONO, fontSize: 12, fill: "#FF8A4C" }}
            resolution={2}
          />
          {others.map((o, i) => (
            <pixiText
              key={o.name}
              text={`${MEDALS[i]} ${o.name} · ${formatDuration(o.seconds)}`}
              x={165}
              y={108 + i * 16}
              anchor={0.5}
              style={{ fontFamily: MONO, fontSize: 11, fill: "#B7BEC9" }}
              resolution={2}
            />
          ))}
        </>
      ) : (
        <pixiText
          text="personne n'a encore bossé"
          x={165}
          y={70}
          anchor={0.5}
          style={{ fontFamily: MONO, fontSize: 11, fill: "#8A8F98" }}
          resolution={2}
        />
      )}
    </pixiContainer>
  );
}
