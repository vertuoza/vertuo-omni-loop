// What agents read of a workspace's business (PRD 748, decision 14): the shape `GET /api/business`
// answers and `omni business show --json` prints, which the later MCP link returns unchanged. The
// database builds it (business_for_repo(), supabase/migrations/20261019090000_business_store.sql),
// run as the caller; this module only calls it and checks what came back.
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

const CLAIM_KINDS = ['region', 'offering', 'size', 'trade', 'rival'] as const;
const CLAIM_SOURCES = ['pick', 'suggestion', 'evidence', 'answer'] as const;

const named = z.object({ name: z.string().min(1) }).strict();

/** One confirmed claim, under its display id `<kind>#<seq>`. */
const businessClaimSchema = z.object({
  id: z.string().regex(/^(region|offering|size|trade|rival)#[1-9]\d*$/),
  kind: z.enum(CLAIM_KINDS),
  value: z.string().min(1),
  source: z.enum(CLAIM_SOURCES),
  receipt: z.string().nullable(),
  lastSeen: z.string().nullable(),
}).strict();

/** The body of a read. `ok` only with at least one claim; `none` with none (no business, or no
 * confirmed claim for the repository). */
const businessReadSchema = z.object({
  state: z.enum(['ok', 'none']),
  business: named.nullable(),
  product: named.nullable(),
  claims: z.array(businessClaimSchema),
}).strict().refine((read) => (read.state === 'ok') === (read.claims.length > 0), 'state is ok exactly when there are claims');

type BusinessRead = z.infer<typeof businessReadSchema>;

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
    /** The confirmed claims agents in `repo` (owner/name) read. */
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
  };
}
