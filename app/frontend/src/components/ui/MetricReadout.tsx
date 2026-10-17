interface MetricReadoutProps {
  label: string;
  value: string;
  hint?: string;
}

/** Mesure compacte : libellé discret au-dessus, valeur en police mono. */
export function MetricReadout({ label, value, hint }: MetricReadoutProps) {
  return (
    <div className="flex flex-col" title={hint}>
      <span className="text-[11px] uppercase tracking-wide text-slate-400">{label}</span>
      <span className="font-mono text-sm text-slate-100">{value}</span>
    </div>
  );
}
