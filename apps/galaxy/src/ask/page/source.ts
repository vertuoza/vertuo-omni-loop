// Where the ask page reads its session, sends its answers and deletes it: straight to the database,
// as the signed-in person (their session cookie on the server, the browser client on the page), so
// the migrations' row-level security decides. Every member of the session's workspace reads it
// (PRD 144); only its owner answers or deletes. A session of another workspace reads as missing,
// exactly like one that never was. The page polls every 2 s; a poll reads the session and each round's status
// and category, and fetches a round's questions and answers again only when it is new or one of them moved.
// Any member sorts a round into one of six (PRD 144), through the database's own function for it.
// The owner shares a round with another member (PRD 144), who then answers it at /ask/q/<round>
// while it is open; /ask/for-me lists the rounds shared with the caller; /ask/history reads every
// round of the caller's workspaces.
// An answer's screenshots (PRD 620) go to the bucket first, as the same person: see attachments.ts.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Category } from '../classify';
import {
  askCategories, askShares, askStore, AskStoreError, ATTACHMENTS_BUCKET, sessionClosed, type AskAnswers, type AskAttachments, type AskCategory,
} from '../store';
import { sendWithShots, trayOf, type Bucket } from './attachments';
import type { ForMeRow, Member, QuestionState } from './question';
import { headerOf, type TabRound, type TabRow } from './tabs';
import type { RoundRow, SessionRow, SessionState } from './view';
import type { HistoryRow } from './workspace-history';

export type Db = Pick<SupabaseClient, 'from'>;
/** What uploading a round's screenshots needs (PRD 620): the storage client. */
export type StorageDb = Pick<SupabaseClient, 'storage'>;
/** What sorting a round needs: the database's functions. */
export type SortDb = Pick<SupabaseClient, 'rpc'>;

const SESSION = 'id, owner, title, status, created_at, last_seen_at, workspace_id, repo, branch';
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

const ROUND_HEAD = 'id, session_id, status, created_at';

/** A reader for the person's tab list (PRD 142): the sessions `owner` opened that are open and seen
 * within 12 hours, each with its newest round. Row-level security lets every member of a workspace
 * read its sessions (PRD 144), so the read names the owner: a teammate's terminal is never a tab. A
 * round's questions never change, so each is fetched once, for its header, and only for a newest
 * round. */
export function tabsReader(db: Db, owner: string): (now: number) => Promise<TabRow[]> {
  const headers = new Map<string, string | null>();
  return async (now) => {
    const sessions = (settle<SessionRow[]>('read the sessions', await db.from('ask_sessions').select(SESSION).eq('owner', owner).eq('status', 'open')) ?? [])
      .filter((s) => !sessionClosed(s, now));
    if (!sessions.length) return [];
    type Head = Pick<RoundRow, 'id' | 'status' | 'created_at'> & { session_id: string };
    const heads = settle<Head[]>('read the rounds', await db.from('ask_rounds').select(ROUND_HEAD).in('session_id', sessions.map((s) => s.id))) ?? [];
    const newest = new Map<string, Head>();
    for (const head of heads) {
      const was = newest.get(head.session_id);
      const later = !was || Date.parse(head.created_at) - Date.parse(was.created_at) > 0 || (head.created_at === was.created_at && head.id > was.id);
      if (later) newest.set(head.session_id, head);
    }
    const missing = [...newest.values()].map((h) => h.id).filter((id) => !headers.has(id));
    if (missing.length) {
      const fresh = settle<Pick<RoundRow, 'id' | 'questions'>[]>('read the rounds', await db.from('ask_rounds').select('id, questions').in('id', missing)) ?? [];
      for (const round of fresh) headers.set(round.id, headerOf(round.questions));
    }
    return sessions.map((session) => {
      const head = newest.get(session.id);
      const round: TabRound | null = head ? { id: head.id, status: head.status, created_at: head.created_at, header: headers.get(head.id) ?? null } : null;
      return { session, newest: round };
    });
  };
}

/** The person's tab list, read once (the server's first render). */
export const readTabs = (db: Db, owner: string, now: number) => tabsReader(db, owner)(now);

/** Answers a round from the page, only while it is still open: `taken` when the terminal took it
 * over or it was answered already (s2's rule: the page never answers a round it no longer holds).
 * The screenshots the answer form staged for the round (PRD 620) are uploaded first and recorded with
 * the answer; a failed upload throws, having recorded nothing. */
