"use client";

import { useRef, useState } from "react";
import Modal from "./Modal";
import { useTranslation } from "@/hooks/useTranslation";
import type { Session } from "@/hooks/useSessions";

interface DeleteSessionsDialogProps {
  /** Liste figée des conversations à supprimer ; null = fermé. */
  sessions: Session[] | null;
  onClose: () => void;
  /** Supprime une conversation ; renvoie false en cas d'échec. */
  onDeleteOne: (session: Session) => Promise<boolean>;
}

export default function DeleteSessionsDialog({
  sessions,
  onClose,
  onDeleteOne,
}: DeleteSessionsDialogProps) {
  // Monté seulement quand une liste existe : l'état repart de zéro à chaque ouverture.
  if (!sessions) return null;
  return (
    <Content sessions={sessions} onClose={onClose} onDeleteOne={onDeleteOne} />
  );
}

function Content({
  sessions,
  onClose,
  onDeleteOne,
}: Omit<DeleteSessionsDialogProps, "sessions"> & { sessions: Session[] }) {
  const { t } = useTranslation();
  const [remaining, setRemaining] = useState<Session[]>(sessions);
  const [deleting, setDeleting] = useState(false);
  const [hadFailure, setHadFailure] = useState(false);
  const busyRef = useRef(false);

  const eventCount = remaining.reduce((n, x) => n + x.eventCount, 0);

  const confirm = async () => {
    if (busyRef.current) return; // pas de double soumission
    busyRef.current = true;
    setDeleting(true);
    const failed: Session[] = [];
    for (const target of remaining) {
      if (!(await onDeleteOne(target))) failed.push(target);
    }
    busyRef.current = false;
    setDeleting(false);
    if (failed.length === 0) {
      onClose();
    } else {
      setRemaining(failed);
      setHadFailure(true);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      dismissible={!deleting}
      title={`Supprimer ${remaining.length} conversation${remaining.length > 1 ? "s" : ""}`}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="px-4 py-2 text-slate-400 hover:text-white disabled:opacity-50 text-sm font-bold transition-colors"
          >
            {t("modal.cancel")}
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={deleting}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-white text-sm font-bold rounded-lg transition-colors shadow-lg shadow-rose-900/20"
          >
            {deleting
              ? "Suppression…"
              : hadFailure
                ? "Réessayer"
                : t("modal.delete")}
          </button>
        </>
      }
    >
      {hadFailure && (
        <p role="alert" className="mb-3 text-rose-400">
          {remaining.length} conversation
          {remaining.length > 1 ? "s n'ont" : " n'a"} pas pu être supprimée
          {remaining.length > 1 ? "s" : ""}. Les autres ont bien été supprimées.
        </p>
      )}
      <p>
        {remaining.length} conversation{remaining.length > 1 ? "s" : ""} et{" "}
        leurs {eventCount} {t("modal.events")} seront supprimés.{" "}
        {t("modal.cannotBeUndone")}
      </p>
      <ul className="mt-3 max-h-40 overflow-y-auto space-y-1 text-xs text-slate-400 font-mono">
        {remaining.map((s) => (
          <li key={s.id} className="truncate">
            {s.projectName || s.id.slice(0, 8)}
          </li>
        ))}
      </ul>
    </Modal>
  );
}
