import type { SupabaseClient } from '@supabase/supabase-js';
import { dossierRounds } from '../../dossier/store';
import { wayBack, type WayBack } from '../../dossier/page/view';
import { isDossierId } from '../../dossier/page/source';
import type { QuestionView } from './question';

// The way back from /ask/q/<round> (PRD 384). Opened from a PRD page, the link carries the dossier it
// came from (`?from=<dossier id>`); once the person's send is read back as answered by them, the page
// goes back to that dossier's Questions tab, at its next round still open, read again after the answer.
// With no `from`, or one that is no dossier id, it goes to the ask page of the round's session. Someone
// else answering first changes nothing: the page stays where it is.

/** A dossier's rounds, as the way back needs them; null when they cannot be read. */
export type BackRounds = WayBack['rounds'];

type Back = {
  /** The page's view, read after the send. */
  view: QuestionView;
  from: string | null;
  sessionId: string;
  roundId: string;
  readRounds: (dossierId: string) => Promise<BackRounds>;
};

/** Where to go once the send is read back, or null to stay: only an answer given by this person moves the page. */
export async function backAfterSend({ view, from, sessionId, roundId, readRounds }: Back): Promise<string | null> {
  if (view.kind !== 'answered' || !view.byMe) return null;
  let rounds: BackRounds = null;
  if (from !== null && isDossierId(from)) {
    try {
      rounds = await readRounds(from);
    } catch {
      rounds = null;
    }
  }
  return wayBack({ from, sessionId, roundId, rounds });
}

/** The dossier's rounds, read from the browser as the signed-in person. */
export const dossierRoundsReader = (db: Pick<SupabaseClient, 'rpc'>) => (dossierId: string): Promise<BackRounds> => dossierRounds(db, dossierId);

/** The demo keeps no dossier: the way back goes to the Questions tab alone. */
export const noRounds = (): Promise<BackRounds> => Promise.resolve(null);
