// The page refreshes itself (PRD 384, part 5). While the tab is visible, every 2 s, the page asks the
// database one small question (the dossier's pulse: how many rounds, how many answered, the latest
// version of each artifact) and compares its signature with the last one. Only when it moved does the
// page re-render from the server, in place. A failed read does nothing visible; three in a row say the
// server cannot be reached, until a read works again.
import { DOSSIER_KINDS, type DossierKind, type DossierPulse } from '../store';
import type { DossierRead } from './view';

/** How many failed reads in a row before the page says so. */
export const FAILURES_BEFORE_PROBLEM = 3;
export const LIVE_PROBLEM = 'Cannot reach the server. Trying again every few seconds.';

/** The pulse as one string: equal exactly when the counts and every kind's latest version are. A
 * dossier that is gone (null) has a signature of its own. */
export function signature(pulse: DossierPulse | null): string {
  if (!pulse) return 'gone';
  const versions = DOSSIER_KINDS.map((kind) => `${kind}:${pulse.latest[kind] ?? 0}`).join(',');
  return `${pulse.asked}/${pulse.answered}|${versions}`;
}

/** The pulse of what the page was rendered from, so the first check compares against it; null when
 * its rounds could not be read, and the first check sets the baseline instead. */
export function pulseOf(read: DossierRead): DossierPulse | null {
  if (!read.rounds) return null;
  const latest: Partial<Record<DossierKind, number>> = {};
  for (const version of read.versions) latest[version.kind] = (latest[version.kind] ?? 0) + 1;
  return { asked: read.rounds.length, answered: read.rounds.filter((r) => r.status === 'answered').length, latest };
}

type Watch = {
  /** The signature the page was rendered with; null to take the first read as the baseline. */
  initial: string | null;
  read: () => Promise<DossierPulse | null>;
  /** The signature moved: re-render from the server. */
  onChange: () => void;
  /** The problem to show, or null to show none. */
  onProblem: (problem: string | null) => void;
};

/** The tick `poll()` runs: it never ends the polling. */
export function watchChanges({ initial, read, onChange, onProblem }: Watch): () => Promise<boolean> {
  let last = initial;
  let failures = 0;
  return async () => {
    let next: string;
    try {
      next = signature(await read());
    } catch {
      failures += 1;
      if (failures >= FAILURES_BEFORE_PROBLEM) onProblem(LIVE_PROBLEM);
      return true;
    }
    failures = 0;
    onProblem(null);
    if (last !== null && next !== last) onChange();
    last = next;
    return true;
  };
}
