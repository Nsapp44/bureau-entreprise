/**
 * EventLog - Journal panel
 *
 * Displays event history from the unified Zustand store as one readable
 * French sentence per event. Entries are clickable to open a detail modal.
 * A "Détails techniques" toggle restores hidden events and the raw format.
 */

"use client";

import { useMemo, useState } from "react";
import {
  useGameStore,
  selectEventLog,
  type EventLogEntry,
} from "@/stores/gameStore";
import { format } from "date-fns";
import { Terminal } from "lucide-react";
import { EventDetailModal } from "@/components/game/EventDetailModal";
import { getEventTypeTextColor } from "@/utils/event-type-styles";
import { buildEventPhrase } from "@/utils/eventPhrases";

type Filter = "all" | "boss" | "agents";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Tout" },
  { id: "boss", label: "Boss" },
  { id: "agents", label: "Agents" },
];

function hasNonEmptyDetail(event: EventLogEntry): boolean {
  return !!event.detail && Object.keys(event.detail).length > 0;
}

export function EventLog() {
  const eventLog = useGameStore(selectEventLog);
  const agents = useGameStore((s) => s.agents);
  const [selectedEvent, setSelectedEvent] = useState<EventLogEntry | null>(
    null,
  );
  const [filter, setFilter] = useState<Filter>("all");
  const [technical, setTechnical] = useState(false);

  const rows = useMemo(
    () =>
      eventLog
        .map((event) => ({
          event,
          phrase: buildEventPhrase(event, agents.get(event.agentId)),
        }))
        .filter(({ phrase }) => {
          if (technical) return true;
          if (phrase.hidden) return false;
          if (filter === "boss") return phrase.isBoss;
          if (filter === "agents")
            return phrase.actor !== null && !phrase.isBoss;
          return true;
        }),
    [eventLog, agents, filter, technical],
  );

  return (
    <>
      <div className="flex flex-col h-full bg-slate-950 border border-slate-800 rounded-lg overflow-hidden font-mono text-xs">
        <div className="bg-slate-900 px-3 py-2 border-b border-slate-800 flex flex-col gap-2 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-300 font-bold uppercase tracking-wider">
              <Terminal size={14} className="text-orange-500" />
              Journal
            </div>
            <div className="text-slate-400">{rows.length}</div>
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                aria-pressed={!technical && filter === f.id}
                disabled={technical}
                className={`px-3 min-h-8 rounded text-[11px] font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  !technical && filter === f.id
                    ? "bg-orange-500/20 text-orange-400"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {f.label}
              </button>
            ))}
            <label className="ml-auto flex items-center gap-1 min-h-8 text-[11px] text-slate-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={technical}
                onChange={(e) => setTechnical(e.target.checked)}
                className="accent-orange-500"
              />
              Détails techniques
            </label>
          </div>
          {technical && (
            <p className="text-[11px] text-slate-400">
              Mode technique : tous les événements sont affichés, filtres
              désactivés.
            </p>
          )}
        </div>

        <div className="flex-grow overflow-y-auto p-2 space-y-1">
          {rows.length === 0 ? (
            <div className="text-slate-600 italic p-4 text-center">
              En attente d&apos;événements...
            </div>
          ) : (
            rows.map(({ event, phrase }, index) => (
              <div
                key={`${event.id}-${index}`}
                role="button"
                tabIndex={0}
                className="hover:bg-white/5 px-2 py-1.5 rounded transition-colors group border-l-2 border-slate-700 cursor-pointer hover:border-slate-500"
                onClick={() => setSelectedEvent(event)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedEvent(event);
                  }
                }}
              >
                {technical ? (
                  <>
                    <div className="flex gap-2 items-center">
                      <span className="text-slate-400 flex-shrink-0 tabular-nums">
                        {format(event.timestamp, "HH:mm:ss")}
                      </span>
                      <span
                        className={`flex-shrink-0 font-bold text-[10px] ${getEventTypeTextColor(event.type)}`}
                      >
                        [{event.type.replace(/_/g, " ").toUpperCase()}]
                      </span>
                      {event.agentId && (
                        <span className="text-blue-400 text-[10px]">
                          @{event.agentId.slice(0, 8)}...
                        </span>
                      )}
                      {hasNonEmptyDetail(event) && (
                        <span className="ml-auto text-slate-600 group-hover:text-slate-400 transition-colors text-[10px]">
                          ›
                        </span>
                      )}
                    </div>
                    <div className="text-slate-300 break-words text-[11px]">
                      {event.summary}
                    </div>
                  </>
                ) : (
                  <div className="flex gap-2 items-start">
                    <span className="text-slate-400 flex-shrink-0 tabular-nums">
                      {format(event.timestamp, "HH:mm:ss")}
                    </span>
                    <span className="flex-shrink-0">{phrase.icon}</span>
                    <span className="text-slate-300 text-[11px] break-words min-w-0">
                      {phrase.actor && (
                        <>
                          <span
                            className="font-bold"
                            style={
                              phrase.actorColor
                                ? { color: phrase.actorColor }
                                : undefined
                            }
                          >
                            {phrase.actor}
                          </span>
                          {phrase.actorModel && (
                            <span
                              style={{
                                color: phrase.actorModelColor ?? undefined,
                              }}
                            >
                              {" · "}
                              {phrase.actorModel}
                            </span>
                          )}{" "}
                        </>
                      )}
                      {phrase.text}
                    </span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </>
  );
}
