// Where the ask page reads its session, sends its answers and deletes it: straight to the database,
// as the signed-in person (their session cookie on the server, the browser client on the page), so
// the migrations' row-level security decides. Every member of the session's workspace reads it
// (PRD 144); only its owner answers or deletes. A session of another workspace reads as missing,
// exactly like one that never was. The page polls every 2 s; a poll reads the session and each round's status
// and category, and fetches a round's questions and answers again only when it is new or one of them moved.
// Any member sorts a round into one of six (PRD 144), through the database's own function for it.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Category } from '../classify';
import { askCategories, askStore, AskStoreError, type AskAnswers, type AskCategory } from '../store';
import type { RoundRow, SessionRow, SessionState } from './view';

export type Db = Pick<SupabaseClient, 'from'>;
/** What sorting a round needs: the database's functions. */
export type SortDb = Pick<SupabaseClient, 'rpc'>;

const SESSION = 'id, owner, title, status, created_at, last_seen_at, repo, branch';
const ROUND = 'id, questions, answers, answered_via, status, created_at, answered_at, prd, skill, model, tokens, cost_usd, answered_by, category, category_by';
const HEAD = 'id, status, category, category_by';

type Head = Pick<RoundRow, 'id' | 'status' | 'category' | 'category_by'>;

/** A round read before, whose status and category still hold: no need to fetch it again. */
const same = (known: RoundRow | undefined, head: Head) =>
  known !== undefined && known.status === head.status
  && (known.category ?? null) === (head.category ?? null) && (known.category_by ?? null) === (head.category_by ?? null);

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
    const heads = settle<Head[]>('read the rounds', await db.from('ask_rounds').select(HEAD).eq('session_id', id)) ?? [];
    const stale = heads.filter((h) => !same(known.get(h.id), h)).map((h) => h.id);
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

/** Deletes the session and its rounds for good: true when it went, false when the caller is not its
 * owner (row-level security deletes nothing) or it was already gone. */
export async function removeSession(db: Db, id: string): Promise<boolean> {
  return askStore(db).deleteSession(id);
}

/** Sets a round's category, or clears it with null: the category and who set it, or null when the
 * caller may not read the round. */
export async function sortRound(db: SortDb, roundId: string, category: Category | null): Promise<AskCategory | null> {
  return askCategories(db).set(roundId, category);
}

/** What the page needs from wherever its session lives: the database, or the demo in the browser. */
export type AskPort = {
  read(): Promise<SessionState | null>;
  send(roundId: string, answers: AskAnswers): Promise<'answered' | 'taken'>;
  remove(): Promise<boolean>;
  sort(roundId: string, category: Category | null): Promise<AskCategory | null>;
};

/** The database, as the signed-in person, starting from what the server already read. */
export function databasePort(db: Db & SortDb, seed: SessionState): AskPort {
  return {
    read: sessionReader(db, seed.session.id, seed),
    send: (roundId, answers) => sendAnswers(db, roundId, answers),
    remove: () => removeSession(db, seed.session.id),
    sort: (roundId, category) => sortRound(db, roundId, category),
  };
}
