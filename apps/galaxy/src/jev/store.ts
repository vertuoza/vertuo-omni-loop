import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { parseRow, parseRows, type Parsed } from '../data/parse-rows';
import type { Database } from '../../../../supabase/database.types.ts';
import { isRecord } from './is-record';

// The one way into Jev's three tables (supabase/migrations/20261022090000_jev_decisions.sql, PRD 812).
//
// - jevStore(db), as the signed-in person: whether they own the workspace, the key's status (stored;
//   its last four and date for the owner only), storing a key Galaxy's server sealed and removing it
//   (which sets every decision Off), the decisions' modes and tuning, and the calls since a date. The
//   database's functions decide who may do what: a refusal throws a JevStoreError with its code
//   (42501 not the owner, 22023 a bad value).
// - jevServiceStore(db), as the service role, for Galaxy's server only: the sealed key, to call Jev;
//   one decision's settings; appending a call.
//
// A decision with no row is Off at the defaults (DEFAULT_THRESHOLD, DEFAULT_FLOOR).

const MODES = ['off', 'shadow', 'on'] as const;
const OUTCOMES = ['answered', 'under-floor', 'failed', 'no-key'] as const;
export type JevMode = (typeof MODES)[number];
export type JevCallOutcome = (typeof OUTCOMES)[number];

export const DEFAULT_THRESHOLD = 0.5;
export const DEFAULT_FLOOR = 0.4;

/** What the page knows of the workspace's key: the last four and date are the owner's only. */
export interface JevKeyStatus {
  stored: boolean;
  lastFour: string | null;
  setAt: string | null;
}

/** A sealed key, as ./secret-box.ts seals it. */
export interface SealedKey {
  ciphertext: string;
  iv: string;
  lastFour: string;
}

/** One decision's mode and tuning. */
export interface JevDecisionSettings {
  decision: string;
  mode: JevMode;
  threshold: number;
  floor: number;
}

/** One call to Jev, as it is logged: Jev's answer beside today's, and which one counted. */
export interface JevCall {
  decision: string;
  mode: JevMode;
  outcome: JevCallOutcome;
  model: string | null;
  jevAnswer: string | null;
  confidence: number | null;
  oldAnswer: string | null;
  counted: string | null;
  decidedBy: 'jev' | 'old';
  /** The round, outbox item or issue the call was about. */
  ref: string | null;
  /** Why Jev did not decide, in words, or null. */
  reason: string | null;
  ms: number | null;
}

export interface JevCallRow extends JevCall {
  id: number;
  calledAt: string;
}

/** A refusal or a failure of the database, with its code (42501, 22023, P0002…) when it gave one. */
export class JevStoreError extends Error {
  readonly code: string | undefined;
  constructor(what: string, code: string | undefined, reason: string) {
    super(`Could not ${what}: ${reason}${code ? ` (${code})` : ''}`);
    this.code = code;
    this.name = 'JevStoreError';
  }
}

type Failure = { message?: string; code?: string } | null | undefined;

/** The Supabase client's calls this store makes; a test hands it a recording fake. */
type Db = Pick<SupabaseClient<Database>, 'rpc' | 'from'>;

function settle(what: string, error: Failure): void {
  if (error) throw new JevStoreError(what, error.code, error.message ?? 'no reason given');
}

const str = (value: unknown): string | null => (typeof value === 'string' ? value : null);

/**
 * A Postgres numeric: PostgREST answers it as a JSON number, and the arcade has always read one
 * written as decimal text too. Nothing else converts: null, an empty text or a word fails.
 */
const Numeric = z.union([z.number(), z.string().regex(/^-?\d+(\.\d+)?$/).transform(Number)]);

/** A jev_decisions row, as DECISION_COLUMNS selects it: the table's checks, in zod. */
export const StoredDecision = z.strictObject({
  decision: z.string(),
  mode: z.enum(MODES),
  threshold: Numeric,
  confidence_floor: Numeric,
});
/** What set_jev_decision() answers: the whole jev_decisions row it saved, of which the page reads these. */
const SavedDecision = z.object(StoredDecision.shape);

/** A jev_calls row, as CALL_COLUMNS selects it: the table's checks, in zod. */
export const StoredCall = z.strictObject({
  id: z.number().int(),
  decision: z.string(),
  mode: z.enum(MODES),
  outcome: z.enum(OUTCOMES),
  model: z.string().nullable(),
  jev_answer: z.string().nullable(),
  confidence: Numeric.nullable(),
  old_answer: z.string().nullable(),
  counted: z.string().nullable(),
  decided_by: z.enum(['jev', 'old']),
  ref: z.string().nullable(),
  reason: z.string().nullable(),
  ms: z.number().int().nullable(),
  called_at: z.string(),
});

/** A parse that failed is the store's failed read: a JevStoreError, as a refusal is. */
function parsedOr<T>(what: string, parsed: Parsed<T>): T {
  if (!parsed.ok) throw new JevStoreError(what, undefined, parsed.error);
  return parsed.value;
}

const settingsOf = (row: z.infer<typeof StoredDecision>): JevDecisionSettings => ({
  decision: row.decision,
  mode: row.mode,
  threshold: row.threshold,
  floor: row.confidence_floor,
});

/** The decision's settings among `rows`, or Off at the defaults. */
export function decisionOf(rows: readonly JevDecisionSettings[], decision: string): JevDecisionSettings {
  return rows.find((r) => r.decision === decision) ?? { decision, mode: 'off', threshold: DEFAULT_THRESHOLD, floor: DEFAULT_FLOOR };
}

