// The ask pages' reads (PRD 1318, s2; ADR-0095): every query the tabs, a session and a shared round
// send, on the client it is given, as the signed-in person, so row-level security has the last word. A
// session or round of another workspace reads as missing, exactly like one that never was; a failed
// read throws AskStoreError. No rule lives here: which sessions make a tab and which round is newest
// is ask.service.ts's. The client is handed in, not built: the controller passes the viewer's, and the
// readers other areas still import from src/ask/page/source.ts pass theirs until their own PRD moves
// them.
import type { SupabaseClient } from '@supabase/supabase-js';
import { settle } from './store';
import type { RoundRow, SessionRow } from './page/view';
import type { WorkingPing } from '../working/state';
import { workingReader } from '../working/store';

/** What the reads need: the tables. */
export type AskReadDb = Pick<SupabaseClient, 'from'>;

const SESSION = 'id, owner, title, status, created_at, last_seen_at, workspace_id, repo, branch, claude_session_id';
const ROUND = 'id, questions, answers, answered_via, status, created_at, answered_at, attachments, prd, skill, model, tokens, cost_usd, answered_by, category, category_by, lead';
const ROUND_HEAD = 'id, session_id, status, created_at';

/** A round with the session it belongs to. */
type RoundWithSession = RoundRow & { session_id: string };
/** A round as the tab list first reads it: enough to tell which is a session's newest. */
export type RoundHead = Pick<RoundRow, 'id' | 'status' | 'created_at'> & { session_id: string };

export function askReadRepository(db: AskReadDb) {
  return {
    /** One session, or null when it is missing or of another workspace. */
    async session(id: string): Promise<SessionRow | null> {
      return settle('read the session', await db.from('ask_sessions').select(SESSION).eq('id', id).maybeSingle());
    },

    /** Every round of a session. */
    async rounds(sessionId: string): Promise<RoundRow[]> {
      return settle<RoundRow[]>('read the rounds', await db.from('ask_rounds').select(ROUND).eq('session_id', sessionId)) ?? [];
    },

    /** One round with its session id, or null when it is missing or of another workspace. */
    async round(id: string): Promise<RoundWithSession | null> {
      return settle<RoundWithSession>('read the round', await db.from('ask_rounds').select(`${ROUND}, session_id`).eq('id', id).maybeSingle());
    },

    /** The sessions `owner` opened that are still open. */
    async openSessionsOf(owner: string): Promise<SessionRow[]> {
      return settle<SessionRow[]>('read the sessions', await db.from('ask_sessions').select(SESSION).eq('owner', owner).eq('status', 'open')) ?? [];
    },

    /** The heads of every round of these sessions. */
    async roundHeads(sessionIds: string[]): Promise<RoundHead[]> {
      return settle<RoundHead[]>('read the rounds', await db.from('ask_rounds').select(ROUND_HEAD).in('session_id', sessionIds)) ?? [];
    },

    /** The questions of these rounds. */
    async roundQuestions(ids: string[]): Promise<Array<Pick<RoundRow, 'id' | 'questions'>>> {
      return settle<Array<Pick<RoundRow, 'id' | 'questions'>>>('read the rounds', await db.from('ask_rounds').select('id, questions').in('id', ids)) ?? [];
    },

    /** Whom a round is shared with. */
    async sharedWith(roundId: string): Promise<string[]> {
      const shares = settle<Array<{ shared_with: string }>>('read the shares', await db.from('ask_shares').select('shared_with').eq('round_id', roundId)) ?? [];
      return shares.map((s) => s.shared_with);
    },

    /** The latest heartbeat of a Claude session (PRD 757), or null. */
    async ping(claudeSessionId: string): Promise<WorkingPing | null> {
      return workingReader(db).forSession(claudeSessionId);
    },
  };
}

export type AskReadRepository = ReturnType<typeof askReadRepository>;
