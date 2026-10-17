import type { ReactNode } from "react";

interface InstrumentPanelProps {
  title?: string;
  children: ReactNode;
  className?: string;
}

/** Carte standard de la refonte : fond surface-2, bordure fine, rayon 10 px, sans ombre. */
export function InstrumentPanel({ title, children, className = "" }: InstrumentPanelProps) {
  return (
    <section
      className={`rounded-[10px] border border-white/10 bg-[#1a1917] p-3 ${className}`}
    >
      {title && (
        <h2 className="mb-2 font-heading text-xs font-semibold uppercase tracking-wide text-slate-400">
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}
