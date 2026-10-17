"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/utils/api";

export interface ServerCapabilities {
  /** Backend exposes the shutdown endpoint. */
  shutdownAvailable: boolean;
  /** Backend can focus a terminal window (false on Windows or on error). */
  focusAvailable: boolean;
  /** Backend can bring the Claude app window to the foreground. */
  appFocus: boolean;
}

const DEFAULT_CAPABILITIES: ServerCapabilities = {
  shutdownAvailable: false,
  focusAvailable: false,
  appFocus: false,
};

// Module-level cache: the endpoint is queried once per page load.
let cached: ServerCapabilities | null = null;
let pending: Promise<ServerCapabilities> | null = null;

function loadCapabilities(): Promise<ServerCapabilities> {
  if (cached) return Promise.resolve(cached);
  if (!pending) {
    pending = apiFetch("/api/v1/shutdown/available")
      .then((res) => (res.ok ? res.json() : {}))
      .then((data: { available?: boolean; focus?: boolean; appFocus?: boolean }) => {
        cached = {
          shutdownAvailable: data.available === true,
          focusAvailable: data.focus === true,
          appFocus: data.appFocus === true,
        };
        return cached;
      })
      .catch(() => {
        cached = DEFAULT_CAPABILITIES;
        return cached;
      });
  }
  return pending;
}

/** Reads the backend capabilities once (cached) and exposes them. */
export function useServerCapabilities(): ServerCapabilities {
  const [caps, setCaps] = useState<ServerCapabilities>(
    cached ?? DEFAULT_CAPABILITIES,
  );

  useEffect(() => {
    let cancelled = false;
    void loadCapabilities().then((c) => {
      if (!cancelled) setCaps(c);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return caps;
}
