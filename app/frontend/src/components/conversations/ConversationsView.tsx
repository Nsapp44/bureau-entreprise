"use client";

import { useCallback, useMemo, useState } from "react";
import { useOverviewWebSocket } from "@/hooks/useOverviewWebSocket";
import { useOverviewStore } from "@/stores/overviewStore";
import { useNavigationStore } from "@/stores/navigationStore";
import type { Session } from "@/hooks/useSessions";
import type { ActiveConversation } from "@/types";
import { sessionMatchesFloor } from "@/utils/sessionMatchesFloor";
import { requestDeleteInApp, requestOpenInApp } from "./openConversation";
import { assignDeskSlots } from "./conversationsLogic";
import { ConversationsScene } from "./ConversationsScene";

/**
 * Main desk: one desk per active conversation. A conversation keeps its desk
 * number (slots kept in a ref) while it stays in the list.
 */
export interface ConversationsViewProps {
  sessions: Session[];
  onSessionSelect: (id: string) => Promise<void>;
  /** Short message (toast) shown to the user. */
  onNotify: (text: string, type?: "info" | "error" | "success") => void;
}

export function ConversationsView({
  sessions,
  onSessionSelect,
  onNotify,
}: ConversationsViewProps): React.ReactNode {
  useOverviewWebSocket({ enabled: true });
  const conversations = useOverviewStore((s) => s.conversations);
  // Already-loaded conversations (store filled before this view mounted) get their desks at once.
  const [slots, setSlots] = useState<Map<string, number>>(() =>
    assignDeskSlots(
      new Map(),
      conversations.map((c) => c.sessionId),
    ),
  );
  const [seen, setSeen] = useState(conversations);

  // Derive the slots during render (a conversation keeps its desk number).
  if (seen !== conversations) {
    setSeen(conversations);
    setSlots(
      assignDeskSlots(
        slots,
        conversations.map((c) => c.sessionId),
      ),
    );
  }

  const { occupied, totalDesks, deskBySession } = useMemo(() => {
    // assignDeskSlots is 0-based; the scene is 1-based.
    const nums = new Set<number>();
    const bySession = new Map<string, number>();
    let max = 0;
    for (const [id, s] of slots) {
      nums.add(s + 1);
      bySession.set(id, s + 1);
      if (s + 1 > max) max = s + 1;
    }
    return {
      occupied: nums,
      deskBySession: bySession,
      totalDesks: Math.max(16, Math.ceil(max / 4) * 4),
    };
  }, [slots]);

  // Same navigation as the building drill-in (logic copied, not imported):
  // select the session, then land in its floor or the single office view.
  const handleOpen = useCallback(
    async (conv: ActiveConversation) => {
      if (conv.appSessionId) {
        void requestOpenInApp(conv.sessionId).then((msg) => {
          if (msg) onNotify(msg, "error");
        });
      }
      const sid = conv.sessionId;
      await onSessionSelect(sid);
      const nav = useNavigationStore.getState();
      const session = sessions.find((s) => s.id === sid);
      const floor = session
        ? nav.buildingConfig?.floors.find((f) =>
            sessionMatchesFloor(session, f),
          )
        : undefined;
      if (floor) {
        nav.goToFloor(floor.id);
      } else {
        nav.goToSingle();
      }
    },
    [onSessionSelect, onNotify, sessions],
  );

  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const handleDelete = useCallback(
    async (conv: ActiveConversation) => {
      if (!conv.appSessionId) return;
      if (
        !window.confirm(
          "Supprimer cette conversation dans l'appli Claude ? Elle sera déplacée dans la corbeille de l'appli.",
        )
      )
        return;
      const msg = await requestDeleteInApp(conv.sessionId);
      if (msg) {
        onNotify(msg, "error");
        return;
      }
      setHiddenIds((prev) => new Set(prev).add(conv.sessionId));
    },
    [onNotify],
  );
  const shown = conversations.filter(
    (c) => c.appSessionId && !hiddenIds.has(c.sessionId),
  );

  return (
    <div className="relative flex-grow min-h-0 border border-slate-800 rounded-lg bg-slate-900 overflow-hidden">
      <ConversationsScene
        occupied={occupied}
        conversations={conversations.filter((c) => !hiddenIds.has(c.sessionId))}
        deskBySession={deskBySession}
        totalDesks={totalDesks}
        onOpen={handleOpen}
      />
      {shown.length > 0 && (
        <details
          className="absolute top-2 right-2 z-10 text-xs"
          style={{ backgroundColor: "#0f172a", color: "#e2e8f0" }}
        >
          <summary
            className="cursor-pointer px-2 py-1 rounded border border-slate-700"
            style={{ backgroundColor: "#0f172a", color: "#94a3b8" }}
          >
            Supprimer…
          </summary>
          <ul
            className="mt-1 max-h-64 overflow-y-auto rounded border border-slate-700"
            style={{ backgroundColor: "#0f172a" }}
          >
            {shown.map((c) => (
              <li
                key={c.sessionId}
                className="flex items-center gap-2 px-2 py-1 max-w-64"
                style={{ color: "#e2e8f0" }}
              >
                <span className="truncate flex-grow">
                  {c.title || c.sessionId}
                </span>
                <button
                  type="button"
                  title="Supprimer cette conversation"
                  aria-label="Supprimer cette conversation"
                  className="px-1 rounded"
                  style={{ backgroundColor: "#1e293b", color: "#f87171" }}
                  onClick={() => void handleDelete(c)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
