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

export type JevMode = 'off' | 'shadow' | 'on';
export type JevCallOutcome = 'answered' | 'under-floor' | 'failed' | 'no-key';

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
  constructor(what: string, readonly code: string | undefined, reason: string) {
    super(`Could not ${what}: ${reason}${code ? ` (${code})` : ''}`);
    this.name = 'JevStoreError';
  }
}

type Failure = { message?: string; code?: string } | null | undefined;
type Result = { data: unknown; error: Failure };

/** The Supabase client's calls this store makes, loosely typed so a test can record them. */
type Db = { rpc(fn: string, args: Record<string, unknown>): PromiseLike<Result>; from(table: string): any };

function settle(what: string, error: Failure): void {
  if (error) throw new JevStoreError(what, error.code, error.message ?? 'no reason given');
}

const num = (value: unknown, fallback: number): number => {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback;
};
const numOrNull = (value: unknown): number | null => (value === null || value === undefined ? null : num(value, NaN));
const str = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const MODES: readonly JevMode[] = ['off', 'shadow', 'on'];
const modeOf = (value: unknown): JevMode => (MODES.includes(value as JevMode) ? (value as JevMode) : 'off');

type StoredDecision = { decision: string; mode: unknown; threshold: unknown; confidence_floor: unknown };

const settingsOf = (row: StoredDecision): JevDecisionSettings => ({
  decision: row.decision,
  mode: modeOf(row.mode),
  threshold: num(row.threshold, DEFAULT_THRESHOLD),
  floor: num(row.confidence_floor, DEFAULT_FLOOR),
});

/** The decision's settings among `rows`, or Off at the defaults. */
export function decisionOf(rows: readonly JevDecisionSettings[], decision: string): JevDecisionSettings {
  return rows.find((r) => r.decision === decision) ?? { decision, mode: 'off', threshold: DEFAULT_THRESHOLD, floor: DEFAULT_FLOOR };
}

const DECISION_COLUMNS = 'decision, mode, threshold, confidence_floor';
const CALL_COLUMNS = 'id, decision, mode, outcome, model, jev_answer, confidence, old_answer, counted, decided_by, ref, reason, ms, called_at';

const first = (data: unknown): Record<string, unknown> | null => {
  const row = Array.isArray(data) ? data[0] : data;
  return row && typeof row === 'object' ? (row as Record<string, unknown>) : null;
};

function callOf(row: Record<string, unknown>): JevCallRow {
  return {
    id: num(row.id, 0),
    decision: String(row.decision),
    mode: modeOf(row.mode),
    outcome: row.outcome as JevCallOutcome,
    model: str(row.model),
    jevAnswer: str(row.jev_answer),
    confidence: numOrNull(row.confidence),
    oldAnswer: str(row.old_answer),
    counted: str(row.counted),
    decidedBy: row.decided_by === 'jev' ? 'jev' : 'old',
    ref: str(row.ref),
    reason: str(row.reason),
    ms: numOrNull(row.ms),
    calledAt: String(row.called_at),
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
      return ((data ?? []) as StoredDecision[]).map(settingsOf);
    },

    async setDecision(workspace: string, settings: JevDecisionSettings): Promise<JevDecisionSettings> {
      const { data, error } = await db.rpc('set_jev_decision', {
        p_workspace: workspace, p_decision: settings.decision, p_mode: settings.mode, p_threshold: settings.threshold, p_floor: settings.floor,
      });
      settle('save the Jev decision', error);
      const row = first(data);
      return row ? settingsOf(row as StoredDecision) : settings;
    },

    /** The workspace's calls since `since` (an ISO date), newest first. */
    async calls(workspace: string, since: string): Promise<JevCallRow[]> {
      const { data, error } = await db.from('jev_calls').select(CALL_COLUMNS)
        .eq('workspace_id', workspace).gte('called_at', since).order('called_at', { ascending: false });
      settle('read the Jev calls', error);
      return ((data ?? []) as Record<string, unknown>[]).map(callOf);
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
      const row = first(data);
      return row ? settingsOf(row as StoredDecision) : decisionOf([], decision);
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

export type JevServiceStore = ReturnType<typeof jevServiceStore>;
