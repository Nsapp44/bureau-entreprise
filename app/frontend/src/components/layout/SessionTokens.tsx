"use client";

import { useState, type ReactNode } from "react";
import { useSessionsUsage } from "@/hooks/useUsage";
import { formatTokens } from "@/utils/tokenFormat";
import { UsageTooltip } from "@/components/layout/UsageTooltip";

/** "3,4 M tokens" for one session, with hover detail. Hidden if unknown. */
export function SessionTokens({ sessionId }: { sessionId: string }): ReactNode {
  const all = useSessionsUsage();
  const [open, setOpen] = useState(false);
  const usage = all?.[sessionId];
  if (!usage?.totals || usage.totals.total <= 0) return null;
  return (
    <span
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {formatTokens(usage.totals.total)} tokens
      {open && <UsageTooltip usage={usage} align="left" />}
    </span>
  );
}