export const DECISION_COLUMNS = 'decision, mode, threshold, confidence_floor';
export const CALL_COLUMNS = 'id, decision, mode, outcome, model, jev_answer, confidence, old_answer, counted, decided_by, ref, reason, ms, called_at';

const first = (data: unknown): Record<string, unknown> | null => {
  const row: unknown = Array.isArray(data) ? data[0] : data;
  return isRecord(row) ? row : null;
};

function callOf(row: z.infer<typeof StoredCall>): JevCallRow {
  return {
    id: row.id,
    decision: row.decision,
    mode: row.mode,
    outcome: row.outcome,
    model: row.model,
    jevAnswer: row.jev_answer,
    confidence: row.confidence,
    oldAnswer: row.old_answer,
    counted: row.counted,
    decidedBy: row.decided_by,
    ref: row.ref,
    reason: row.reason,
    ms: row.ms,
    calledAt: row.called_at,
  };
}

export function jevStore(db: Db) {
  return {
    async isOwner(workspace: string): Promise<boolean> {
      const { data, error } = await db.rpc('is_owner', { workspace });
      settle('read your role', error);
      return data === true;
    },

    async keyStatus(workspace: string): Promise<JevKeyStatus> {
      const { data, error } = await db.rpc('jev_key_status', { p_workspace: workspace });
      settle('read the Jev key', error);
      const row = first(data);
      return { stored: row?.stored === true, lastFour: str(row?.last_four), setAt: str(row?.set_at) };
    },

    async setKey(workspace: string, sealed: SealedKey): Promise<JevKeyStatus> {
      const { data, error } = await db.rpc('set_jev_key', {
        p_workspace: workspace, p_ciphertext: sealed.ciphertext, p_iv: sealed.iv, p_last_four: sealed.lastFour,
      });
      settle('save the Jev key', error);
      const row = first(data);
      return { stored: true, lastFour: str(row?.last_four) ?? sealed.lastFour, setAt: str(row?.set_at) };
    },

    async removeKey(workspace: string): Promise<void> {
      const { error } = await db.rpc('remove_jev_key', { p_workspace: workspace });
      settle('remove the Jev key', error);
    },

    async decisions(workspace: string): Promise<JevDecisionSettings[]> {
      const { data, error } = await db.from('jev_decisions').select(DECISION_COLUMNS).eq('workspace_id', workspace);
      settle('read the Jev decisions', error);
      return parsedOr('read the Jev decisions', parseRows(StoredDecision, data, 'jev/store: jev_decisions')).map(settingsOf);
    },

    async setDecision(workspace: string, settings: JevDecisionSettings): Promise<JevDecisionSettings> {
      const { data, error } = await db.rpc('set_jev_decision', {
        p_workspace: workspace, p_decision: settings.decision, p_mode: settings.mode, p_threshold: settings.threshold, p_floor: settings.floor,
      });
      settle('save the Jev decision', error);
      const row = first(data);
      return row ? settingsOf(parsedOr('save the Jev decision', parseRow(SavedDecision, row, 'jev/store: set_jev_decision'))) : settings;
    },

    /** The workspace's calls since `since` (an ISO date), newest first. */
    async calls(workspace: string, since: string): Promise<JevCallRow[]> {
      const { data, error } = await db.from('jev_calls').select(CALL_COLUMNS)
        .eq('workspace_id', workspace).gte('called_at', since).order('called_at', { ascending: false });
      settle('read the Jev calls', error);
      return parsedOr('read the Jev calls', parseRows(StoredCall, data, 'jev/store: jev_calls')).map(callOf);
    },
  };
}

export type JevStore = ReturnType<typeof jevStore>;

export function jevServiceStore(db: Db) {
  return {
    /** The workspace's sealed TypeSafe key, or null when it has none. */
    async sealedKey(workspace: string): Promise<{ ciphertext: string; iv: string } | null> {
      const { data, error } = await db.from('workspace_secrets').select('ciphertext, iv').eq('workspace_id', workspace).eq('name', 'jev').maybeSingle();
      settle('read the Jev key', error);
      const row = first(data);
      return row && typeof row.ciphertext === 'string' && typeof row.iv === 'string' ? { ciphertext: row.ciphertext, iv: row.iv } : null;
    },

    /** One decision's settings, Off at the defaults when it has no row. */
    async decision(workspace: string, decision: string): Promise<JevDecisionSettings> {
      const { data, error } = await db.from('jev_decisions').select(DECISION_COLUMNS).eq('workspace_id', workspace).eq('decision', decision).maybeSingle();
      settle('read the Jev decision', error);
      if (data === null) return decisionOf([], decision);
      return settingsOf(parsedOr('read the Jev decision', parseRow(StoredDecision, data, 'jev/store: jev_decisions (one)')));
    },

    async logCall(workspace: string, call: JevCall): Promise<void> {
      const { error } = await db.from('jev_calls').insert({
        workspace_id: workspace, decision: call.decision, mode: call.mode, outcome: call.outcome, model: call.model,
        jev_answer: call.jevAnswer, confidence: call.confidence, old_answer: call.oldAnswer, counted: call.counted,
        decided_by: call.decidedBy, ref: call.ref, reason: call.reason, ms: call.ms,
      });
      settle('log the Jev call', error);
    },
  };
}

