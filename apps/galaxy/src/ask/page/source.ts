// Where the ask page reads its session, sends its answers and deletes it: straight to the database,
// as the signed-in person (their session cookie on the server, the browser client on the page), so
// the migrations' row-level security decides. Every member of the session's workspace reads it
// (PRD 144); only its owner answers or deletes. A session of another workspace reads as missing,
// exactly like one that never was. Since PRD 1318 (s2) the pages poll through /api/ask/*
// (src/ask/ask.client.ts), and the tabs, a session and a shared round are read by
// src/ask/ask.service.ts: the readers here delegate to it, for the server's first render and for the
// areas that still import them (the bell, the dashboard's counts).
// Any member sorts a round into one of six (PRD 144), through the database's own function for it.
// The owner shares a round with another member (PRD 144), who then answers it at /ask/q/<round>
// while it is open; /ask/for-me lists the rounds shared with the caller; /ask/history reads every
// round of the caller's workspaces.
// An answer's screenshots (PRD 620) go to the bucket first, as the same person: see attachments.ts.
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadPeople, type People } from '../../people/load';
import type { Category } from '../classify';
import { memberLabel, type AskAnswers, type AskAttachments, type AskCategory } from '../rows';
import { sendWithShots, trayOf, type Bucket } from './attachments';
import type { ForMeRow, Member, QuestionState } from './question';
import type { TabRow } from './tabs';
import type { RoundRow, SessionRow, SessionState } from './view';
import { askAttachments, askCategories, askReadRepository, askShares, askStore, type RoundWithSession } from '../ask.repository';
import { askReadService } from '../ask.service';
import type { WorkingPing } from '../../working/state';
import { workingReader } from '../../working/store';
import type { HistoryRow } from './workspace-history';

export type Db = Pick<SupabaseClient, 'from'>;
/** What uploading a round's screenshots needs (PRD 620): the storage client. */
export type StorageDb = Pick<SupabaseClient, 'storage'>;
/** What sorting a round needs: the database's functions. */
export type SortDb = Pick<SupabaseClient, 'rpc'>;

/** Reads the latest heartbeat of a Claude session (PRD 757): `workingReader(db).forSession`. */
export type PingRead = (claudeSessionId: string) => Promise<WorkingPing | null>;

/** The heartbeat reader the page uses, as the signed-in person: row-level security reads a teammate's
 * terminal only within the same workspace. */
export const sessionPings = (db: Db): PingRead => {
  const reader = workingReader(db);
  return (claudeSessionId) => reader.forSession(claudeSessionId);
};

/** The ask reads on `db` (src/ask/ask.service.ts, PRD 1318), with the heartbeat read through `pings`. */
const readsOn = (db: Db, pings?: PingRead) => askReadService({ ...askReadRepository(db), ...(pings ? { ping: pings } : {}) });

/** A session and all its rounds, as the caller may read them; null when it is missing or not theirs.
 * With `pings`, also the heartbeat of its Claude session (PRD 757). */
export async function readSession(db: Db, id: string, pings?: PingRead): Promise<SessionState | null> {
  return readsOn(db, pings).session(id, { ping: pings !== undefined });
}

/** A reader for the person's tab list (PRD 142), read through the ask service: each newest round's
 * header is fetched once, for as long as the reader lives. */
export function tabsReader(db: Db, owner: string): (now: number) => Promise<TabRow[]> {
  const headers = new Map<string, string | null>();
  const reads = readsOn(db);
  return (now) => reads.tabs(owner, now, headers);
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
  const bucket: Bucket = askAttachments({ storage: db.storage }).bucket();
  return sendWithShots(bucket, roundId, tray, record, (progress) => {
    tray.setProgress(progress);
  });
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
    const [members, people] = await Promise.all([askShares(db).members(workspaceId), loadPeople(db, workspaceId)]);
    return withFaces(members, people);
  } catch (error) {
    console.error(error);
    return [];
  }
}

/** Each member with the face the people directory decides for them, by account id (PRD 652). A
 * directory that could not be read decides the initial of the name the screens print. */
export const withFaces = (members: Member[], people: People): Member[] =>
  members.map((m) => ({ ...m, face: people.byId(m.user_id, memberLabel(m)).face }));

/** One round, its session, the session's other rounds and who the round is shared with; null when
 * the caller may not read it (another workspace) or it does not exist. */
export async function readQuestion(db: Db, roundId: string): Promise<QuestionState | null> {
  return readsOn(db).question(roundId);
}

/** Each round with the session it belongs to; a round whose session is not readable is left out. */
async function withSessions(db: Db, rounds: RoundWithSession[]): Promise<Array<{ round: RoundRow; session: SessionRow }>> {
  if (rounds.length === 0) return [];
  const sessions = await askReadRepository(db).sessionsIn([...new Set(rounds.map((r) => r.session_id))]);
  return rounds.flatMap(({ session_id: sessionId, ...round }) => {
    const session = sessions.find((s) => s.id === sessionId);
    return session ? [{ round, session }] : [];
  });
}

/** Every open round shared with `me`, with its session and who shared it. */
export async function readForMe(db: Db & SortDb, me: string): Promise<ForMeRow[]> {
  const shares = await askShares(db).withMe(me);
  if (shares.length === 0) return [];
  const rounds = await askReadRepository(db).openRoundsIn(shares.map((s) => s.round_id));
  return (await withSessions(db, rounds)).flatMap(({ round, session }) => {
    const share = shares.find((s) => s.round_id === round.id);
    return share ? [{ round, session, sharedBy: share.shared_by }] : [];
  });
}

/** How many of the newest rounds the history reads; filters and search narrow within them. */
export const HISTORY_LIMIT = 1000;

/** The newest rounds of every workspace the caller belongs to (row-level security reads no other),
 * each with its session, newest first. */
export async function readHistory(db: Db, limit = HISTORY_LIMIT): Promise<HistoryRow[]> {
  return withSessions(db, await askReadRepository(db).newestRounds(limit));
}

/** What the page needs from wherever its session lives: the database, or the demo in the browser. */
export type AskPort = {
  read(): Promise<SessionState | null>;
  send(roundId: string, answers: AskAnswers): Promise<'answered' | 'taken'>;
  remove(): Promise<boolean>;
  sort(roundId: string, category: Category | null): Promise<AskCategory | null>;
  share(roundId: string, member: string): Promise<boolean>;
};

/** What the question page needs: its one round, read again and again, answered and sorted. */
export type QuestionPort = {
  read(): Promise<QuestionState | null>;
  send(roundId: string, answers: AskAnswers): Promise<'answered' | 'taken'>;
  sort(roundId: string, category: Category | null): Promise<AskCategory | null>;
};

/** What the tab list needs from wherever the sessions live: the database, or the demo. */
export type TabsPort = { list(now: number): Promise<TabRow[]> };

