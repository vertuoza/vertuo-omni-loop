// Where the ask page reads its session and sends its answers: straight to the database, as the
// signed-in person (their session cookie on the server, the browser client on the page), so the
// migration's row-level security decides. Another person's session reads as missing, exactly like
// one that never was. The page polls every 2 s; a poll reads the session and each round's status,
// and fetches a round's questions and answers again only when it is new or its status moved.
import type { SupabaseClient } from '@supabase/supabase-js';
import { askStore, AskStoreError, type AskAnswers } from '../store';
import type { RoundRow, SessionRow, SessionState } from './view';

export type Db = Pick<SupabaseClient, 'from'>;

const SESSION = 'id, owner, title, status, created_at, last_seen_at';
const ROUND = 'id, questions, answers, answered_via, status, created_at, answered_at';
const HEAD = 'id, status';

type Outcome<T> = { data: T | null; error: { code?: string; message: string } | null };

function settle<T>(what: string, { data, error }: Outcome<T>): T | null {
  if (error) throw new AskStoreError(what, error.code, error.message);
  return data;
}

async function session(db: Db, id: string): Promise<SessionRow | null> {
  return settle('read the session', await db.from('ask_sessions').select(SESSION).eq('id', id).maybeSingle());
}

/** A session and all its rounds, as the caller may read them; null when it is missing or not theirs. */
export async function readSession(db: Db, id: string): Promise<SessionState | null> {
  const found = await session(db, id);
  if (!found) return null;
  const rounds = settle<RoundRow[]>('read the rounds', await db.from('ask_rounds').select(ROUND).eq('session_id', id));
  return { session: found, rounds: rounds ?? [] };
}

/** A reader for polling one session, starting from what was already read (`seed`). */
export function sessionReader(db: Db, id: string, seed?: SessionState | null): () => Promise<SessionState | null> {
  const known = new Map<string, RoundRow>((seed?.rounds ?? []).map((r) => [r.id, r]));
  return async () => {
    const found = await session(db, id);
    if (!found) return null;
    const heads = settle<Pick<RoundRow, 'id' | 'status'>[]>('read the rounds', await db.from('ask_rounds').select(HEAD).eq('session_id', id)) ?? [];
    const stale = heads.filter((h) => known.get(h.id)?.status !== h.status).map((h) => h.id);
    if (stale.length) {
      const fresh = settle<RoundRow[]>('read the rounds', await db.from('ask_rounds').select(ROUND).in('id', stale)) ?? [];
      for (const round of fresh) known.set(round.id, round);
    }
    const rounds = heads.map((h) => known.get(h.id)).filter((r): r is RoundRow => r !== undefined);
    return { session: found, rounds };
  };
}

/** Answers a round from the page, only while it is still open: `taken` when the terminal took it
 * over or it was answered already (s2's rule: the page never answers a round it no longer holds). */
export async function sendAnswers(db: Db, roundId: string, answers: AskAnswers): Promise<'answered' | 'taken'> {
  const moved = await askStore(db).moveRound(roundId, ['open'], { status: 'answered', answers, answered_via: 'page' });
  return moved ? 'answered' : 'taken';
}

/** What the page needs from wherever its session lives: the database, or the demo in the browser. */
export type AskPort = {
  read(): Promise<SessionState | null>;
  send(roundId: string, answers: AskAnswers): Promise<'answered' | 'taken'>;
};

/** The database, as the signed-in person, starting from what the server already read. */
export function databasePort(db: Db, seed: SessionState): AskPort {
  return { read: sessionReader(db, seed.session.id, seed), send: (roundId, answers) => sendAnswers(db, roundId, answers) };
}
