/**
 * EventDetailModal - Modal showing full details of a clicked event log entry
 */

"use client";

import Modal from "@/components/overlay/Modal";
import { format } from "date-fns";
import type { EventLogEntry } from "@/stores/gameStore";
import { useTranslation } from "@/hooks/useTranslation";
import { getEventTypeBadgeClasses } from "@/utils/event-type-styles";

interface EventDetailModalProps {
  event: EventLogEntry;
  onClose: () => void;
}

export function EventDetailModal({ event, onClose }: EventDetailModalProps) {
  const { t } = useTranslation();
  const detail = event.detail ?? {};
  const hasDetail = Object.keys(detail).length > 0;

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="2xl"
      panelClassName="font-mono text-xs"
      title={
        <span className="flex flex-wrap items-center gap-3">
          <span
            className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider ${getEventTypeBadgeClasses(event.type)}`}
          >
            {event.type.replace(/_/g, " ")}
          </span>
          <span className="text-slate-400 text-[11px] font-normal">
            {format(event.timestamp, "HH:mm:ss.SSS")}
          </span>
          {event.agentId && (
            <span className="text-blue-400 text-[10px] font-mono font-normal">
              @{event.agentId}
            </span>
          )}
        </span>
      }
      footer={
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold rounded-lg transition-colors"
        >
          {t("modal.close")}
        </button>
      }
    >
      <div className="space-y-3">
        {/* Summary */}
        <div>
          <div className="text-slate-500 text-[10px] uppercase tracking-widest mb-1">
            {t("eventDetail.summary")}
          </div>
          <div className="text-slate-200 text-[12px]">{event.summary}</div>
        </div>

        {/* Detail fields */}
        {hasDetail ? (
          <>
            {detail.toolName && (
              <div>
                <div className="text-slate-500 text-[10px] uppercase tracking-widest mb-1">
                  {t("eventDetail.tool")}
                </div>
                <div className="text-amber-300 text-[12px]">
                  {String(detail.toolName)}
                </div>
              </div>
            )}

            {detail.agentName && (
              <div>
                <div className="text-slate-500 text-[10px] uppercase tracking-widest mb-1">
                  {t("eventDetail.agentName")}
                </div>
                <div className="text-blue-300 text-[12px]">
                  {String(detail.agentName)}
                </div>
              </div>
            )}

            {detail.taskDescription && (
              <div>
                <div className="text-slate-500 text-[10px] uppercase tracking-widest mb-1">
                  {t("eventDetail.taskDescription")}
                </div>
                <div className="text-slate-200 text-[12px] whitespace-pre-wrap leading-relaxed">
                  {String(detail.taskDescription)}
                </div>
              </div>
            )}

            {detail.prompt && (
              <div>
                <div className="text-slate-500 text-[10px] uppercase tracking-widest mb-1">
                  {t("eventDetail.userPrompt")}
                </div>
                <div className="text-cyan-200 text-[12px] whitespace-pre-wrap leading-relaxed bg-slate-800/50 rounded p-2 border border-slate-700">
                  {String(detail.prompt)}
                </div>
              </div>
            )}

            {detail.thinking && (
              <div>
                <div className="text-slate-500 text-[10px] uppercase tracking-widest mb-1">
                  {t("eventDetail.thinking")}
                </div>
                <div className="text-slate-400 italic text-[12px] whitespace-pre-wrap leading-relaxed bg-slate-800/30 rounded p-2 border border-slate-700/50">
                  {String(detail.thinking)}
                </div>
              </div>
            )}

            {detail.message && (
              <div>
                <div className="text-slate-500 text-[10px] uppercase tracking-widest mb-1">
                  {t("eventDetail.message")}
                </div>
                <div className="text-slate-200 text-[12px] whitespace-pre-wrap leading-relaxed">
                  {String(detail.message)}
                </div>
              </div>
            )}

            {detail.resultSummary && (
              <div>
                <div className="text-slate-500 text-[10px] uppercase tracking-widest mb-1">
                  {t("eventDetail.resultSummary")}
                </div>
                <div className="text-emerald-300 text-[12px] whitespace-pre-wrap leading-relaxed">
                  {String(detail.resultSummary)}
                </div>
              </div>
            )}

            {detail.errorType && (
              <div>
                <div className="text-slate-500 text-[10px] uppercase tracking-widest mb-1">
                  {t("eventDetail.errorType")}
                </div>
                <div className="text-red-400 text-[12px]">
                  {String(detail.errorType)}
                </div>
              </div>
            )}

            {detail.toolInput && (
              <div>
                <div className="text-slate-500 text-[10px] uppercase tracking-widest mb-1">
                  {t("eventDetail.toolInput")}
                </div>
                <pre className="text-slate-300 text-[11px] bg-slate-800 rounded p-3 border border-slate-700 overflow-x-auto whitespace-pre-wrap break-words leading-relaxed">
                  {JSON.stringify(detail.toolInput, null, 2)}
                </pre>
              </div>
            )}
          </>
        ) : (
          <div className="text-slate-600 italic text-center py-4">
            {t("eventDetail.noDetail")}
          </div>
        )}
      </div>
    </Modal>
  );
}
