"use client";

import { useEffect, useCallback, useRef, useState, type ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import { useAttentionStore, type UrgencyLevel } from "@/stores/attentionStore";
import { useGameStore } from "@/stores/gameStore";
import { useServerCapabilities } from "@/hooks/useServerCapabilities";
import { apiFetch } from "@/utils/api";

const URGENCY_COLORS: Record<UrgencyLevel, string> = {
  critical: "border-red-500 bg-red-950/90 text-red-400",
  high: "border-orange-500 bg-orange-950/90 text-orange-400",
  low: "border-green-500 bg-green-950/90 text-green-400",
  info: "border-blue-500 bg-blue-950/90 text-blue-400",
};

const URGENCY_ICONS: Record<UrgencyLevel, string> = {
  critical: "\u26A0\uFE0F",
  high: "\uD83D\uDD34",
  low: "\u2705",
  info: "\uD83D\uDD35",
};

export default function AttentionToasts(): ReactNode {
  const toasts = useAttentionStore(
    useShallow((s) => s.toastQueue.filter((t) => !t.dismissed)),
  );
  const dismissToast = useAttentionStore((s) => s.dismissToast);
  const openFocusPopup = useAttentionStore((s) => s.openFocusPopup);
  const { appFocus } = useServerCapabilities();

  const handleToastClick = useCallback(
    (toast: (typeof toasts)[number]) => {
      // Only open the popup for a known agent (or the boss); background-task
      // toasts carry "main", which would show an empty card.
      const id = toast.agentId;
      if (id && (id === "boss" || useGameStore.getState().agents.has(id))) {
        openFocusPopup(id, window.innerWidth / 2, 120);
      }
      dismissToast(toast.id);
    },
    [dismissToast, openFocusPopup],
  );

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-16 right-4 z-50 flex flex-col gap-2 w-80 pointer-events-none">
      {toasts.slice(0, 5).map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          appFocus={appFocus}
          onClick={() => handleToastClick(toast)}
          onDismiss={() => dismissToast(toast.id)}
        />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  appFocus,
  onClick,
  onDismiss,
}: {
  appFocus: boolean;
  toast: {
    id: string;
    eventType: string;
    urgencyLevel: UrgencyLevel;
    agentName: string | null;
    title: string;
    description: string;
    autoDismissMs: number | null;
  };
  onClick: () => void;
  onDismiss: () => void;
}): ReactNode {
  const colorClass = URGENCY_COLORS[toast.urgencyLevel];
  const icon = URGENCY_ICONS[toast.urgencyLevel];
  const headline = toast.agentName ?? toast.title;
  const canOpenApp = appFocus && toast.eventType === "permission_request";
  const [notFound, setNotFound] = useState(false);

  const openApp = (): void => {
    void apiFetch("/api/v1/app/focus", { method: "POST" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { status?: string } | null) => {
        if (data?.status === "not_found") setNotFound(true);
      })
      .catch(() => undefined);
  };

  // onDismiss is a new function on every parent render; keep it in a ref so the
  // timer is not restarted (otherwise frequent re-renders keep toasts forever).
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  });
  useEffect(() => {
    if (toast.autoDismissMs === null) return;
    const timer = setTimeout(() => onDismissRef.current(), toast.autoDismissMs);
    return () => clearTimeout(timer);
  }, [toast.autoDismissMs, toast.id]);

  return (
    <div
      className={`pointer-events-auto flex items-start gap-2 px-3 py-2 rounded-lg border cursor-pointer animate-in slide-in-from-right-2 duration-300 ${colorClass}`}
      onClick={() => {
        // Permission toasts stay until dismissed so a "not found" hint is seen.
        if (canOpenApp) openApp();
        else onClick();
      }}
      role="alert"
    >
      <span className="text-sm shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold truncate">{headline}</p>
        {toast.description && (
          <p className="text-[11px] opacity-80 truncate">{toast.description}</p>
        )}
        {canOpenApp && (
          <p className="text-[10px] underline opacity-70">
            {notFound ? "Appli Claude introuvable" : "Ouvrir Claude"}
          </p>
        )}
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDismiss();
        }}
        className="text-xs opacity-50 hover:opacity-100 shrink-0"
        aria-label="Dismiss"
      >
        {"\u2715"}
      </button>
    </div>
  );
}
