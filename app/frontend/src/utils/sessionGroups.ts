import type { Session } from "@/hooks/useSessions";

/** Une conversation est « en direct » si elle a eu de l'activité il y a moins de 10 min. */
export const LIVE_WINDOW_MS = 10 * 60 * 1000;

/** Nom du groupe des conversations sans dossier ni projet. */
export const NO_GROUP_LABEL = "Non groupé";

const lastActivity = (s: Session): number =>
  new Date(s.lastActivityAt ?? s.updatedAt).getTime();

export function isLive(session: Session, now: number = Date.now()): boolean {
  return now - lastActivity(session) < LIVE_WINDOW_MS;
}

/**
 * Nom du « dossier » d'une session : le dossier de travail connu de l'appli
 * Claude, sinon la racine du projet, sinon le projet (ex. « bo-test »).
 */
export function getProjectKey(session: Session): string {
  if (session.folderName) return folderLabel(session.folderName);
  if (session.projectRoot) {
    const parts = session.projectRoot.split(/[\\/]/).filter(Boolean);
    if (parts.length > 0) return folderLabel(parts[parts.length - 1]);
  }
  if (session.projectName) return folderLabel(session.projectName);
  return NO_GROUP_LABEL;
}

/**
 * Nom lisible d'un dossier : Claude encode les chemins (`C:\bo-test` devient
 * `C--bo-test`), on retire le préfixe de lecteur.
 */
export function folderLabel(key: string): string {
  const m = /^[A-Za-z]--(.+)$/.exec(key);
  return m ? m[1] : key;
}

const time = lastActivity;

/**
 * Range les sessions par dossier (projet). Dans un dossier : sessions en direct
 * d'abord, puis les plus récentes. Entre dossiers : ceux qui ont une session en
 * direct d'abord, puis la plus récente activité.
 */
export function groupSessionsByProject(
  sessions: Session[],
  now: number = Date.now(),
): Map<string, Session[]> {
  const groups = new Map<string, Session[]>();
  for (const s of sessions) {
    const key = getProjectKey(s);
    const list = groups.get(key);
    if (list) list.push(s);
    else groups.set(key, [s]);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => {
      const aLive = isLive(a, now);
      const bLive = isLive(b, now);
      if (aLive && !bLive) return -1;
      if (bLive && !aLive) return 1;
      return time(b) - time(a);
    });
  }
  const sorted = [...groups.entries()].sort(([, a], [, b]) => {
    const aActive = a.some((s) => isLive(s, now));
    const bActive = b.some((s) => isLive(s, now));
    if (aActive && !bActive) return -1;
    if (bActive && !aActive) return 1;
    return Math.max(...b.map(time)) - Math.max(...a.map(time));
  });
  return new Map(sorted);
}
