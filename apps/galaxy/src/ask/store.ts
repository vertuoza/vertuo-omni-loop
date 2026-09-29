// The ask sessions and rounds (supabase/migrations/20260926090000_ask_sessions.sql), read and
// written as the caller: the client carries their access token, so row-level security decides. Since
// PRD 144 (20260927100000_ask_workspace.sql) every member of a session's workspace reads it and its
// rounds, and only its owner changes or deletes it; a session of another workspace reads as missing,
// exactly like one that never was. Since 20260927120000_ask_shares.sql its owner may share a round
// with another member, who may then answer it while it is open. Since PRD 620
// (20261008120000_ask_attachments.sql) an answer given on the page may carry screenshots: files in the
// private `ask-attachments` bucket, their paths in the round's `attachments`, set with the answer.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Category } from './classify';

/** A session with no call for this long reads as closed (the spec's 12 hours). */
export const IDLE_CLOSE_MS = 12 * 60 * 60 * 1000;

/** AskUserQuestion's `questions`, stored and handed back exactly as the tool took them. */
export type AskQuestions = unknown[];
/** AskUserQuestion's `answers`: question text → the chosen label, several joined with ", ", or the
 * text typed for Other. */
export type AskAnswers = Record<string, string>;
/** The screenshots an Other answer carries (PRD 620): question text → one to five paths in the
 * `ask-attachments` bucket, each `<round id>/<n>.<ext>`. */
export type AskAttachments = Record<string, string[]>;

/** The private bucket the page uploads screenshots to. */
export const ATTACHMENTS_BUCKET = 'ask-attachments';
/** How long a screenshot's signed link lives: the terminal downloads it at once. */
export const SIGNED_LINK_SECONDS = 10 * 60;

export type AskSession = {
  id: string;
  owner: string;
  title: string;
  status: 'open' | 'closed';
  created_at: string;
  last_seen_at: string;
  /** The workspace whose members read it (PRD 144), set by the database when it opens. */
  workspace_id: string | null;
  /** Where the session came from (PRD 144): null when the kit did not say. */
  repo: string | null;
  branch: string | null;
  claude_session_id: string | null;
};

/** A Claude session's tokens up to a question. */
export type AskTokens = { input: number; output: number; cacheRead: number; cacheWrite: number };

export type AskRoundStatus = 'open' | 'answered' | 'abandoned';

export type AskRound = {
  id: string;
  session_id: string;
  questions: AskQuestions;
  answers: AskAnswers | null;
  /** Screenshots recorded with the answer (PRD 620); null for none. */
  attachments: AskAttachments | null;
  answered_via: 'page' | 'terminal' | null;
  status: AskRoundStatus;
  created_at: string;
  answered_at: string | null;
  /** Where the round came from and what the session had cost by then (PRD 144): null when unknown. */
  prd: number | null;
  skill: string | null;
  model: string | null;
  tokens: AskTokens | null;
  cost_usd: number | null;
  /** Who answered: set by the database, never sent. */
  answered_by: string | null;
  /** One of six, or null for unsorted (PRD 144), and who set it last: 'model', or a member's id. */
  category: Category | null;
  category_by: string | null;
};

/** What a round records besides its questions, as the API worked it out. */
export type AskRoundFacts = Pick<AskRound, 'prd' | 'skill' | 'model' | 'tokens' | 'cost_usd'>;

const SESSION = 'id, owner, title, status, created_at, last_seen_at, workspace_id, repo, branch, claude_session_id';
const ROUND = 'id, session_id, questions, answers, answered_via, status, created_at, answered_at, attachments, prd, skill, model, tokens, cost_usd, answered_by, category, category_by';

/** Closed, or 12 hours without a call: either way nobody asks in it any more. */
export function sessionClosed(session: Pick<AskSession, 'status' | 'last_seen_at'>, now: number): boolean {
  return session.status === 'closed' || now - Date.parse(session.last_seen_at) >= IDLE_CLOSE_MS;
}

/** The database refused or failed; `code` is Postgres's (42501: row-level security, or the workspace
 * pick, said no), and `reason` the database's own words. */
export class AskStoreError extends Error {
  constructor(what: string, readonly code: string | undefined, readonly reason: string) {
    super(`${what}: ${reason}`);
  }
}

