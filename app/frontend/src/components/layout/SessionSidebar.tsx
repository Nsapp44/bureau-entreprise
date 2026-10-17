"use client";

import { useMemo, useState, useRef } from "react";
import {
  History,
  Radio,
  PauseCircle,
  Trash2,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR as dateFnsPtBR, es as dateFnsEs } from "date-fns/locale";
import { SessionTokens } from "@/components/layout/SessionTokens";
import { GitStatusPanel } from "@/components/layout/GitStatusPanel";
import { useSessionSelection } from "@/components/layout/useSessionSelection";
import type { Session } from "@/hooks/useSessions";
import { useDragResize } from "@/hooks/useDragResize";
import { useTranslation } from "@/hooks/useTranslation";
import { useOpenFolders } from "@/hooks/useOpenFolders";
import { useNow } from "@/hooks/useNow";
import { useGameStore } from "@/stores/gameStore";
import { providerColor, providerStyle } from "@/utils/providers";
import {
  folderLabel,
  groupSessionsByProject,
  isLive,
} from "@/utils/sessionGroups";

// ============================================================================
// CONSTANTS
// ============================================================================

const SIDEBAR_MIN_WIDTH = 180;
const SIDEBAR_MAX_WIDTH = 500;
const SIDEBAR_DEFAULT_WIDTH = 288; // equivalent to w-72
const SESSIONS_MIN_HEIGHT = 80;
const SESSIONS_DEFAULT_HEIGHT = 280;

/** Max height is 70% of viewport to prevent overflow on smaller screens */
const getMaxPanelHeight = () => Math.floor(window.innerHeight * 0.7);

// ============================================================================
// TYPES
// ============================================================================

interface SessionSidebarProps {
  sessions: Session[];
  sessionsLoading: boolean;
  sessionId: string;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
  onSessionSelect: (id: string) => Promise<void>;
  onDeleteSession: (session: Session) => void;
  /** Suppression groupée : le parent demande une seule confirmation. */
  onDeleteSessions?: (sessions: Session[]) => void;
  onRenameSession: (sessionId: string, newName: string) => Promise<void>;
}

// ============================================================================
// COMPONENT
// ============================================================================

/** Editable session name — double-click to rename, Enter/blur to save, Escape to cancel. */
function EditableName({
  session,
  isEditing,
  onStartEdit,
  onCommit,
  onCancel,
  className,
}: {
  session: Session;
  isEditing: boolean;
  onStartEdit: () => void;
  onCommit: (name: string) => void;
  onCancel: () => void;
  className?: string;
}): React.ReactNode {
  const [draft, setDraft] = useState(
    () => session.displayName ?? session.id.slice(0, 12),
  );
  const committedRef = useRef(false);

  if (isEditing) {
    return (
      <input
        type="text"
        value={draft}
        autoFocus
        maxLength={64}
        className="text-xs font-bold flex-1 bg-slate-700 text-white px-1 py-0 rounded outline-none border border-purple-500"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            committedRef.current = true;
            onCommit(draft);
          } else if (e.key === "Escape") {
            e.preventDefault();
            committedRef.current = true;
            onCancel();
          }
        }}
        onBlur={() => {
          if (!committedRef.current) {
            onCommit(draft);
          }
        }}
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  const displayName = session.displayName ?? session.id.slice(0, 12);

  return (
    <span
      className={className}
      onDoubleClick={(e) => {
        e.stopPropagation();
        committedRef.current = false;
        setDraft(session.displayName ?? session.id.slice(0, 12));
        onStartEdit();
      }}
      title={session.displayName ? "Double-click to rename" : undefined}
    >
      {displayName}
    </span>
  );
}

/**
 * Desktop left sidebar containing the collapsible session browser and git
 * status panel. Supports drag-to-resize both the sidebar width (right edge)
 * and the sessions panel height (divider between sessions and git status).
 */
