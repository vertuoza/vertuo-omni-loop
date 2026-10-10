// The front matter of the kit's three registers (PRD 725, s3): an inbox spec
// (`kit/lib/inbox/inbox.ts`), an outbox item (`kit/lib/outbox/outbox.ts`) and a slice's account
// (`kit/lib/outbox/account.ts`). Each is read by `parseFrontMatterLines` into plain strings first,
// so every number here is coerced, and each schema is strict: a field it does not name is refused by
// name. What each parser builds from it is a type in `kit/lib/types.ts`.
import { z } from 'zod';
import { OutboxItemIdSchema, PrdNumberSchema, WorkSliceIdSchema } from '../ids.ts';
import type { PrdNumber } from '../ids.ts';

/** The two ways a PRD's full prose is reached, in the order the plan lists them. */
export const SPEC_VALUES = ['file', 'issue'] as const;

/** The one value an optional `proof` field may take (PRD 798). */
export const PROOF_VALUES = ['video'] as const;

/** The one value an optional `e2e` field may take (PRD 1275). */
export const E2E_VALUES = ['validate'] as const;

/** The one value an optional `phase0` field may take (PRD 1299): the PRD was born on the server. */
const PHASE0_VALUES = ['server'] as const;

/** The three ranks a `rank` front-matter value may hold, in the order the plan lists them. */
export const RANK_VALUES = ['human-action', 'high', 'medium'] as const;

const BLOCKED_BY_MESSAGE = 'blocked-by must be "none" or a bracketed list of PRD numbers, e.g. [966]';
const BLOCKED_BY_LIST = /^\[\s*(\d+\s*(?:,\s*\d+\s*)*)?\]$/;
const BRACKET_LIST = /^\[([\s\S]*)\]$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A `prd` value, read from its text into a `PrdNumber`. */
const PrdField = z.coerce.number({ message: 'prd must be a number' }).int().positive().pipe(PrdNumberSchema);

/** A `slice` value: the slice the item or account was raised on (`s1`, `fix-s1-01-…`, `settle`). */
const SliceField = z.string().trim().min(1, 'slice is required').pipe(WorkSliceIdSchema);

/**
 * `blocked-by`'s raw string into `'none'` or an array of PRD numbers. Structural only — whether a
 * named PRD actually exists is a boundary check `check-inbox.ts` makes across the whole inbox tree,
 * not something one file's text can answer on its own.
 */
const BlockedBySchema = z
  .string()
  .trim()
  .min(1, 'blocked-by is required')
  .transform((raw, ctx): 'none' | PrdNumber[] => {
    if (raw === 'none') return 'none';
    const match = raw.match(BLOCKED_BY_LIST);
    if (!match) {
      ctx.addIssue({
        code: 'custom',
        message: BLOCKED_BY_MESSAGE,
      });
      return z.NEVER;
    }
    const inner = (match[1] ?? '').trim();
    const prds = inner.length === 0 ? [] : inner.split(',').map((token) => PrdNumberSchema.safeParse(Number(token.trim())));
    const read = prds.flatMap((prd) => (prd.success ? [prd.data] : []));
    if (read.length !== prds.length) {
      ctx.addIssue({ code: 'custom', message: BLOCKED_BY_MESSAGE });
      return z.NEVER;
    }
    return read;
  });

/**
 * `areas`'s raw string into an array of domain-folder names. Structural only, same reasoning as
 * `blocked-by` — whether a named area is a real folder under the knowledge root is
 * `check-inbox.ts`'s own cross-file check.
 */
const AreasSchema = z
  .string()
  .trim()
  .transform((raw, ctx): string[] => {
    const match = raw.match(BRACKET_LIST);
    if (!match) {
      ctx.addIssue({
        code: 'custom',
        message: 'areas must be a bracketed list of domain folder names, e.g. [credits]',
      });
      return z.NEVER;
    }
    const inner = (match[1] ?? '').trim();
    return inner.length === 0 ? [] : inner.split(',').map((token) => token.trim());
  })
  .optional();

/** An inbox spec's front matter: written once, never a status. */
export const SpecFrontMatterSchema = z
  .object({
    prd: PrdField,
    title: z.string().trim().min(1, 'title is required'),
    'blocked-by': BlockedBySchema,
    spec: z.enum(SPEC_VALUES, { message: `spec must be one of: ${SPEC_VALUES.join(', ')}` }),
    areas: AreasSchema,
    // PRD 798: `proof: video` asks `/omni:yolo` to follow `/omni:prove` once the feature PR is ready.
    proof: z.enum(PROOF_VALUES, { message: `proof must be ${PROOF_VALUES.join(' or ')}, or left out` }).optional(),
    // PRD 1275: `e2e: validate` asks `/omni:yolo` to follow `/omni:validate-e2e` once the feature PR is ready.
    e2e: z.enum(E2E_VALUES, { message: `e2e must be ${E2E_VALUES.join(' or ')}, or left out` }).optional(),
    // PRD 1299: `phase0: server` says the PRD is approved on its PRD page, not by a phase-0 PR.
    phase0: z.enum(PHASE0_VALUES, { message: `phase0 must be ${PHASE0_VALUES.join(' or ')}, or left out` }).optional(),
  })
  .strict();

/** An outbox item's front matter. */
export const OutboxItemFrontMatterSchema = z
  .object({
    id: z.string().trim().min(1, 'id is required').pipe(OutboxItemIdSchema),
    prd: PrdField,
    slice: SliceField,
    rank: z.enum(RANK_VALUES, {
      message: `rank must be one of: ${RANK_VALUES.join(', ')}`,
    }),
    'bears-on': z.string().trim().min(1, 'bears-on is required'),
    raised: z.string().regex(DATE, 'raised must be a YYYY-MM-DD date'),
    wave: z.coerce.number({ message: 'wave must be a number' }).int().positive(),
  })
  .strict();

/** A slice's account's front matter. */
export const AccountFrontMatterSchema = z
  .object({
    prd: PrdField,
    slice: SliceField,
    graded: z.string().regex(DATE, 'graded must be a YYYY-MM-DD date'),
  })
  .strict();
