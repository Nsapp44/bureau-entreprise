"use client";

import { AgentStatus } from "@/components/game/AgentStatus";
import { EventLog } from "@/components/layout/EventLog";
import { useDragResize } from "@/hooks/useDragResize";
import { useTranslation } from "@/hooks/useTranslation";

// ============================================================================
// CONSTANTS
// ============================================================================

const SIDEBAR_MIN_WIDTH = 200;
const SIDEBAR_MAX_WIDTH = 600;
const SIDEBAR_DEFAULT_WIDTH = 320; // equivalent to w-80
const AGENT_PANEL_MIN_HEIGHT = 60;
const AGENT_PANEL_DEFAULT_HEIGHT = 240;

/** Max height is 70% of viewport to prevent overflow on smaller screens */
const getMaxPanelHeight = () => Math.floor(window.innerHeight * 0.7);

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Desktop right sidebar containing the AgentStatus panel and the event log
 * ("Journal") below it. Supports drag-to-resize both the
 * sidebar width (left edge) and the split between the two panels (divider).
 */
export function RightSidebar(): React.ReactNode {
  const { t } = useTranslation();

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
    edge: "left", // Left edge: dragging left increases width
  });

  const {
    size: agentPanelHeight,
    isDragging: isHeightDragging,
    handleDragStart: handleHeightDragStart,
    handleKeyDown: handleHeightKeyDown,
    bounds: heightBounds,
  } = useDragResize({
    initialSize: AGENT_PANEL_DEFAULT_HEIGHT,
    minSize: AGENT_PANEL_MIN_HEIGHT,
    maxSize: getMaxPanelHeight,
    direction: "vertical",
    edge: "down",
  });

  const isDragging = isWidthDragging || isHeightDragging;

  return (
    <aside
      className={`relative flex flex-col gap-2 flex-shrink-0 overflow-hidden ${
        isDragging ? "select-none" : ""
      }`}
      style={{ width: sidebarWidth }}
    >
      {/* Horizontal Resize Handle (left edge) */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Largeur de la colonne de droite"
        aria-valuenow={Math.round(sidebarWidth)}
        aria-valuemin={widthBounds.min}
        aria-valuemax={widthBounds.max}
        tabIndex={0}
        className="absolute left-0 top-0 w-1.5 h-full cursor-ew-resize z-10 hover:bg-orange-500/40 active:bg-orange-500/60 focus-visible:bg-orange-500/60 outline-none transition-colors"
        onMouseDown={handleWidthDragStart}
        onKeyDown={handleWidthKeyDown}
        title={t("sessions.dragToResize")}
      />

      {/* Agent Status */}
      <div
        className="min-h-0 flex-shrink-0"
        style={{ height: agentPanelHeight }}
      >
        <AgentStatus />
      </div>

      {/* Vertical Resize Handle (agent status ↕ events) */}
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Hauteur du panneau des agents"
        aria-valuenow={Math.round(agentPanelHeight)}
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

      {/* Event log (Journal) */}
      <div className="min-h-0 flex flex-col flex-grow">
        <EventLog />
      </div>
    </aside>
  );
}
