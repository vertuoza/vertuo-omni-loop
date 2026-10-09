// The ask pages' reads (PRD 1318, s2; ADR-0095): every query the tabs, a session and a shared round
// send, on the client it is given, as the signed-in person, so row-level security has the last word. A
// session or round of another workspace reads as missing, exactly like one that never was; a failed
// read throws AskStoreError. No rule lives here: which sessions make a tab and which round is newest
// is ask.service.ts's. The client is handed in, not built: the controller passes the viewer's, and the
// readers other areas still import from src/ask/page/source.ts pass theirs until their own PRD moves
// them.
import type { SupabaseClient } from '@supabase/supabase-js';
import { defined } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import type { Category } from './classify';
import {
  ATTACHMENTS_BUCKET, AskStoreError, SIGNED_LINK_SECONDS, settle,
  type AskAnswers, type AskAttachments, type AskCategory, type AskMember, type AskQuestions, type AskRound, type AskRoundFacts,
  type AskRoundStatus, type AskSession, type AskShare,
} from './rows';
import type { RoundRow, SessionRow } from './page/view';
import type { WorkingPing } from '../working/state';
import { workingReader } from '../working/store';

/** What the reads need: the tables. */
export type AskReadDb = Pick<SupabaseClient, 'from'>;

const SESSION = 'id, owner, title, status, created_at, last_seen_at, workspace_id, repo, branch, claude_session_id';
const ROUND = 'id, questions, answers, answered_via, status, created_at, answered_at, attachments, prd, skill, model, tokens, cost_usd, answered_by, category, category_by, lead';
/** A round as the API reads and moves it: with its session. */
const STORED_ROUND = 'id, session_id, questions, answers, answered_via, status, created_at, answered_at, attachments, prd, skill, model, tokens, cost_usd, answered_by, category, category_by, lead';
const ROUND_HEAD = 'id, session_id, status, created_at';

/** A round with the session it belongs to. */
export type RoundWithSession = RoundRow & { session_id: string };
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

    /** These sessions, as the caller may read them. */
    async sessionsIn(ids: string[]): Promise<SessionRow[]> {
      return settle<SessionRow[]>('read the sessions', await db.from('ask_sessions').select(SESSION).in('id', ids)) ?? [];
    },

    /** These rounds that are still open, each with its session id. */
    async openRoundsIn(ids: string[]): Promise<RoundWithSession[]> {
      return settle<RoundWithSession[]>('read the rounds', await db.from('ask_rounds').select(`${ROUND}, session_id`).in('id', ids).eq('status', 'open')) ?? [];
    },

    /** The newest `limit` rounds the caller may read, newest first, each with its session id. */
    async newestRounds(limit: number): Promise<RoundWithSession[]> {
      return settle<RoundWithSession[]>('read the history', await db.from('ask_rounds').select(`${ROUND}, session_id`).order('created_at', { ascending: false }).limit(limit)) ?? [];
    },

    /** The latest heartbeat of a Claude session (PRD 757), or null. */
    async ping(claudeSessionId: string): Promise<WorkingPing | null> {
      return workingReader(db).forSession(claudeSessionId);
    },
  };
}

export type AskReadRepository = ReturnType<typeof askReadRepository>;

// The sessions', rounds', screenshots', categories' and shares' reads and writes the ask API and the
// pages send (moved here from store.ts by PRD 1318, s3), as the caller.

export function askStore(db: Pick<SupabaseClient, 'from'>) {
  return {
    async openSession(title: string, repo: string | null = null): Promise<{ id: string }> {
      const row: { title: string; repo?: string } = repo === null ? { title } : { title, repo };
      return defined(settle('open the session', await db.from('ask_sessions').insert(row).select('id').single()), 'the new session');
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
      return defined(settle('ask the round', await db.from('ask_rounds').insert({ session_id: sessionId, questions, ...known }).select('id').single()), 'the new round');
    },

    async round(id: string): Promise<AskRound | null> {
      return settle('read the round', await db.from('ask_rounds').select(STORED_ROUND).eq('id', id).maybeSingle());
    },

    /** Moves a round on only from one of `from`, in one statement, so two writers never both win;
     * null when it was no longer there to move. An answer's screenshots, when it has any, go in the
     * same update: the database takes them only with the answer. */
    async moveRound(
      id: string,
      from: AskRoundStatus[],
      to: { status: 'abandoned' } | { status: 'answered'; answers: AskAnswers; answered_via: 'page' | 'terminal'; attachments?: AskAttachments },
    ): Promise<AskRound | null> {
      return settle('move the round', await db.from('ask_rounds').update(to).eq('id', id).in('status', from).select(STORED_ROUND).maybeSingle());
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
        // `data` is widened to null: Storage's answer is read here unparsed.
        const { data, error }: { data: Array<{ path: string | null; error: string | null; signedUrl: string | null }> | null; error: unknown } =
          await db.storage.from(ATTACHMENTS_BUCKET).createSignedUrls(paths, SIGNED_LINK_SECONDS);
        if (error || !data) return paths.map(() => null);
        return paths.map((path, i) => {
          const signed = data.find((d) => d.path === path) ?? data[i];
          return signed && !signed.error && signed.signedUrl ? signed.signedUrl : null;
        });
      } catch {
        return paths.map(() => null);
      }
    },

    /** Stores one screenshot at `path`, never over one already there: `exists` when one is, `refused`
     * when the bucket's rules say no (the caller may not answer the round). Throws when Storage fails. */
    async upload(path: string, file: Blob, contentType: string): Promise<'stored' | 'exists' | 'refused'> {
      // `error` is widened: Storage's answer is read here unparsed.
      const { error }: { error: { message: string; statusCode?: string | undefined } | null } =
        await db.storage.from(ATTACHMENTS_BUCKET).upload(path, file, { contentType, upsert: false });
      if (!error) return 'stored';
      if (error.statusCode === '409' || /already exists|duplicate/i.test(error.message)) return 'exists';
      if (error.statusCode === '403' || error.statusCode === '400' || /row-level security/i.test(error.message)) return 'refused';
      throw new AskStoreError('store the screenshot', undefined, error.message);
    },

    /** Removes these screenshots, as far as the bucket's rules let the caller. Throws when Storage fails. */
    async remove(paths: string[]): Promise<void> {
      const { error } = await db.storage.from(ATTACHMENTS_BUCKET).remove(paths);
      if (error) throw new AskStoreError('remove the screenshots', undefined, error.message);
    },

    /** The bucket itself, for the uploads a page sends as the caller (PRD 620). */
    bucket() {
      return db.storage.from(ATTACHMENTS_BUCKET);
    },

    /** Removes every screenshot under the rounds' folders (`<round id>/…`), before their rows go:
     * deleting the rows alone would leave the files behind. Throws when a folder cannot be listed or
     * its files cannot be removed, so the rows are kept and a retry finds them. */
    async removeRounds(roundIds: string[]): Promise<void> {
      const bucket = db.storage.from(ATTACHMENTS_BUCKET);
      const folders = await Promise.all(roundIds.map(async (roundId) => {
        // `data` is widened to null: Storage's answer is read here unparsed.
        const { data, error }: { data: Array<{ name: string }> | null; error: { message: string } | null } = await bucket.list(roundId, { limit: 100 });
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
