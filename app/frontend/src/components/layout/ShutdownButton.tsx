"use client";

import { useEffect, useState } from "react";
import { Power } from "lucide-react";
import { apiFetch } from "@/utils/api";

/**
 * "Arrêter" button — only rendered when the backend reports that a local
 * shutdown is available. On success a full-screen overlay replaces the app.
 */
export function ShutdownButton(): React.ReactNode {
  const [available, setAvailable] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/v1/shutdown/available")
      .then((res) => (res.ok ? res.json() : { available: false }))
      .then((data: { available?: boolean }) => {
        if (!cancelled) setAvailable(data.available === true);
      })
      .catch(() => {
        if (!cancelled) setAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleClick = async (): Promise<void> => {
    if (
      !window.confirm(
        "Arrêter Bureau entreprise ? Le serveur local va s'éteindre.",
      )
    ) {
      return;
    }
    setError(null);
    try {
      const res = await apiFetch("/api/v1/shutdown", { method: "POST" });
      if (!res.ok) {
        setError(
          res.status === 403 ? "Arrêt refusé." : "Échec de l'arrêt du serveur.",
        );
        setTimeout(() => setError(null), 4000);
        return;
      }
      setStopped(true);
    } catch {
      // The server may drop the connection while stopping; treat as failure
      // only if it is still reachable.
      setError("Échec de l'arrêt du serveur.");
      setTimeout(() => setError(null), 4000);
    }
  };

  if (stopped) {
    return (
      <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-4 bg-[#0E0D0C] text-[#F3F1EC]">
        <Power size={40} className="text-[#FF5A3C]" />
        <p className="font-heading text-xl">
          Bureau entreprise est arrêté — vous pouvez fermer cet onglet.
        </p>
      </div>
    );
  }

  if (!available) return null;

  return (
    <>
      {error && (
        <span className="text-[11px] text-rose-400" role="alert">
          {error}
        </span>
      )}
      <button
        onClick={handleClick}
        title="Arrêter Bureau entreprise"
        className="flex items-center gap-2 px-3 py-1.5 bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 border border-orange-500/30 rounded text-xs font-bold transition-colors"
      >
        <Power size={14} />
        Arrêter
      </button>
    </>
  );
}