export async function sendAnswers(db: Db & Partial<StorageDb>, roundId: string, answers: AskAnswers): Promise<'answered' | 'taken'> {
  const record = async (attachments?: AskAttachments) => {
    const to = attachments ? { status: 'answered' as const, answers, answered_via: 'page' as const, attachments } : { status: 'answered' as const, answers, answered_via: 'page' as const };
    return (await askStore(db).moveRound(roundId, ['open'], to)) ? 'answered' as const : 'taken' as const;
  };
  const tray = trayOf(roundId);
  if (!db.storage || Object.keys(tray.shots).length === 0) return record();
  const bucket = db.storage.from(ATTACHMENTS_BUCKET) as unknown as Bucket;
  return sendWithShots(bucket, roundId, tray, record, (progress) => tray.setProgress(progress));
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

/** Shares a round with another member of the session's workspace: false when the caller does not own
 * the session, or the member is not in its workspace. */
export async function shareRound(db: Db & SortDb, roundId: string, member: string): Promise<boolean> {
  return askShares(db).share(roundId, member);
}

/** The members of a workspace the caller belongs to; none when there is no workspace, or it fails
 * (sharing is then not offered, and answers name nobody). */
export async function readMembers(db: Db & SortDb, workspaceId: string | null | undefined): Promise<Member[]> {
  if (!workspaceId) return [];
  try {
    return await askShares(db).members(workspaceId);
  } catch (error) {
    console.error(error);
    return [];
  }
}

type RoundWithSession = RoundRow & { session_id: string };

/** One round, its session, the session's other rounds and who the round is shared with; null when
 * the caller may not read it (another workspace) or it does not exist. */
export async function readQuestion(db: Db & SortDb, roundId: string): Promise<QuestionState | null> {
  const round = settle<RoundWithSession>('read the round', await db.from('ask_rounds').select(`${ROUND}, session_id`).eq('id', roundId).maybeSingle());
  if (!round) return null;
  const state = await readSession(db, round.session_id);
  if (!state) return null;
  const shares = await askShares(db).ofRound(round.id);
  const { session_id: _session, ...only } = round;
  return { session: state.session, round: only, earlier: state.rounds.filter((r) => r.id !== round.id), sharedWith: shares.map((s) => s.shared_with) };
}

/** Every open round shared with `me`, with its session and who shared it. */
export async function readForMe(db: Db & SortDb, me: string): Promise<ForMeRow[]> {
  const shares = await askShares(db).withMe(me);
  if (shares.length === 0) return [];
  const rounds = settle<RoundWithSession[]>('read the rounds',
    await db.from('ask_rounds').select(`${ROUND}, session_id`).in('id', shares.map((s) => s.round_id)).eq('status', 'open')) ?? [];
  if (rounds.length === 0) return [];
  const sessions = settle<SessionRow[]>('read the sessions',
    await db.from('ask_sessions').select(SESSION).in('id', [...new Set(rounds.map((r) => r.session_id))])) ?? [];
  return rounds.flatMap(({ session_id: sessionId, ...round }) => {
    const session = sessions.find((s) => s.id === sessionId);
    const share = shares.find((s) => s.round_id === round.id);
    return session && share ? [{ round, session, sharedBy: share.shared_by }] : [];
  });
}

/** How many of the newest rounds the history reads; filters and search narrow within them. */
export const HISTORY_LIMIT = 1000;

/** The newest rounds of every workspace the caller belongs to (row-level security reads no other),
 * each with its session, newest first. */
export async function readHistory(db: Db, limit = HISTORY_LIMIT): Promise<HistoryRow[]> {
  const rounds = settle<RoundWithSession[]>('read the history',
    await db.from('ask_rounds').select(`${ROUND}, session_id`).order('created_at', { ascending: false }).limit(limit)) ?? [];
  if (rounds.length === 0) return [];
  const sessions = settle<SessionRow[]>('read the sessions',
    await db.from('ask_sessions').select(SESSION).in('id', [...new Set(rounds.map((r) => r.session_id))])) ?? [];
  return rounds.flatMap(({ session_id: sessionId, ...round }) => {
    const session = sessions.find((s) => s.id === sessionId);
    return session ? [{ round, session }] : [];
  });
}

/** What the page needs from wherever its session lives: the database, or the demo in the browser. */
export type AskPort = {
  read(): Promise<SessionState | null>;
  send(roundId: string, answers: AskAnswers): Promise<'answered' | 'taken'>;
  remove(): Promise<boolean>;
  sort(roundId: string, category: Category | null): Promise<AskCategory | null>;
  share(roundId: string, member: string): Promise<boolean>;
};

/** The database, as the signed-in person, starting from what the server already read. */
export function databasePort(db: Db & SortDb & StorageDb, seed: SessionState): AskPort {
  return {
    read: sessionReader(db, seed.session.id, seed),
    send: (roundId, answers) => sendAnswers(db, roundId, answers),
    remove: () => removeSession(db, seed.session.id),
    sort: (roundId, category) => sortRound(db, roundId, category),
    share: (roundId, member) => shareRound(db, roundId, member),
  };
}

/** What the question page needs: its one round, read again and again, answered and sorted. */
export type QuestionPort = {
  read(): Promise<QuestionState | null>;
  send(roundId: string, answers: AskAnswers): Promise<'answered' | 'taken'>;
  sort(roundId: string, category: Category | null): Promise<AskCategory | null>;
};

/** The database, as the signed-in person, for one round. */
export function questionPort(db: Db & SortDb & StorageDb, roundId: string): QuestionPort {
  return {
    read: () => readQuestion(db, roundId),
    send: (id, answers) => sendAnswers(db, id, answers),
    sort: (id, category) => sortRound(db, id, category),
  };
}

/** What the tab list needs from wherever the sessions live: the database, or the demo. */
export type TabsPort = { list(now: number): Promise<TabRow[]> };

export const databaseTabs = (db: Db, owner: string): TabsPort => ({ list: tabsReader(db, owner) });
