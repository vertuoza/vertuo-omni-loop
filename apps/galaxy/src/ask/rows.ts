// The ask sessions and rounds (supabase/migrations/20260926090000_ask_sessions.sql): their rows, the
// rules read off them and the error their repository throws (PRD 1318, s3: the queries themselves live in
// ask.repository.ts). They are read and written as the caller: the client carries their access token, so row-level security decides. Since
// PRD 144 (20260927100000_ask_workspace.sql) every member of a session's workspace reads it and its
// rounds, and only its owner changes or deletes it; a session of another workspace reads as missing,
// exactly like one that never was. Since 20260927120000_ask_shares.sql its owner may share a round
// with another member, who may then answer it while it is open. Since PRD 620
// (20261010090000_ask_attachments.sql) an answer given on the page may carry screenshots: files in the
// private `ask-attachments` bucket, their paths in the round's `attachments`, set with the answer.
// Since PRD 752 (20261018090000_ask_round_lead.sql) a round may carry its `lead`: the text Claude
// wrote before asking, sent by the kit with the round.
import type { Category } from './classify';
import { type Outcome, StoreError } from '../data/store-error';
import type { PrdNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';

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
  prd: PrdNumber | null;
  skill: string | null;
  model: string | null;
  tokens: AskTokens | null;
  cost_usd: number | null;
  /** Who answered: set by the database, never sent. */
  answered_by: string | null;
  /** One of six, or null for unsorted (PRD 144), and who set it last: 'model', or a member's id. */
  category: Category | null;
  category_by: string | null;
  /** The text Claude wrote before asking (PRD 752, 20261018090000_ask_round_lead.sql): null when the
   * kit sent none. */
  lead: string | null;
};

/** What a round records besides its questions, as the API worked it out; `lead` is optional, so a
 * caller that has none leaves it out. */
export type AskRoundFacts = Pick<AskRound, 'prd' | 'skill' | 'model' | 'tokens' | 'cost_usd'> & Partial<Pick<AskRound, 'lead'>>;


/** Closed, or 12 hours without a call: either way nobody asks in it any more. */
export function sessionClosed(session: Pick<AskSession, 'status' | 'last_seen_at'>, now: number): boolean {
  return session.status === 'closed' || now - Date.parse(session.last_seen_at) >= IDLE_CLOSE_MS;
}

/** The database refused or failed; `code` is Postgres's (42501: row-level security, or the workspace
 * pick, said no), and `reason` the database's own words. */
export class AskStoreError extends StoreError {}

/** A database call's data, or the AskStoreError that says what failed. */
export function settle<T>(what: string, { data, error }: Outcome<T>): T | null {
  if (error) throw new AskStoreError(what, error.code, error.message);
  return data;
}

/** A round's category and who set it, as the database answers a change of it. */
export type AskCategory = Pick<AskRound, 'category' | 'category_by'>;

/** A member of a workspace, as ask_members() lists them: their arcade name there, if they picked one. */
export type AskMember = { user_id: string; email: string; name: string | null };

/** How a member is named on the page and in a refusal: their arcade name, else their email. */
export const memberLabel = (member: Pick<AskMember, 'email' | 'name'>) => member.name ?? member.email;

/** A share: a round, the member it is shared with, who shared it and when. */
export type AskShare = { round_id: string; shared_with: string; shared_by: string; created_at: string };
