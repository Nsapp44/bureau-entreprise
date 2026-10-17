import { apiFetch } from "@/utils/api";
import type { ActiveConversation } from "@/types";

/** Libellé affiché au survol d'un poste occupé (maquette : `.hit .lab`). */
export function hitLabel(_conv: ActiveConversation): string {
  // Toutes les conversations viennent de l'appli Claude (pas de terminal).
  return "Ouvrir ici + dans Claude";
}

/**
 * Texte du toast pour une réponse de POST /api/v1/app/open-conversation.
 * Retourne null en cas de succès (200) : rien à afficher.
 */
export function openErrorToast(status: number): string | null {
  if (status === 200) return null;
  if (status === 404) return "Conversation introuvable dans l'appli Claude.";
  if (status === 409) return "Cette conversation est archivée.";
  if (status === 501) return "Ouverture dans l'appli Claude : Windows requis.";
  return "Impossible d'ouvrir l'appli Claude.";
}

/**
 * Supprime la conversation dans l'appli Claude (POST /api/v1/app/delete-conversation).
 * Ne lève jamais : retourne le texte du toast d'erreur, ou null si OK.
 */
export async function requestDeleteInApp(
  appSessionId: string,
): Promise<string | null> {
  try {
    const res = await apiFetch("/api/v1/app/delete-conversation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: appSessionId }),
    });
    return res.status === 200 ? null : "Impossible de supprimer la conversation.";
  } catch {
    return "Impossible de supprimer la conversation.";
  }
}

/**
 * Demande au backend d'ouvrir la conversation dans l'appli Claude.
 * Ne lève jamais : retourne le texte du toast d'erreur, ou null si OK.
 */
export async function requestOpenInApp(
  appSessionId: string,
): Promise<string | null> {
  try {
    const res = await apiFetch("/api/v1/app/open-conversation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: appSessionId }),
    });
    return openErrorToast(res.status);
  } catch {
    return openErrorToast(0);
  }
}
