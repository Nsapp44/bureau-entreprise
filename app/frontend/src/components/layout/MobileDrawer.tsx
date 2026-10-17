"use client";

import {
  History,
  Radio,
  PauseCircle,
  Play,
  RefreshCw,
  Trash2,
  X,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR as dateFnsPtBR, es as dateFnsEs } from "date-fns/locale";
import { GitStatusPanel } from "@/components/layout/GitStatusPanel";
import { EventLog } from "@/components/layout/EventLog";
import { useTranslation } from "@/hooks/useTranslation";
import type { Session } from "@/hooks/useSessions";
import { useOpenFolders } from "@/hooks/useOpenFolders";
import { useNow } from "@/hooks/useNow";
import {
  folderLabel,
  groupSessionsByProject,
  isLive,
} from "@/utils/sessionGroups";

// ============================================================================
// TYPES
// ============================================================================

interface MobileDrawerProps {
  isOpen: boolean;
  sessions: Session[];
  sessionsLoading: boolean;
  sessionId: string;
  onClose: () => void;
  onSessionSelect: (id: string) => Promise<void>;
  onSimulate: () => Promise<void>;
  onReset: () => void;
  onClearDB: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Mobile full-screen slide-out drawer that contains session controls, the
 * session list, git status, and event log. Rendered only on mobile viewports.
 * The backdrop click closes the drawer.
 */
export function MobileDrawer({
  isOpen,
  sessions,
  sessionsLoading,
  sessionId,
  onClose,
  onSessionSelect,
  onSimulate,
  onReset,
  onClearDB,
}: MobileDrawerProps): React.ReactNode {
  const { t, language } = useTranslation();
  const dateFnsLocale =
    language === "pt-BR"
      ? dateFnsPtBR
      : language === "es"
        ? dateFnsEs
        : undefined;

  const { isOpen: isFolderOpen, toggle: toggleFolder } = useOpenFolders();
  const now = useNow();

  if (!isOpen) return null;

  const handleSimulate = async (): Promise<void> => {
    await onSimulate();
    onClose();
  };

  const handleReset = (): void => {
    onReset();
    onClose();
  };

  const handleClearDB = (): void => {
    onClearDB();
    onClose();
  };

  const groups = groupSessionsByProject(sessions, now);

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="absolute left-0 top-0 bottom-0 w-80 bg-slate-900 border-r border-slate-800 overflow-y-auto animate-in slide-in-from-left duration-300">
        <div className="p-4">
          {/* Drawer Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">{t("mobile.menu")}</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-800 rounded-lg text-slate-400"
            >
              <X size={20} />
            </button>
          </div>

          {/* Mobile Controls */}
          <div className="flex flex-col gap-2 mb-6">
            <button
              onClick={handleSimulate}
              className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 rounded text-sm font-bold transition-colors"
            >
              <Play size={16} fill="currentColor" />
              {t("header.simulate")}
            </button>
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/30 rounded text-sm font-bold transition-colors"
            >
              <RefreshCw size={16} />
              {t("header.reset")}
            </button>
            <button
              onClick={handleClearDB}
              className="flex items-center gap-2 px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30 rounded text-sm font-bold transition-colors"
            >
              <Trash2 size={16} />
              {t("header.clearDb")}
            </button>
          </div>

          {/* Sessions Panel */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <History size={14} className="text-purple-500" />
              <span className="text-slate-300 font-bold uppercase tracking-wider text-xs">
                {t("sessions.title")}
              </span>
              <span className="text-slate-600 text-xs">
                ({sessions.length})
              </span>
            </div>
            <div className="flex flex-col gap-1 max-h-60 overflow-y-auto">
              {sessionsLoading && sessions.length === 0 ? (
                <div className="p-4 text-center text-slate-600 text-xs italic">
                  {t("sessions.loading")}
                </div>
              ) : sessions.length === 0 ? (
                <div className="p-4 text-center text-slate-600 text-xs italic">
                  {t("sessions.noSessions")}
                </div>
              ) : (
                [...groups.entries()].map(([projectKey, groupSessions]) => {
                  const activeCount = groupSessions.filter((s) =>
                    isLive(s, now),
                  ).length;
                  const hasSelected = groupSessions.some(
                    (s) => s.id === sessionId,
                  );
                  const isExpanded = isFolderOpen(projectKey, hasSelected);

                  return (
                    <div key={projectKey} className="flex flex-col">
                      <button
                        type="button"
                        onClick={() => toggleFolder(projectKey, isExpanded)}
                        aria-expanded={isExpanded}
                        className="flex items-center gap-1.5 px-2 py-2 rounded-md text-left hover:bg-slate-800/50 transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronDown size={14} className="text-slate-500" />
                        ) : (
                          <ChevronRight size={14} className="text-slate-500" />
                        )}
                        {isExpanded ? (
                          <FolderOpen size={14} className="text-purple-400" />
                        ) : (
                          <Folder size={14} className="text-slate-500" />
                        )}
                        <span className="text-xs font-bold text-slate-300 truncate flex-1">
                          {folderLabel(projectKey)}
                        </span>
                        {activeCount > 0 && (
                          <Radio
                            size={10}
                            className="text-emerald-400 animate-pulse"
                          />
                        )}
                        <span className="text-[10px] text-slate-600 font-mono">
                          {groupSessions.length}
                        </span>
                      </button>

                      {isExpanded &&
                        groupSessions.map((session) => {
                          const select = (): void => {
                            onSessionSelect(session.id);
                            onClose();
                          };
                          return (
                            <div
                              role="button"
                              tabIndex={0}
                              key={session.id}
                              className={`ml-4 px-3 py-2 rounded-md cursor-pointer transition-colors ${
                                session.id === sessionId
                                  ? "bg-purple-500/20 border-l-2 border-purple-500"
                                  : "hover:bg-slate-800/50"
                              }`}
                              onClick={select}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  select();
                                }
                              }}
                            >
                              <div className="flex items-center gap-2 mb-0.5">
                                {isLive(session, now) ? (
                                  <Radio
                                    size={10}
                                    className="text-emerald-400 animate-pulse"
                                  />
                                ) : (
                                  <PauseCircle
                                    size={10}
                                    className="text-slate-500"
                                  />
                                )}
                                <span
                                  className={`text-xs font-bold truncate ${
                                    session.id === sessionId
                                      ? "text-purple-300"
                                      : "text-slate-300"
                                  }`}
                                >
                                  {session.displayName ??
                                    session.id.slice(0, 12)}
                                </span>
                              </div>
                              <div className="flex justify-between text-[10px] text-slate-500">
                                <span>
                                  {t("sessions.events", {
                                    count: session.eventCount,
                                  })}
                                </span>
                                <span>
                                  {formatDistanceToNow(
                                    new Date(session.updatedAt),
                                    {
                                      addSuffix: true,
                                      locale: dateFnsLocale,
                                    },
                                  )}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Git Status Panel */}
          <div className="mb-6">
            <GitStatusPanel />
          </div>

          {/* Event Log */}
          <div>
            <EventLog />
          </div>
        </div>
      </div>
    </div>
  );
}
