"use client";

import { useState, type ReactNode } from "react";
import { useTodayUsage } from "@/hooks/useUsage";
import { formatTokens } from "@/utils/tokenFormat";
import { UsageTooltip } from "@/components/layout/UsageTooltip";

/** Header badge: tokens consumed today, hidden if the route is unavailable. */
export function TodayUsageBadge(): ReactNode {
  const usage = useTodayUsage();
  const [open, setOpen] = useState(false);
  if (!usage?.totals) return null;
  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <div className="flex items-center whitespace-nowrap px-3 py-1.5 bg-white/5 text-slate-200 border border-white/10 rounded-[6px] text-xs font-semibold font-mono">
        <span className="hidden xl:inline">Aujourd&apos;hui : </span>
        {formatTokens(usage.totals.total)}
        {usage.allTime && (
          <span className="hidden 2xl:inline ml-2 pl-2 border-l border-white/15 text-slate-300">
            Cumulé : {formatTokens(usage.allTime.total)}
          </span>
        )}
      </div>
      {open && <UsageTooltip usage={usage} />}
    </div>
  );
}
