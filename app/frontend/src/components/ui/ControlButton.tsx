import type { ButtonHTMLAttributes } from "react";

type Variant = "default" | "primary" | "danger";

interface ControlButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const VARIANTS: Record<Variant, string> = {
  default: "border-white/10 bg-[#1a1917] text-slate-100 hover:border-white/20",
  primary: "border-orange-500 bg-orange-500 text-[#0e0d0c] hover:bg-orange-400",
  danger: "border-red-500/60 bg-transparent text-red-300 hover:bg-red-500/10",
};

/** Bouton standard : rayon 6 px, focus visible et état désactivé via globals.css. */
export function ControlButton({
  variant = "default",
  className = "",
  type = "button",
  ...rest
}: ControlButtonProps) {
  return (
    <button
      type={type}
      className={`rounded-[6px] border px-3 py-1.5 text-sm font-medium transition-colors ${VARIANTS[variant]} ${className}`}
      {...rest}
    />
  );
}
