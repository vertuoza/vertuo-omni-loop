import { createBrowserClient } from '@supabase/ssr';
import { dossierRoundsReader } from './back';
import { removeSession, sendAnswers, shareRound, sortRound, type AskPort, type QuestionPort } from './source';
import type { Database } from '../../../../../supabase/database.types';

// What the ask pages still write from the browser, as the signed-in person (PRD 1318, s2): answering,
// sorting, sharing and deleting, and the way back's read of a dossier's rounds. The pages read through
// /api/ask/* (src/ask/ask.client.ts) and build no Supabase client themselves; these writes keep the
// browser client here, in one place, until PRD 1318's s3 moves them behind the same controllers the
// terminal calls, and this file goes.

/** The Supabase public pair the browser writes with. */
export type PublicPair = { url: string; key: string };

const clientOf = (pair: PublicPair) => createBrowserClient<Database>(pair.url, pair.key);

/** A session's writes, as its page sends them. */
export function sessionWrites(pair: PublicPair, sessionId: string): Omit<AskPort, 'read'> {
  const db = clientOf(pair);
  return {
    send: (roundId, answers) => sendAnswers(db, roundId, answers),
    remove: () => removeSession(db, sessionId),
    sort: (roundId, category) => sortRound(db, roundId, category),
    share: (roundId, member) => shareRound(db, roundId, member),
  };
}

/** A shared round's writes, as its page sends them. */
export function questionWrites(pair: PublicPair): Omit<QuestionPort, 'read'> {
  const db = clientOf(pair);
  return {
    send: (roundId, answers) => sendAnswers(db, roundId, answers),
    sort: (roundId, category) => sortRound(db, roundId, category),
  };
}

/** The dossier's rounds the way back reads after an answer (PRD 384). */
export const dossierRoundsOf = (pair: PublicPair) => dossierRoundsReader(clientOf(pair));
