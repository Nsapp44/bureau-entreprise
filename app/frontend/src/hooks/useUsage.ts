"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/utils/api";
import type { TokenTotals, UsageBreakdown } from "@/utils/tokenFormat";

const REFRESH_MS = 60_000;

export interface TodayUsage extends UsageBreakdown {
  date: string;
  /** Tous les tokens consommés, cumulés sur tous les transcripts. */
  allTime?: TokenTotals;
}

/** Small shared polling store: one request per path, N subscribers. */
function createPoller<T>(
  path: string,
  refreshMs = REFRESH_MS,
  transform?: (d: T) => T,
) {
  let data: T | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  const subs = new Set<(d: T | null) => void>();

  const load = async (): Promise<void> => {
    try {
      const res = await apiFetch(path);
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as T;
      data = transform ? transform(json) : json;
    } catch {
      data = null; // route missing / backend down: hide the UI
    }
    subs.forEach((s) => s(data));
  };

  return {
    reload: load,
    subscribe(cb: (d: T | null) => void): () => void {
      subs.add(cb);
      cb(data);
      if (subs.size === 1) {
        void load();
        timer = setInterval(() => void load(), refreshMs);
      }
      return () => {
        subs.delete(cb);
        if (subs.size === 0 && timer) {
          clearInterval(timer);
          timer = null;
        }
      };
    },
  };
}

function usePoller<T>(poller: ReturnType<typeof createPoller<T>>): T | null {
  const [value, setValue] = useState<T | null>(null);
  useEffect(() => poller.subscribe(setValue), [poller]);
  return value;
}

const todayPoller = createPoller<TodayUsage>("/api/v1/usage/today");
const sessionsPoller = createPoller<Record<string, UsageBreakdown>>(
  "/api/v1/usage/sessions",
);

export function useTodayUsage(): TodayUsage | null {
  return usePoller(todayPoller);
}

export function useSessionsUsage(): Record<string, UsageBreakdown> | null {
  return usePoller(sessionsPoller);
}

export interface CurrentContext {
  sessionId: string | null;
  /** Tokens relus par le dernier message de la session la plus récente. */
  context: number;
  level: "ok" | "heavy" | "critical";
  updatedAt: number | null;
}

const currentPoller = createPoller<CurrentContext>(
  "/api/v1/usage/current",
  15_000,
);

/** Taille de contexte de la session active (seuils 60 k / 110 k côté backend). */
export function useCurrentContext(): CurrentContext | null {
  return usePoller(currentPoller);
}

export interface LimitWindow {
  used_percentage: number;
  resets_at: number | null;
  /** Estimated error in points (absent on a plain real reading). */
  margin?: number;
}

export interface RateLimits {
  five_hour?: LimitWindow;
  seven_day?: LimitWindow;
  updated_at?: number;
  /** Minutes since the file was written (computed client-side). */
  age_min?: number;
}

/** Drop windows whose reset time has passed (a fresh window is unknown). */
function dropExpired(d: RateLimits): RateLimits {
  const now = Date.now() / 1000;
  const live = (w?: LimitWindow): LimitWindow | undefined =>
    w && (w.resets_at === null || w.resets_at > now) ? w : undefined;
  const age_min = d.updated_at
    ? Math.max(0, Math.floor((now - d.updated_at) / 60))
    : undefined;
  return {
    ...d,
    five_hour: live(d.five_hour),
    seven_day: live(d.seven_day),
    age_min,
  };
}

const limitsPoller = createPoller<RateLimits>(
  "/api/v1/usage/limits",
  20_000,
  dropExpired,
);

/** 5h / 7-day subscription usage, as last reported by the status line script. */
export function useRateLimits(): RateLimits | null {
  return usePoller(limitsPoller);
}

export interface QuotaReading {
  account: "claude" | "chatgpt";
  window: "5h" | "7j";
  /** Percent USED (official reading, never estimated). */
  percent: number;
  /** Epoch seconds; null when unknown. */
  resetsAt: number | null;
  /** Epoch seconds of the reading. */
  readAt: number | null;
  source: string;
  plan?: string | null;
}

const quotaPoller = createPoller<QuotaReading[]>("/api/v1/usage/quota", 20_000);

/** Last official 5 h / 7 d meters per account, with the age of each reading. */
export function useQuota(): QuotaReading[] | null {
  return usePoller(quotaPoller);
}

export type { TokenTotals, UsageBreakdown };
