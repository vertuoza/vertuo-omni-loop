// What agents read of a workspace's business (PRD 748, decision 14): the shape `GET /api/business`
// answers and `omni business show --json` prints, which the later MCP link returns unchanged. The
// database builds it (business_for_repo(), supabase/migrations/20261019090000_business_store.sql),
// run as the caller; this module only calls it and checks what came back. PRD 774 (decision 12) added
// `state` to each claim: `confirmed`, or `contradicted` while evidence disputes it and nobody answered;
// `receipt` is then the newest receipt as `<where> — "<quote>"`. PRD 799 added `personas`: the
// repository's product's personas, oldest first, `[]` when there are none; they never decide `state`,
// which comes from claims only. A database from before PRD 799 sends none: they read as `[]`. PRD 822
// stores a claim a person answered, through claim_answer(). PRD 839 adds a product's Never lines: claims
// of kind `never`, read like any other, and never an answer's kind.
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

/** The kinds a person answers (PRD 822). */
const ANSWERABLE_KINDS = ['region', 'offering', 'size', 'trade', 'rival'] as const;
/** The kinds a read carries: those, and a product's Never lines (PRD 839). */
const CLAIM_KINDS = [...ANSWERABLE_KINDS, 'never'] as const;
const CLAIM_SOURCES = ['pick', 'suggestion', 'evidence', 'answer'] as const;
/** The states a claim leaves the app in: proposed and rejected claims never do. */
const READ_STATES = ['confirmed', 'contradicted'] as const;

const named = z.object({ name: z.string().min(1) }).strict();

/** One confirmed or contradicted claim, under its display id `<kind>#<seq>`. */
const businessClaimSchema = z.object({
  id: z.string().regex(/^(region|offering|size|trade|rival|never)#[1-9]\d*$/),
  kind: z.enum(CLAIM_KINDS),
  value: z.string().min(1),
  source: z.enum(CLAIM_SOURCES),
  state: z.enum(READ_STATES),
  receipt: z.string().nullable(),
  lastSeen: z.string().nullable(),
}).strict();

/** One persona of the repository's product (PRD 799): who the customer is, as the team pictures them. */
const businessPersonaSchema = z.object({
  name: z.string().min(1),
  stance: z.enum(['excited', 'neutral', 'skeptical']),
  trade: z.string().min(1),
  who: z.string(),
  usage: z.string(),
}).strict();

/** The body of a read. `ok` only with at least one claim; `none` with none (no business, or no
 * confirmed claim for the repository). */
const businessReadSchema = z.object({
  state: z.enum(['ok', 'none']),
  business: named.nullable(),
  product: named.nullable(),
  claims: z.array(businessClaimSchema),
  personas: z.array(businessPersonaSchema).default([]),
}).strict().refine((read) => (read.state === 'ok') === (read.claims.length > 0), 'state is ok exactly when there are claims');

type BusinessRead = z.infer<typeof businessReadSchema>;

/** The states a person's answer is stored in (PRD 822): an overrule's, or a gap question's. */
export const ANSWER_STATES = ['proposed', 'confirmed'] as const;
export type AnswerState = (typeof ANSWER_STATES)[number];
export const ANSWER_KINDS = ANSWERABLE_KINDS;
export type AnswerKind = (typeof ANSWERABLE_KINDS)[number];

/** What claim_answer() answers: the claim's display id and state, and whether it was added (a value
 * the business already held keeps its own state). */
const storedClaimSchema = z.object({
  id: z.string().regex(/^(region|offering|size|trade|rival)#[1-9]\d*$/),
  state: z.enum(['proposed', 'confirmed', 'rejected', 'contradicted', 'unknown']),
  added: z.boolean(),
}).strict();

type StoredClaim = z.infer<typeof storedClaimSchema>;

/** The database refused or failed; `code` is Postgres's: 42501 the caller may not read that
 * repository's business (its reason as the database wrote it), 22023 a malformed repository or claim
 * id, P0002 a claim id the business does not hold. */
export class BusinessStoreError extends Error {
  constructor(readonly code: string | undefined, readonly reason: string) {
    super(`read the business: ${reason}`);
  }
}

export function businessReader(db: Pick<SupabaseClient, 'rpc'>) {
  return {
    /** The confirmed and contradicted claims, and the personas, agents in `repo` (owner/name) read. */
    async forRepo(repo: string): Promise<BusinessRead> {
      const { data, error } = await db.rpc('business_for_repo', { p_repo: repo });
      if (error) throw new BusinessStoreError(error.code, error.message);
      const read = businessReadSchema.safeParse(data);
      if (!read.success) throw new BusinessStoreError(undefined, `an unexpected answer: ${read.error.issues[0]?.message ?? 'malformed'}`);
      return read.data;
    },
    /** Appends one citation per claim id (`rival#4`) to the business's log, as `by` (the skill) in the
     * run `ref`; all or none. The number appended. */
    async cite(repo: string, ids: string[], by: string, ref: string | null): Promise<number> {
      const { data, error } = await db.rpc('claims_cite', { p_repo: repo, p_ids: ids, p_by: by, p_ref: ref });
      if (error) throw new BusinessStoreError(error.code, error.message);
      if (typeof data !== 'number') throw new BusinessStoreError(undefined, 'an unexpected answer: not a count');
      return data;
    },
    /** Stores a claim a person answered (PRD 822): source `answer`, `state` proposed or confirmed, the
     * receipt `ref` (the skill and the run), for the business agents in `repo` read. */
    async answer(repo: string, kind: AnswerKind, value: string, state: AnswerState, ref: string): Promise<StoredClaim> {
      const { data, error } = await db.rpc('claim_answer', { p_repo: repo, p_kind: kind, p_value: value, p_state: state, p_ref: ref });
      if (error) throw new BusinessStoreError(error.code, error.message);
      const stored = storedClaimSchema.safeParse(data);
      if (!stored.success) throw new BusinessStoreError(undefined, `an unexpected answer: ${stored.error.issues[0]?.message ?? 'malformed'}`);
      return stored.data;
    },
  };
}
