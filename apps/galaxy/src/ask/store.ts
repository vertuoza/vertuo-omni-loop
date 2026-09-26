// The ask sessions and rounds (supabase/migrations/20260926090000_ask_sessions.sql), read and
// written as the caller: the client carries their access token, so row-level security hands each
// account its own rows only. Another owner's row reads as missing, exactly like one that never was.
import type { SupabaseClient } from '@supabase/supabase-js';

/** A session with no call for this long reads as closed (the spec's 12 hours). */
export const IDLE_CLOSE_MS = 12 * 60 * 60 * 1000;

/** AskUserQuestion's `questions`, stored and handed back exactly as the tool took them. */
export type AskQuestions = unknown[];
/** AskUserQuestion's `answers`: question text → the chosen label, several joined with ", ", or the
 * text typed for Other. */
export type AskAnswers = Record<string, string>;

export type AskSession = {
  id: string;
  owner: string;
  title: string;
  status: 'open' | 'closed';
  created_at: string;
  last_seen_at: string;
};

export type AskRoundStatus = 'open' | 'answered' | 'abandoned';

export type AskRound = {
  id: string;
  session_id: string;
  questions: AskQuestions;
  answers: AskAnswers | null;
  answered_via: 'page' | 'terminal' | null;
  status: AskRoundStatus;
  created_at: string;
  answered_at: string | null;
};

const SESSION = 'id, owner, title, status, created_at, last_seen_at';
const ROUND = 'id, session_id, questions, answers, answered_via, status, created_at, answered_at';

/** Closed, or 12 hours without a call: either way nobody asks in it any more. */
export function sessionClosed(session: Pick<AskSession, 'status' | 'last_seen_at'>, now: number): boolean {
  return session.status === 'closed' || now - Date.parse(session.last_seen_at) >= IDLE_CLOSE_MS;
}

/** The database refused or failed; `code` is Postgres's (42501: row-level security said no). */
export class AskStoreError extends Error {
  constructor(what: string, readonly code: string | undefined, message: string) {
    super(`${what}: ${message}`);
  }
}

type Outcome<T> = { data: T | null; error: { code?: string; message: string } | null };

function settle<T>(what: string, { data, error }: Outcome<T>): T | null {
  if (error) throw new AskStoreError(what, error.code, error.message);
  return data;
}

export function askStore(db: Pick<SupabaseClient, 'from'>) {
  return {
    async openSession(title: string): Promise<{ id: string }> {
      return settle('open the session', await db.from('ask_sessions').insert({ title }).select('id').single())!;
    },

    async session(id: string): Promise<AskSession | null> {
      return settle('read the session', await db.from('ask_sessions').select(SESSION).eq('id', id).maybeSingle());
    },

    /** Every call keeps an open session alive; a closed one is left as it is. */
    async touchSession(id: string, at: Date): Promise<void> {
      settle('keep the session', await db.from('ask_sessions').update({ last_seen_at: at.toISOString() }).eq('id', id).eq('status', 'open'));
    },

    async closeSession(id: string, at: Date): Promise<void> {
      settle('close the session', await db.from('ask_sessions').update({ status: 'closed', last_seen_at: at.toISOString() }).eq('id', id));
    },

    async addRound(sessionId: string, questions: AskQuestions): Promise<{ id: string }> {
      return settle('ask the round', await db.from('ask_rounds').insert({ session_id: sessionId, questions }).select('id').single())!;
    },

    async round(id: string): Promise<AskRound | null> {
      return settle('read the round', await db.from('ask_rounds').select(ROUND).eq('id', id).maybeSingle());
    },

    /** Moves a round on only from one of `from`, in one statement, so two writers never both win;
     * null when it was no longer there to move. */
    async moveRound(
      id: string,
      from: AskRoundStatus[],
      to: { status: 'abandoned' } | { status: 'answered'; answers: AskAnswers; answered_via: 'page' | 'terminal' },
    ): Promise<AskRound | null> {
      return settle('move the round', await db.from('ask_rounds').update(to).eq('id', id).in('status', from).select(ROUND).maybeSingle());
    },
  };
}

export type AskStore = ReturnType<typeof askStore>;
