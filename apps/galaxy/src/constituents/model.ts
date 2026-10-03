// A product's constituents (PRD 871): its Statement (what the product is) and its Never list (what it
// must never become or do), and the history of every change. The rows are
// supabase/migrations/20261029090000_constituents.sql's `constituents` and `constituent_events`; the
// read agents and the App get is constituents_of_product()'s shape, checked here by a schema before it
// leaves (GET /api/constituents) or is used.
import { z } from 'zod';

export type ConstituentKind = 'statement' | 'never';

export type EventAction = 'added' | 'edited' | 'removed' | 'moved';

/** The longest Statement and Never line the database takes, on one line. */
export const STATEMENT_MAX = 400;
export const NEVER_MAX = 200;

/** A Never line's display id: `never#<seq>`, kept for life. */
const NEVER_ID = /^never#[1-9]\d*$/;

// ── The read: GET /api/constituents, constituents_for_repo() and constituents_for_repo_app() ──

const statementSchema = z.object({ id: z.literal('statement'), text: z.string().min(1) }).strict();
const neverLineSchema = z.object({ id: z.string().regex(NEVER_ID), text: z.string().min(1) }).strict();

/** What a repository's agents read: its product's live Statement and Never lines, in order, and the
 * product's newest event id (a bigint as text), which keys anything cached from them. `ok` exactly when
 * there is a Statement or a Never line. */
export const constituentsReadSchema = z.object({
  state: z.enum(['ok', 'none']),
  product: z.object({ name: z.string().min(1) }).strict().nullable(),
  statement: statementSchema.nullable(),
  never: z.array(neverLineSchema),
  latestEventId: z.string().regex(/^\d+$/).nullable(),
}).strict().refine(
  (read) => (read.state === 'ok') === (read.statement !== null || read.never.length > 0),
  'state is ok exactly when there is a Statement or a Never line',
);

export type ConstituentsRead = z.infer<typeof constituentsReadSchema>;

// ── The rows: what the panel reads as the signed-in person ──

export const CONSTITUENT_COLUMNS = 'id, product_id, kind, seq, body, created_by, created_at, updated_at, removed_at, removed_by';

const CONSTITUENT_KINDS = ['statement', 'never'] as const satisfies readonly ConstituentKind[];
const EVENT_ACTIONS = ['added', 'edited', 'removed', 'moved'] as const satisfies readonly EventAction[];

/** A constituent's row as CONSTITUENT_COLUMNS reads it. */
export const StoredConstituent = z.strictObject({
  id: z.string(),
  product_id: z.string(),
  kind: z.enum(CONSTITUENT_KINDS),
  seq: z.number().nullable(),
  body: z.string(),
  created_by: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  removed_at: z.string().nullable(),
  removed_by: z.string().nullable(),
});
export type StoredConstituent = z.infer<typeof StoredConstituent>;

/** The whole row the constituent functions answer (`returns public.constituents`): its workspace too. */
export const SavedConstituentRow = StoredConstituent.extend({ workspace_id: z.string() });

export type Constituent = {
  id: string;
  product: string;
  kind: ConstituentKind;
  /** `statement`, or `never#<seq>`. */
  displayId: string;
  text: string;
  removed: boolean;
  updatedAt: string;
};

export const EVENT_COLUMNS = 'id, product_id, constituent_id, action, before, after, note, claim_id, changed_by, changed_at';

/** An event's row as EVENT_COLUMNS reads it. Its id is a bigint, which PostgREST may send as text:
 * eventOf() reads it as a number on purpose. */
export const StoredConstituentEvent = z.strictObject({
  id: z.union([z.number(), z.string()]),
  product_id: z.string(),
  constituent_id: z.string(),
  action: z.enum(EVENT_ACTIONS),
  before: z.string().nullable(),
  after: z.string().nullable(),
  note: z.string().nullable(),
  claim_id: z.string().nullable(),
  changed_by: z.string().nullable(),
  changed_at: z.string(),
});
export type StoredConstituentEvent = z.infer<typeof StoredConstituentEvent>;

export type ConstituentEvent = {
  /** The event's number: a later change has a larger one. */
  id: number;
  product: string;
  constituent: string;
  action: EventAction;
  before: string | null;
  after: string | null;
  /** "moved from Business never#7" for a move; null otherwise. */
  note: string | null;
  /** The account that made the change; null for the move and for an account since deleted. */
  by: string | null;
  at: string;
};

/** A constituent's display id: `statement`, or `never#<seq>`. */
export function displayIdOf(row: Pick<StoredConstituent, 'kind' | 'seq'>): string {
  return row.kind === 'statement' ? 'statement' : `never#${row.seq}`;
}

export function constituentOf(row: StoredConstituent): Constituent {
  return {
    id: row.id,
    product: row.product_id,
    kind: row.kind,
    displayId: displayIdOf(row),
    text: row.body,
    removed: row.removed_at !== null,
    updatedAt: row.updated_at,
  };
}

export function eventOf(row: StoredConstituentEvent): ConstituentEvent {
  return {
    id: Number(row.id),
    product: row.product_id,
    constituent: row.constituent_id,
    action: row.action,
    before: row.before,
    after: row.after,
    note: row.note,
    by: row.changed_by,
    at: row.changed_at,
  };
}

/** A product's live constituents as the panel shows them: its Statement, or null, and its Never lines
 * in their order. Removed ones are left out; they stay in the history. */
export function liveOf(constituents: readonly Constituent[], product: string): { statement: Constituent | null; never: Constituent[] } {
  const live = constituents.filter((c) => c.product === product && !c.removed);
  return {
    statement: live.find((c) => c.kind === 'statement') ?? null,
    never: live.filter((c) => c.kind === 'never').sort((a, b) => seqOf(a) - seqOf(b)),
  };
}

/** A product's history, newest first. */
export function historyOf(events: readonly ConstituentEvent[], product: string): ConstituentEvent[] {
  return events.filter((e) => e.product === product).sort((a, b) => b.id - a.id);
}

const seqOf = (c: Pick<Constituent, 'displayId'>) => Number(c.displayId.split('#')[1] ?? 0);
