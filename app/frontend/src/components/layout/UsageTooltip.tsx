"use client";

import type { ReactNode } from "react";
import { formatModelLabel } from "@/utils/modelLabel";
import {
  formatTokensFull,
  type UsageBreakdown,
} from "@/utils/tokenFormat";

/** Hover detail card: input/output/cache + one line per model. */
export function UsageTooltip({
  usage,
  align = "right",
}: {
  usage: UsageBreakdown;
  align?: "left" | "right";
}): ReactNode {
  const t = usage.totals;
  const rows: [string, number][] = [
    ["Entrée", t.input],
    ["Sortie", t.output],
    ["Cache lu", t.cacheRead],
    ["Cache écrit", t.cacheWrite],
  ];
  const models = Object.entries(usage.byModel ?? {});
  return (
    <div
      className={`absolute top-full mt-1 z-[80] min-w-[200px] rounded-md border border-slate-700 bg-slate-900 p-2 text-[11px] text-slate-300 shadow-xl pointer-events-none ${
        align === "right" ? "right-0" : "left-0"
      }`}
    >
      {rows.map(([label, v]) => (
        <div key={label} className="flex justify-between gap-4 font-mono">
          <span className="text-slate-500">{label}</span>
          <span>{formatTokensFull(v)}</span>
        </div>
      ))}
      {models.length > 0 && (
        <div className="mt-1 pt-1 border-t border-slate-700">
          {models.map(([id, m]) => (
            <div key={id} className="flex justify-between gap-4 font-mono">
              <span className="text-slate-500">
                {formatModelLabel(id) ?? id}
              </span>
              <span>{formatTokensFull(m.total)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
