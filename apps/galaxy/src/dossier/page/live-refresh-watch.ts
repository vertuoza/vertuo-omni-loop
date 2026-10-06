import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from '../../../../../supabase/database.types.ts';
import { parseRow } from '../../data/parse-rows';
import type { DossierPulse } from '../store';
import { watchChanges, type LivePulse } from './live';

// Calmer polling (PRD 657, s10): the PRD page re-renders from the server only when new work appears,
// a new version of any kind or a new round, and the dossier being gone. An answer, the stage or the
// outbox count moving no longer re-runs the whole server tree. The watch is live.ts's own
// (`watchChanges`, its three-failures problem included), fed a pulse and a starting signature that
// keep only the new-work part: the rounds asked and each kind's version count.
// PRD 902, s2: on a numbered PRD's page, the same poll also reads when its GitHub snapshot was read
// (dossier_github's read_at, as the member), and refreshes when it moves: a refresh run after the
// response, or by a webhook, shows on the open page. Its first read is the baseline; a read that fails
// leaves the last one known.

/** The pulse, with when the PRD's GitHub snapshot was read: `none` with no snapshot, left out when it
 * is not watched or could not be read. */
export type WatchedPulse = DossierPulse & { githubReadAt?: string };

const ReadAtRow = z.object({ read_at: z.string() });

/** When the dossier's GitHub snapshot was read, as the member reads it; `none` with no snapshot. */
export async function readGithubReadAt(db: Pick<SupabaseClient<Database>, 'from'>, id: string): Promise<string> {
  const { data, error } = await db.from('dossier_github').select('read_at').eq('dossier_id', id).maybeSingle();
  if (error) throw new Error(`Supabase refused to read the GitHub snapshot: ${error.message}`);
  if (data === null) return 'none';
  const row = parseRow(ReadAtRow, data, 'dossier/page: dossier_github');
  if (!row.ok) throw new Error(row.error);
  return row.value.read_at;
}

/** `read`, with when the GitHub snapshot was read from `readAt`; left out when that read fails. */
export function withGithubReadAt(read: () => Promise<DossierPulse | null>, readAt: () => Promise<string>): () => Promise<WatchedPulse | null> {
  return async () => {
    const [pulse, at] = await Promise.all([read(), readAt().catch(() => undefined)]);
    return pulse && (at === undefined ? pulse : { ...pulse, githubReadAt: at });
  };
}

/** A signature (live.ts) as its new-work part: the answered count set to 0 and the GitHub part
 * dropped, so it equals `signature(newWorkPulse(pulse))`. Null stays null (no baseline yet). */
export function newWorkKey(value: string | null): string | null {
  if (value === null) return null;
  const at = value.indexOf('#');
  const counts = at < 0 ? value : value.slice(0, at);
  const match = /^(\d+)\/\d+\|(.*)$/.exec(counts);
  return match ? `${match[1]}/0|${match[2]}` : counts;
}

/** The pulse as its new-work part: no answered count, and of GitHub only when its snapshot was read. */
const newWorkPulse = (pulse: WatchedPulse | null): LivePulse | null => {
  if (!pulse) return null;
  const work: LivePulse = { asked: pulse.asked, answered: 0, latest: pulse.latest };
  return pulse.githubReadAt === undefined ? work : { ...work, github: { stage: 'unknown', open: null, readAt: pulse.githubReadAt } };
};

type Watch = {
  /** The signature the page was rendered with; null to take the first read as the baseline. */
  initial: string | null;
  read: () => Promise<WatchedPulse | null>;
  /** A new version or round appeared, or GitHub was read again: re-render from the server. */
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