type Outcome<T> = { data: T | null; error: { code?: string; message: string } | null };

/** A database call's data, or the AskStoreError that says what failed. */
export function settle<T>(what: string, { data, error }: Outcome<T>): T | null {
  if (error) throw new AskStoreError(what, error.code, error.message);
  return data;
}

export function askStore(db: Pick<SupabaseClient, 'from'>) {
  return {
    async openSession(title: string, repo: string | null = null): Promise<{ id: string }> {
      const row: { title: string; repo?: string } = repo === null ? { title } : { title, repo };
      return settle('open the session', await db.from('ask_sessions').insert(row).select('id').single())!;
    },

    async session(id: string): Promise<AskSession | null> {
      return settle('read the session', await db.from('ask_sessions').select(SESSION).eq('id', id).maybeSingle());
    },

    /** Every call keeps an open session alive; a closed one is left as it is. */
    async touchSession(id: string, at: Date): Promise<void> {
      settle('keep the session', await db.from('ask_sessions').update({ last_seen_at: at.toISOString() }).eq('id', id).eq('status', 'open'));
    },

    /** The branch and the Claude session the latest round named; a value not named is left as it is. */
    async placeSession(id: string, where: Partial<Pick<AskSession, 'branch' | 'claude_session_id'>>): Promise<void> {
      if (Object.keys(where).length === 0) return;
      settle('place the session', await db.from('ask_sessions').update(where).eq('id', id).eq('status', 'open'));
    },

    async closeSession(id: string, at: Date): Promise<void> {
      settle('close the session', await db.from('ask_sessions').update({ status: 'closed', last_seen_at: at.toISOString() }).eq('id', id));
    },

    /** Deletes a session and its rounds, for good; false when nothing went (not the owner's). */
    async deleteSession(id: string): Promise<boolean> {
      const gone = settle<Array<{ id: string }>>('delete the session', await db.from('ask_sessions').delete().eq('id', id).select('id'));
      return (gone ?? []).length > 0;
    },

    /** The ids of a session's rounds, as the caller reads them. */
    async roundIds(sessionId: string): Promise<string[]> {
      const rows = settle<Array<{ id: string }>>('read the rounds', await db.from('ask_rounds').select('id').eq('session_id', sessionId));
      return (rows ?? []).map((row) => row.id);
    },

    /** A new round; `facts` that are all null are not sent, so an older database takes it too. */
    async addRound(sessionId: string, questions: AskQuestions, facts?: AskRoundFacts): Promise<{ id: string }> {
      const known = Object.fromEntries(Object.entries(facts ?? {}).filter(([, value]) => value !== null));
      return settle('ask the round', await db.from('ask_rounds').insert({ session_id: sessionId, questions, ...known }).select('id').single())!;
    },

    async round(id: string): Promise<AskRound | null> {
      return settle('read the round', await db.from('ask_rounds').select(ROUND).eq('id', id).maybeSingle());
    },

    /** Moves a round on only from one of `from`, in one statement, so two writers never both win;
     * null when it was no longer there to move. An answer's screenshots, when it has any, go in the
     * same update: the database takes them only with the answer. */
    async moveRound(
      id: string,
      from: AskRoundStatus[],
      to: { status: 'abandoned' } | { status: 'answered'; answers: AskAnswers; answered_via: 'page' | 'terminal'; attachments?: AskAttachments },
    ): Promise<AskRound | null> {
      return settle('move the round', await db.from('ask_rounds').update(to).eq('id', id).in('status', from).select(ROUND).maybeSingle());
    },
  };
}

export type AskStore = ReturnType<typeof askStore>;

