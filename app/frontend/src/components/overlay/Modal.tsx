"use client";

import { X } from "lucide-react";
import { ReactNode, useEffect, useId, useRef } from "react";
import { useTranslation } from "@/hooks/useTranslation";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Titre lu par les lecteurs d'écran ; peut contenir un badge. */
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** false : ni Échap, ni clic sur le fond, ni croix ne ferment la fenêtre. */
  dismissible?: boolean;
  size?: "md" | "2xl";
  /** Classes ajoutées au panneau (ex. police mono). */
  panelClassName?: string;
}

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

// Pile des fenêtres ouvertes : seule la dernière réagit à Échap et à Tab.
const openStack: symbol[] = [];

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  dismissible = true,
  size = "md",
  panelClassName = "",
}: ModalProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const dismissibleRef = useRef(dismissible);
  useEffect(() => {
    onCloseRef.current = onClose;
    dismissibleRef.current = dismissible;
  });

  // Focus initial, confinement du Tab, Échap, inertie de l'arrière-plan,
  // restauration du focus. Un seul effet : il ne dépend que de isOpen.
  useEffect(() => {
    if (!isOpen) return;
    const panel = panelRef.current;
    if (!panel) return;
    const token = Symbol("modal");
    openStack.push(token);
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Arrière-plan inerte : les frères du portail racine, sauf cette fenêtre.
    const overlay = panel.parentElement;
    const inerted: HTMLElement[] = [];
    if (overlay?.parentElement) {
      for (const el of Array.from(overlay.parentElement.children)) {
        if (el !== overlay && el instanceof HTMLElement && !el.inert) {
          el.inert = true;
          inerted.push(el);
        }
      }
    }

    const focusables = () =>
      Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
    // Premier champ ou bouton du contenu ; à défaut, le panneau lui-même.
    const target =
      panel.querySelector<HTMLElement>("[data-autofocus]") ??
      focusables().find((el) => el.dataset.modalClose === undefined) ??
      panel;
    target.focus();

    const handleKey = (e: KeyboardEvent) => {
      if (openStack[openStack.length - 1] !== token) return;
      if (e.key === "Escape" && dismissibleRef.current) {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKey);

    return () => {
      document.removeEventListener("keydown", handleKey);
      const i = openStack.indexOf(token);
      if (i !== -1) openStack.splice(i, 1);
      for (const el of inerted) el.inert = false;
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={dismissible ? onClose : undefined}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full ${
          size === "2xl" ? "max-w-2xl" : "max-w-md"
        } max-h-[80vh] flex flex-col overflow-hidden outline-none animate-in zoom-in-95 duration-200 ${panelClassName}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-slate-800 bg-slate-900/50 flex-shrink-0">
          <h2
            id={titleId}
            className="text-lg font-bold text-white tracking-tight min-w-0 break-words"
          >
            {title}
          </h2>
          {dismissible && (
            <button
              type="button"
              data-modal-close
              onClick={onClose}
              aria-label={t("modal.close")}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors flex-shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="px-6 py-6 text-slate-300 text-sm leading-relaxed overflow-y-auto flex-1 min-h-0">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-3 px-6 py-4 border-t border-slate-800 bg-slate-900/50 flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
