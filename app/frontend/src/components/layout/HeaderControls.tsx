"use client";

import {
  Activity,
  HelpCircle,
  Settings,
  Bell,
  MessagesSquare,
} from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useNavigationStore } from "@/stores/navigationStore";
import { useAttentionStore, selectUnreadCount } from "@/stores/attentionStore";
import { HeaderMoreMenu } from "@/components/layout/HeaderMoreMenu";
import { TodayUsageBadge } from "@/components/layout/TodayUsageBadge";
import { ShutdownButton } from "@/components/layout/ShutdownButton";

/** Style commun des boutons de navigation et d'action de l'en-tête. */
const ACTION_BTN =
  "flex shrink-0 items-center gap-2 whitespace-nowrap px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 rounded-[6px] text-xs font-semibold transition-colors";

// ============================================================================
// TYPES
// ============================================================================

interface HeaderControlsProps {
  isConnected: boolean;
  debugMode: boolean;
  onSimulate: () => Promise<void>;
  onReset: () => void;
  onClearDB: () => void;
  onToggleDebug: () => void;
  onOpenSettings: () => void;
  onOpenHelp: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Desktop-only header controls. Frequently-used entry points (
 * Settings, Help, attention queue) stay visible; the rarely-used
 * developer/maintenance actions live in the "⋯" overflow menu, and the tour
 * moved into the Help modal — keeping the header readable.
 *
 * Hidden on mobile — the MobileDrawer handles those actions instead.
 */
export function HeaderControls({
  isConnected,
  debugMode,
  onSimulate,
  onReset,
  onClearDB,
  onToggleDebug,
  onOpenSettings,
  onOpenHelp,
}: HeaderControlsProps): React.ReactNode {
  const { t } = useTranslation();
  const view = useNavigationStore((s) => s.view);
  const goToSingle = useNavigationStore((s) => s.goToSingle);
  const goToConversations = useNavigationStore((s) => s.goToConversations);
  const unreadCount = useAttentionStore(selectUnreadCount);
  const openCommandBar = useAttentionStore((s) => s.openCommandBar);

  return (
    <div className="flex min-w-0 gap-2 xl:gap-3 items-center">
      {unreadCount > 0 && (
        <button
          onClick={openCommandBar}
          className="relative flex items-center gap-2 px-3 py-1.5 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/40 rounded-[6px] text-xs font-semibold transition-colors"
          title="File d'attention : conversations qui attendent une réponse"
          aria-label={`File d'attention, ${unreadCount} en attente`}
        >
          <Bell className="w-3.5 h-3.5" />
          <span className="absolute -top-1 -right-1 bg-orange-500 text-[#0e0d0c] text-[11px] font-bold rounded-full min-w-4 h-4 px-0.5 flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        </button>
      )}

      <button
        onClick={view === "conversations" ? goToSingle : goToConversations}
        title={view === "conversations" ? "Bureau" : t("header.conversations")}
        aria-label={t("header.conversations")}
        className={`${ACTION_BTN} ${
          view === "conversations" ? "border-orange-500/50 text-orange-400" : ""
        }`}
      >
        <MessagesSquare size={14} />
        <span className="hidden xl:inline">
          {view === "conversations" ? "← Bureau" : t("header.conversations")}
        </span>
      </button>

      <button
        onClick={onOpenSettings}
        data-tour-id="settings-btn"
        title={t("header.settings")}
        aria-label={t("header.settings")}
        className={ACTION_BTN}
      >
        <Settings size={14} />
        <span className="hidden xl:inline">{t("header.settings")}</span>
      </button>

      <button
        onClick={onOpenHelp}
        title={t("header.help")}
        aria-label={t("header.help")}
        className={ACTION_BTN}
      >
        <HelpCircle size={14} />
        <span className="hidden xl:inline">{t("header.help")}</span>
      </button>

      <TodayUsageBadge />

      <ShutdownButton />

      {/* Rarely-used developer/maintenance actions */}
      <HeaderMoreMenu
        debugMode={debugMode}
        onSimulate={onSimulate}
        onReset={onReset}
        onClearDB={onClearDB}
        onToggleDebug={onToggleDebug}
      />

      {/* Connection and AI status */}
      <div className="flex flex-col items-end border-l border-white/10 pl-4">
        <span className="text-[11px] uppercase font-semibold text-slate-400 tracking-widest leading-none mb-1">
          {t("header.status")}
        </span>
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-1.5 font-mono text-xs ${
              isConnected ? "text-emerald-400" : "text-red-400"
            }`}
          >
            <Activity
              size={12}
              className={isConnected ? "animate-pulse" : ""}
            />
            {isConnected ? t("header.connected") : t("header.disconnected")}
          </div>
        </div>
      </div>
    </div>
  );
}
