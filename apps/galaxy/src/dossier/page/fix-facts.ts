// A fix's page renders from fix_facts (PRD 902, s2), as the PRD page renders from its snapshot: the
// stored facts at once, refreshed after the response (`background`) while they are not final (no release
// yet, the sync's own rule); with none stored, one `interactive` read, rendered, then stored. A stored
// read that fails is no facts, and the page reads GitHub. A concept's page (PRD 1272, s4) reads its
// facts the same way, final once its concept PR has merged.
import type { Priority } from '@omni/github';
import type { ConceptFacts, FixSummary } from '../github/fix';
import { isConceptFinal, isFinal } from '../../fixes/facts/refresh';

export type StoredFactsDeps<T> = {
  /** The dossier's stored facts; null when it has none. */
  stored: () => Promise<T | null>;
  /** What GitHub says of the dossier now, at `priority`; null when it could not be read. */
  read: (priority: Priority) => Promise<T | null>;
  /** Stores what was read, each part it could not read kept as stored. */
  keep: (read: T) => Promise<void>;
  /** Runs `task` once the response is sent. */
  later: (task: () => Promise<void>) => void;
  log?: (error: unknown) => void;
};
export type FixFactsDeps = StoredFactsDeps<FixSummary>;

/** The facts the page renders; `final` facts are not read again. */
async function storedFacts<T>(deps: StoredFactsDeps<T>, final: (facts: T) => boolean): Promise<T | null> {
  const log = deps.log ?? console.error;
  const stored = await deps.stored().catch((error: unknown) => {
    log(error);
    return null;
  });
  if (stored) {
    if (!final(stored)) {
      deps.later(async () => {
        const read = await deps.read('background');
        if (read) await deps.keep(read);
      });
    }
    return stored;
  }
  const read = await deps.read('interactive');
  if (read) deps.later(() => deps.keep(read));
  return read;
}

/** The facts the fix's page renders. */
export function fixFacts(deps: FixFactsDeps): Promise<FixSummary | null> {
  return storedFacts(deps, isFinal);
}

/** The facts a concept's page renders (PRD 1272, s4). */
export function conceptFacts(deps: StoredFactsDeps<ConceptFacts>): Promise<ConceptFacts | null> {
  return storedFacts(deps, isConceptFinal);
}
