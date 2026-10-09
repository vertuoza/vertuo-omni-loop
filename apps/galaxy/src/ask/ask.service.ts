// The ask pages' reads, as rules over the repository (PRD 1318, s2; ADR-0095): the person's tab list
// (PRD 142), a session with its rounds and its terminal's heartbeat (PRD 757), and one round with its
// session, the session's other rounds and who it is shared with (PRD 144). Every member of a session's
// workspace reads it; a session or round of another workspace reads as missing (null). A failed read
// throws, so the controller answers 500 rather than an empty page.
import { sessionClosed } from './rows';
import { askReadRepository, wayBackRepository, type AskReadDb, type AskReadRepository, type RoundHead, type WayBackDb } from './ask.repository';
import type { BackRounds } from './page/back';
import type { QuestionState } from './page/question';
import { headerOf, type TabRound, type TabRow } from './page/tabs';
import type { RoundRow, SessionRow, SessionState } from './page/view';

/** What one session read carries: its rounds, and, when asked, its terminal's heartbeat. */
type SessionRead = { ping: boolean };

/** The heartbeat of the session's own Claude session, and of no other terminal: none when the session
 * names no Claude session, or when it cannot be read, which the tab reads as idle rather than failing
 * its poll. */
async function pingOf(repo: AskReadRepository, found: SessionRow): Promise<Pick<SessionState, 'ping'>> {
  if (!found.claude_session_id) return { ping: null };
  try {
    return { ping: await repo.ping(found.claude_session_id) };
  } catch (error) {
    console.error(error);
    return { ping: null };
  }
}

/** Whether `head` is later than `was`: by when it was asked, then by id. */
const later = (head: RoundHead, was: RoundHead | undefined) =>
  !was || Date.parse(head.created_at) - Date.parse(was.created_at) > 0 || (head.created_at === was.created_at && head.id > was.id);

export function askReadService(repo: AskReadRepository) {
  /** A session and all its rounds, as the caller may read them; null when it is missing or not theirs. */
  async function session(id: string, { ping }: SessionRead = { ping: true }): Promise<SessionState | null> {
    const found = await repo.session(id);
    if (!found) return null;
    const rounds = await repo.rounds(id);
    return { session: found, rounds, ...(ping ? await pingOf(repo, found) : {}) };
  }

  return {
    session,

    /** The person's tab list (PRD 142): the sessions `owner` opened that are open and seen within 12
     * hours, each with its newest round. Row-level security lets every member read a workspace's
     * sessions (PRD 144), so the read names the owner: a teammate's terminal is never a tab. A round's
     * questions never change, so `headers`, kept by a caller that reads again, holds each newest
     * round's header once read. */
    async tabs(owner: string, now: number, headers = new Map<string, string | null>()): Promise<TabRow[]> {
      const sessions = (await repo.openSessionsOf(owner)).filter((s) => !sessionClosed(s, now));
      if (!sessions.length) return [];
      const newest = new Map<string, RoundHead>();
      for (const head of await repo.roundHeads(sessions.map((s) => s.id))) {
        if (later(head, newest.get(head.session_id))) newest.set(head.session_id, head);
      }
      const missing = [...newest.values()].map((h) => h.id).filter((id) => !headers.has(id));
      if (missing.length) {
        for (const round of await repo.roundQuestions(missing)) headers.set(round.id, headerOf(round.questions));
      }
      return sessions.map((s) => {
        const head = newest.get(s.id);
        const round: TabRound | null = head ? { id: head.id, status: head.status, created_at: head.created_at, header: headers.get(head.id) ?? null } : null;
        return { session: s, newest: round };
      });
    },

    /** One round, its session, the session's other rounds and who the round is shared with; null when
     * the caller may not read it (another workspace) or it does not exist. */
    async question(roundId: string): Promise<QuestionState | null> {
      const found = await repo.round(roundId);
      if (!found) return null;
      const state = await session(found.session_id, { ping: false });
      if (!state) return null;
      const sharedWith = await repo.sharedWith(found.id);
      const only: RoundRow & { session_id?: string } = { ...found };
      delete only.session_id;
      return { session: state.session, round: only, earlier: state.rounds.filter((r) => r.id !== found.id), sharedWith };
    },
  };
}

export type AskReads = ReturnType<typeof askReadService>;

/** The reads on `db`, the client the controller was handed for this request. */
export const askReads = (db: AskReadDb): AskReads => askReadService(askReadRepository(db));

/** The way back from a question page (PRD 384): which of a dossier's rounds are open, in the order
 * asked, and nothing else of them. */
export type WayBack = (dossierId: string) => Promise<NonNullable<BackRounds>>;

/** The way back's read on `db`, the client the controller was handed for this request. */
export const askWayBack = (db: WayBackDb): WayBack => {
  const repo = wayBackRepository(db);
  return async (dossierId) => (await repo.rounds(dossierId)).map((r) => ({ round_id: r.round_id, status: r.status, created_at: r.created_at }));
};