/** The screenshots' files (PRD 620), reached as the caller: the bucket's rules decide. */
export function askAttachments(db: Pick<SupabaseClient, 'storage'>) {
  return {
    /** A signed link per path, valid SIGNED_LINK_SECONDS, in order; null for one that could not be
     * made, and every one null when the call failed. */
    async links(paths: string[]): Promise<Array<string | null>> {
      if (paths.length === 0) return [];
      try {
        const { data, error } = await db.storage.from(ATTACHMENTS_BUCKET).createSignedUrls(paths, SIGNED_LINK_SECONDS);
        if (error || !data) return paths.map(() => null);
        return paths.map((path, i) => {
          const signed = data.find((d) => d.path === path) ?? data[i];
          return signed && !signed.error && signed.signedUrl ? signed.signedUrl : null;
        });
      } catch {
        return paths.map(() => null);
      }
    },

    /** Removes every screenshot under the rounds' folders (`<round id>/…`), before their rows go:
     * deleting the rows alone would leave the files behind. Throws when a folder cannot be listed or
     * its files cannot be removed, so the rows are kept and a retry finds them. */
    async removeRounds(roundIds: string[]): Promise<void> {
      const bucket = db.storage.from(ATTACHMENTS_BUCKET);
      const folders = await Promise.all(roundIds.map(async (roundId) => {
        const { data, error } = await bucket.list(roundId, { limit: 100 });
        if (error) throw new AskStoreError('list the screenshots', undefined, error.message);
        return (data ?? []).map((file) => `${roundId}/${file.name}`);
      }));
      const paths = folders.flat();
      if (paths.length === 0) return;
      const { error } = await bucket.remove(paths);
      if (error) throw new AskStoreError('remove the screenshots', undefined, error.message);
    },
  };
}

export type AskAttachmentFiles = ReturnType<typeof askAttachments>;

/** A round's category and who set it, as the database answers a change of it. */
export type AskCategory = Pick<AskRound, 'category' | 'category_by'>;

/** A round's category (20260927110000_ask_category.sql). No grant reaches the columns: two functions
 * write them, each checking who calls. */
export function askCategories(db: Pick<SupabaseClient, 'rpc'>) {
  return {
    /** A member sets a round's category, or clears it with null; null when they may not read the round. */
    async set(roundId: string, category: Category | null): Promise<AskCategory | null> {
      return settle<AskCategory>('sort the round', await db.rpc('ask_round_categorize', { round_id: roundId, new_category: category }).maybeSingle());
    },

    /** The model's guess, as the account that asked; false when a person had already sorted it. */
    async classified(roundId: string, category: Category): Promise<boolean> {
      return settle<boolean>('record the model\'s category', await db.rpc('ask_round_classified', { round_id: roundId, new_category: category })) === true;
    },
  };
}

export type AskCategories = ReturnType<typeof askCategories>;

/** A member of a workspace, as ask_members() lists them: their arcade name there, if they picked one. */
export type AskMember = { user_id: string; email: string; name: string | null };

/** How a member is named on the page and in a refusal: their arcade name, else their email. */
export const memberLabel = (member: Pick<AskMember, 'email' | 'name'>) => member.name ?? member.email;

/** A share: a round, the member it is shared with, who shared it and when. */
export type AskShare = { round_id: string; shared_with: string; shared_by: string; created_at: string };

const SHARE = 'round_id, shared_with, shared_by, created_at';

/** Sharing a round (20260927120000_ask_shares.sql). No grant writes a share: ask_round_share() does,
 * checking that the caller owns the round's session and the member belongs to its workspace. */
export function askShares(db: Pick<SupabaseClient, 'from' | 'rpc'>) {
  return {
    /** Shares a round with a member; false when the caller does not own its session, or the member
     * is the caller or not in the session's workspace. Sharing twice is fine. */
    async share(roundId: string, member: string): Promise<boolean> {
      return settle<boolean>('share the round', await db.rpc('ask_round_share', { p_round_id: roundId, p_member: member })) === true;
    },

    /** The members of a workspace the caller belongs to; none for any other. */
    async members(workspaceId: string): Promise<AskMember[]> {
      return settle<AskMember[]>('list the members', await db.rpc('ask_members', { workspace: workspaceId })) ?? [];
    },

    /** Who a round is shared with. */
    async ofRound(roundId: string): Promise<AskShare[]> {
      return settle<AskShare[]>('read the shares', await db.from('ask_shares').select(SHARE).eq('round_id', roundId)) ?? [];
    },

    /** Every round shared with `me`. */
    async withMe(me: string): Promise<AskShare[]> {
      return settle<AskShare[]>('read the shares', await db.from('ask_shares').select(SHARE).eq('shared_with', me)) ?? [];
    },
  };
}

export type AskShares = ReturnType<typeof askShares>;