export function SessionSidebar({
  sessions,
  sessionsLoading,
  sessionId,
  isCollapsed,
  onToggleCollapsed,
  onSessionSelect,
  onDeleteSession,
  onDeleteSessions,
  onRenameSession,
}: SessionSidebarProps): React.ReactNode {
  const { t, language } = useTranslation();
  const dateFnsLocale =
    language === "pt-BR"
      ? dateFnsPtBR
      : language === "es"
        ? dateFnsEs
        : undefined;

  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const { isOpen: isFolderOpen, toggle: toggleFolder } = useOpenFolders();

  const {
    size: sidebarWidth,
    isDragging: isWidthDragging,
    handleDragStart: handleWidthDragStart,
    handleKeyDown: handleWidthKeyDown,
    bounds: widthBounds,
  } = useDragResize({
    initialSize: SIDEBAR_DEFAULT_WIDTH,
    minSize: SIDEBAR_MIN_WIDTH,
    maxSize: SIDEBAR_MAX_WIDTH,
    direction: "horizontal",
    edge: "right",
  });

  const {
    size: sessionsHeight,
    isDragging: isHeightDragging,
    handleDragStart: handleHeightDragStart,
    handleKeyDown: handleHeightKeyDown,
    bounds: heightBounds,
  } = useDragResize({
    initialSize: SESSIONS_DEFAULT_HEIGHT,
    minSize: SESSIONS_MIN_HEIGHT,
    maxSize: getMaxPanelHeight,
    direction: "vertical",
    edge: "down",
  });

  const isDragging = isWidthDragging || isHeightDragging;

  // The session list has no model info: only the open session gets a dot,
  // from the Boss provider of the live store.
  const bossProvider = useGameStore((s) => s.boss.provider);
  const activeProvider =
    bossProvider && bossProvider !== "unknown" ? bossProvider : null;

  const now = useNow();
  const groups = groupSessionsByProject(sessions, now);
  const allIds = useMemo(() => sessions.map((x) => x.id), [sessions]);
  const { selected, toggle, clear } = useSessionSelection(allIds);
  const visibleIds = [...groups.entries()].flatMap(([key, list]) =>
    isFolderOpen(
      key,
      list.some((x) => x.id === sessionId),
    )
      ? list.map((x) => x.id)
      : [],
  );

  return (
    <aside
      className={`relative flex flex-col gap-1.5 flex-shrink-0 overflow-hidden ${
        isDragging ? "select-none" : "transition-all duration-300"
      }`}
      style={{ width: isCollapsed ? 40 : sidebarWidth }}
    >
      {/* Collapse Toggle */}
      <button
        onClick={onToggleCollapsed}
        className="flex items-center justify-center p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
        title={
          isCollapsed
            ? t("sessions.expandSidebar")
            : t("sessions.collapseSidebar")
        }
      >
        {isCollapsed ? (
          <PanelLeftOpen size={16} />
        ) : (
          <PanelLeftClose size={16} />
        )}
      </button>

      {!isCollapsed && (
        <>
          {/* Session Browser */}
          <div
            className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden flex-shrink-0 flex flex-col"
            style={{ height: sessionsHeight }}
          >
            <div className="bg-slate-900 px-3 py-2 border-b border-slate-800 flex items-center gap-2 flex-shrink-0">
              <History size={14} className="text-purple-500" />
              <span className="text-slate-300 font-bold uppercase tracking-wider text-xs">
                {t("sessions.title")}
              </span>
              <span className="text-slate-600 text-xs">
                ({sessions.length})
              </span>
              {selected.size > 0 && onDeleteSessions && (
                <span className="ml-auto flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={clear}
                    className="text-[11px] text-slate-400 hover:text-white"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onDeleteSessions(
                        sessions.filter((x) => selected.has(x.id)),
                      );
                      clear();
                    }}
                    className="px-2 py-0.5 text-[11px] font-semibold rounded-[6px] bg-red-500/15 text-red-300 border border-red-500/40 hover:bg-red-500/25"
                  >
                    Supprimer {selected.size}
                  </button>
                </span>
              )}
            </div>

            <div className="overflow-y-auto flex-grow p-2">
              {sessionsLoading && sessions.length === 0 ? (
                <div className="p-4 text-center text-slate-600 text-xs italic">
                  {t("sessions.loading")}
                </div>
              ) : sessions.length === 0 ? (
                <div className="p-4 text-center text-slate-600 text-xs italic">
                  {t("sessions.noSessions")}
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {[...groups.entries()].map(([projectKey, groupSessions]) => {
                    const activeCount = groupSessions.filter((s) =>
                      isLive(s, now),
                    ).length;
                    const hasSelected = groupSessions.some(
                      (s) => s.id === sessionId,
                    );
                    const isExpanded = isFolderOpen(projectKey, hasSelected);

                    return (
                      <div key={projectKey} className="flex flex-col">
                        {/* Dossier (projet) */}
                        <button
                          type="button"
                          onClick={() => toggleFolder(projectKey, isExpanded)}
                          aria-expanded={isExpanded}
                          className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-left hover:bg-slate-800/50 transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronDown
                              size={12}
                              className="text-slate-500 flex-shrink-0"
                            />
                          ) : (
                            <ChevronRight
                              size={12}
                              className="text-slate-500 flex-shrink-0"
                            />
                          )}
                          {isExpanded ? (
                            <FolderOpen
                              size={14}
                              className="text-purple-400 flex-shrink-0"
                            />
                          ) : (
                            <Folder
                              size={14}
                              className="text-slate-500 flex-shrink-0"
                            />
                          )}
                          <span className="text-xs font-bold text-slate-300 truncate flex-1">
                            {folderLabel(projectKey)}
                          </span>
                          {activeCount > 0 && (
                            <Radio
                              size={10}
                              className="text-emerald-400 animate-pulse flex-shrink-0"
                            />
                          )}
                          <span className="text-[10px] text-slate-600 font-mono">
                            {groupSessions.length}
                          </span>
                        </button>

                        {/* Conversations du dossier */}
                        {isExpanded &&
                          groupSessions.map((session) => {
                            const isSelected = session.id === sessionId;
                            return (
                              <div
                                role="button"
                                tabIndex={0}
                                key={session.id}
                                className={`group relative ml-4 px-3 py-1.5 text-left transition-colors cursor-pointer rounded-md ${
                                  isSelected
                                    ? "bg-purple-500/20 border-l-2 border-purple-500"
                                    : "hover:bg-slate-800/50"
                                }`}
                                onClick={() => onSessionSelect(session.id)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    onSessionSelect(session.id);
                                  }
                                }}
                              >
                                <div className="flex items-center gap-2">
                                  {onDeleteSessions && (
                                    <input
                                      type="checkbox"
                                      checked={selected.has(session.id)}
                                      onChange={() => undefined}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggle(
                                          session.id,
                                          e.shiftKey,
                                          visibleIds,
                                        );
                                      }}
                                      onKeyDown={(e) => e.stopPropagation()}
                                      aria-label={`Sélectionner ${session.displayName ?? session.id.slice(0, 12)}`}
                                      className="flex-shrink-0 accent-orange-500"
                                    />
                                  )}
                                  {isLive(session, now) ? (
                                    <Radio
                                      size={10}
                                      className="text-emerald-400 animate-pulse flex-shrink-0"
                                    />
                                  ) : (
                                    <PauseCircle
                                      size={10}
                                      className="text-slate-500 flex-shrink-0"
                                    />
                                  )}
                                  {isSelected && activeProvider && (
                                    <span
                                      className="w-2 h-2 rounded-full flex-shrink-0"
                                      style={{
                                        backgroundColor:
                                          providerColor(activeProvider),
                                      }}
                                      title={providerStyle(activeProvider).name ?? undefined}
                                    />
                                  )}
                                  <EditableName
                                    session={session}
                                    isEditing={editingSessionId === session.id}
                                    onStartEdit={() =>
                                      setEditingSessionId(session.id)
                                    }
                                    onCommit={(name) => {
                                      setEditingSessionId(null);
                                      onRenameSession(session.id, name);
                                    }}
                                    onCancel={() => setEditingSessionId(null)}
                                    className={`text-xs font-bold truncate flex-1 ${
                                      isSelected
                                        ? "text-purple-300"
                                        : "text-slate-300"
                                    }`}
                                  />
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onDeleteSession(session);
                                    }}
                                    className="p-1 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                                    aria-label={`${t("sessions.deleteSession")} ${session.id}`}
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                                <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
                                  <span className="flex gap-2">
                                    <span>
                                      {t("sessions.events", {
                                        count: session.eventCount,
                                      })}
                                    </span>
                                    <SessionTokens sessionId={session.id} />
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
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Vertical Resize Handle (sessions ↕ git status) */}
          <div
            role="separator"
            aria-orientation="horizontal"
            aria-label="Hauteur de la liste des conversations"
            aria-valuenow={Math.round(sessionsHeight)}
            aria-valuemin={heightBounds.min}
            aria-valuemax={heightBounds.max}
            tabIndex={0}
            className="flex-shrink-0 h-3 cursor-ns-resize flex items-center justify-center group -my-1 outline-none"
            onMouseDown={handleHeightDragStart}
            onKeyDown={handleHeightKeyDown}
            title={t("sessions.dragToResize")}
          >
            <div className="w-10 h-1 rounded-full bg-slate-700 group-hover:bg-orange-500 group-active:bg-orange-400 group-focus-visible:bg-orange-500 transition-colors" />
          </div>

          {/* Git Status Panel */}
          <div className="flex-grow min-h-0">
            <GitStatusPanel />
          </div>
        </>
      )}

      {/* Horizontal Resize Handle (right edge) */}
      {!isCollapsed && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Largeur de la colonne de gauche"
          aria-valuenow={Math.round(sidebarWidth)}
          aria-valuemin={widthBounds.min}
          aria-valuemax={widthBounds.max}
          tabIndex={0}
          className="absolute right-0 top-0 w-1.5 h-full cursor-ew-resize z-10 hover:bg-orange-500/40 active:bg-orange-500/60 focus-visible:bg-orange-500/60 outline-none transition-colors"
          onMouseDown={handleWidthDragStart}
          onKeyDown={handleWidthKeyDown}
          title={t("sessions.dragToResize")}
        />
      )}
    </aside>
  );
}
