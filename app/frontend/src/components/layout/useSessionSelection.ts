import { useCallback, useMemo, useRef, useState } from "react";

/**
 * Sélection groupée de conversations, par identifiants. Maj+clic sélectionne la
 * plage entre la dernière case cochée et la case cliquée, parmi les lignes
 * visibles (`visibleIds`, dans l'ordre d'affichage).
 */
export function useSessionSelection(existingIds: readonly string[]) {
  const [raw, setRaw] = useState<ReadonlySet<string>>(new Set());
  const anchorRef = useRef<string | null>(null);

  // Les conversations supprimées ailleurs disparaissent de la sélection.
  const selected = useMemo(() => {
    const live = new Set(existingIds);
    return new Set([...raw].filter((id) => live.has(id)));
  }, [raw, existingIds]);

  const toggle = useCallback(
    (id: string, shift: boolean, visibleIds: readonly string[]) => {
      const anchor = anchorRef.current;
      setRaw((prev) => {
        const next = new Set(prev);
        const from = anchor === null ? -1 : visibleIds.indexOf(anchor);
        const to = visibleIds.indexOf(id);
        if (shift && from !== -1 && to !== -1) {
          const [a, b] = from < to ? [from, to] : [to, from];
          for (const rid of visibleIds.slice(a, b + 1)) next.add(rid);
        } else if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
      anchorRef.current = id;
    },
    [],
  );

  const clear = useCallback(() => {
    setRaw(new Set());
    anchorRef.current = null;
  }, []);

  return { selected, toggle, clear };
}
