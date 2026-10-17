"use client";

import { useCallback, useState } from "react";

const STORAGE_KEY = "office.openFolders";

function load(): Record<string, boolean> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, boolean>)
      : {};
  } catch {
    return {};
  }
}

/**
 * État ouvert/fermé des dossiers de conversations, mémorisé dans le navigateur.
 * Sans choix de l'utilisateur, un dossier est ouvert s'il contient la
 * conversation affichée (`defaultOpen`).
 */
export function useOpenFolders(): {
  isOpen: (key: string, defaultOpen: boolean) => boolean;
  toggle: (key: string, currentlyOpen: boolean) => void;
} {
  const [choices, setChoices] = useState<Record<string, boolean>>(() =>
    typeof window === "undefined" ? {} : load(),
  );

  const toggle = useCallback((key: string, currentlyOpen: boolean) => {
    setChoices((prev) => {
      const next = { ...prev, [key]: !currentlyOpen };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* stockage indisponible : le choix vaut pour cette session */
      }
      return next;
    });
  }, []);

  const isOpen = useCallback(
    (key: string, defaultOpen: boolean) => choices[key] ?? defaultOpen,
    [choices],
  );

  return { isOpen, toggle };
}
