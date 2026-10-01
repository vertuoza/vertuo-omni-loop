// Which recorded draft a push numbers (PRD 216's spec, "The kit"): the unnumbered draft this
// terminal's Claude session opened, or else the only unnumbered one. With several and no session id,
// none — and the push finds or creates PRD n's dossier by its key instead.
//
// Two guards keep a push from numbering another brainstorm's draft, which would merge that draft,
// its questions and all, into the wrong PRD:
// - a terminal with a session id never takes a draft another Claude session opened;
// - once PRD n was numbered from this computer, a later push of n takes no draft but its own session's:
//   the push reaches PRD n's dossier by its key.

/** A draft `omni dossier open` recorded on this computer; `prd` is null until a push numbers it. */
export type DossierEntry = { id: string; url: string; claudeSessionId: string | null; prd: number | null; openedAt: string };

/** The draft a push of PRD `prd` numbers, from `entries` in the order they were recorded, or none. */
export function chooseDraft(entries: readonly DossierEntry[], { prd, claudeSessionId }: { prd: number; claudeSessionId: string | null }): DossierEntry | null {
  const unnumbered = entries.filter((entry) => entry.prd === null);
  if (claudeSessionId) {
    const mine = unnumbered.filter((entry) => entry.claudeSessionId === claudeSessionId);
    const latest = mine.at(-1);
    if (latest) return latest;
  }
  if (entries.some((entry) => entry.prd === prd)) return null;
  const free = claudeSessionId ? unnumbered.filter((entry) => entry.claudeSessionId === null) : unnumbered;
  return free.length === 1 ? (free[0] ?? null) : null;
}
