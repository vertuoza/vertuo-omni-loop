// What `omni constituents` reads from outside the process, as schemas (PRD 871): the Omni page's
// reply to `GET /api/constituents?repo=` and the copy kept at `.omni-loop/local/constituents.json`.
// Both are read leniently: a value either refuses is no reply, or no copy, never an error. A reply is
// read into the contract's fields only, in the contract's order, every other field dropped.
import { z } from 'zod';

const NEVER_ID = /^never#[1-9]\d*$/;
const EVENT_ID = /^\d+$/;

/** A string with at least one character. */
const text = z.string().min(1);

/** The reply's body: `state` is `ok` exactly when there is a Statement or a Never line. */
export const ConstituentsSchema = z
  .object({
    state: z.enum(['ok', 'none']),
    product: z.object({ name: text }).nullable(),
    statement: z.object({ id: z.literal('statement'), text }).nullable(),
    never: z.array(z.object({ id: z.string().regex(NEVER_ID), text })),
    latestEventId: z.string().regex(EVENT_ID).nullish().transform((id) => id ?? null),
  })
  .refine((read) => (read.state === 'ok') === (read.statement !== null || read.never.length > 0));
export type Constituents = z.infer<typeof ConstituentsSchema>;

/** The kept copy: the repository it was synced for, when, and the reply (read again through `ConstituentsSchema`). */
export const ConstituentsCacheSchema = z.looseObject({
  repo: z.string(),
  syncedAt: z.string().refine((at) => !Number.isNaN(Date.parse(at))),
  read: z.unknown(),
});
