// A fix's page renders from fix_facts (PRD 902, s2), as the PRD page renders from its snapshot: the
// stored facts at once, refreshed after the response (`background`) while they are not final (no release
// yet, the sync's own rule); with none stored, one `interactive` read, rendered, then stored. A stored
// read that fails is no facts, and the page reads GitHub.
import type { Priority } from '@omni/github';
import type { FixSummary } from '../github/fix';
import { isFinal } from '../../fixes/facts/refresh';

export type FixFactsDeps = {
  /** The fix's stored facts; null when it has none. */
  stored: () => Promise<FixSummary | null>;
  /** What GitHub says of the fix now, at `priority`; null when it could not be read. */
  read: (priority: Priority) => Promise<FixSummary | null>;
  /** Stores what was read, each part it could not read kept as stored. */
  keep: (read: FixSummary) => Promise<void>;
  /** Runs `task` once the response is sent. */
  later: (task: () => Promise<void>) => void;
  log?: (error: unknown) => void;
};

/** The facts the fix's page renders. */
export async function fixFacts(deps: FixFactsDeps): Promise<FixSummary | null> {
  const log = deps.log ?? console.error;
  const stored = await deps.stored().catch((error: unknown) => {
    log(error);
    return null;
  });
  if (stored) {
    if (!isFinal(stored)) {
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
