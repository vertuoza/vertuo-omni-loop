import type { DossierPulse } from '../store';
import { watchChanges, type LivePulse } from './live';

// Calmer polling (PRD 657, s10): the PRD page re-renders from the server only when new work appears,
// a new version of any kind or a new round, and the dossier being gone. An answer, the stage or the
// outbox count moving no longer re-runs the whole server tree. The watch is live.ts's own
// (`watchChanges`, its three-failures problem included), fed a pulse and a starting signature that
// keep only the new-work part: the rounds asked and each kind's version count.

/** A signature (live.ts) as its new-work part: the answered count set to 0 and the GitHub part
 * dropped, so it equals `signature(newWorkPulse(pulse))`. Null stays null (no baseline yet). */
export function newWorkKey(value: string | null): string | null {
  if (value === null) return null;
  const at = value.indexOf('#');
  const counts = at < 0 ? value : value.slice(0, at);
  const match = /^(\d+)\/\d+\|(.*)$/.exec(counts);
  return match ? `${match[1]}/0|${match[2]}` : counts;
}

/** The pulse as its new-work part: no answered count, no GitHub part. */
const newWorkPulse = (pulse: DossierPulse | null): LivePulse | null =>
  pulse && { asked: pulse.asked, answered: 0, latest: pulse.latest };

type Watch = {
  /** The signature the page was rendered with; null to take the first read as the baseline. */
  initial: string | null;
  read: () => Promise<DossierPulse | null>;
  /** A new version or round appeared: re-render from the server. */
  onChange: () => void;
  /** The problem to show, or null to show none. */
  onProblem: (problem: string | null) => void;
};

/** The tick `poll()` runs: it asks for a refresh only on new work, and never ends the polling. */
export function watchNewWork({ initial, read, onChange, onProblem }: Watch): () => Promise<boolean> {
  return watchChanges({
    initial: newWorkKey(initial),
    read: async () => newWorkPulse(await read()),
    onChange,
    onProblem,
  });
}
