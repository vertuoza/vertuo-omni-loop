// The front matter of the kit's three registers (PRD 725, s3): an inbox spec
// (`kit/lib/inbox/inbox.ts`), an outbox item (`kit/lib/outbox/outbox.ts`) and a slice's account
// (`kit/lib/outbox/account.ts`). Each is read by `parseFrontMatterLines` into plain strings first,
// so every number here is coerced, and each schema is strict: a field it does not name is refused by
// name. What each parser builds from it is a type in `kit/lib/types.ts`.
import { z } from 'zod';
import { OutboxItemIdSchema, PrdNumberSchema, ProductPrdIdSchema, WorkSliceIdSchema } from '../ids.ts';
import type { PrdNumber, ProductPrdId } from '../ids.ts';

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

/** An outbox item's `prd` value (PRD 1548): a repository's PRD by its number, or a product's by its
 * id (`mobile-12`), whose items live on the server. */
const ItemPrdField = z.string().transform((raw, refinement): PrdNumber | ProductPrdId => {
  const product = ProductPrdIdSchema.safeParse(raw);
  if (product.success) return product.data;
  const prd = PrdField.safeParse(raw);
  if (prd.success) return prd.data;
  refinement.addIssue({ code: 'custom', message: 'prd must be a number, or a product PRD like mobile-12' });
  return z.NEVER;
});

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

/**
 * Why `path` is no path an outbox item may excuse (PRD 2898), or null when it is one: an item excuses
 * exact paths from the repository root, never a folder (a trailing `/`) and never a pattern, so a
 * finding is excused only for a file a person was asked about by name. Whether a path names a folder
 * on disk is `omni item new`'s own check: this one reads the text alone.
 */
export function excusePathProblem(path: string): string | null {
  if (path === '') return 'an empty path';
  if (/[*?[\]{}!]/.test(path)) return `${path} is a pattern: an item excuses exact paths only`;
  if (/[\s,]/.test(path)) return `${path} holds a space or a comma: one path per --excuses`;
  if (path.endsWith('/')) return `${path} is a folder: an item excuses exact paths only`;
  if (path.startsWith('/') || path.includes('\\') || path.split('/').some((part) => part === '..' || part === '.' || part === '')) {
    return `${path} is not a path from the repository root`;
  }
  return null;
}

/**
 * `excuses`'s raw string (PRD 2898) into the exact paths an item excuses: a bracketed list of at
 * least one, each a path {@link excusePathProblem} passes, none twice.
 */
const ExcusesSchema = z
  .string()
  .trim()
  .transform((raw, ctx): string[] => {
    const match = raw.match(BRACKET_LIST);
    const paths = match ? (match[1] ?? '').split(',').map((token) => token.trim()).filter(Boolean) : [];
    if (!match || paths.length === 0) {
      ctx.addIssue({ code: 'custom', message: 'excuses must be a bracketed list of exact paths, e.g. [kit/lib/init/labels.ts]' });
      return z.NEVER;
    }
    const problems = paths.flatMap((path, index) => {
      const problem = excusePathProblem(path);
      if (problem !== null) return [problem];
      return paths.indexOf(path) === index ? [] : [`${path} is listed twice`];
    });
    if (problems.length > 0) {
      ctx.addIssue({ code: 'custom', message: `excuses: ${problems.join('; ')}` });
      return z.NEVER;
    }
    return paths;
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
    prd: ItemPrdField,
    slice: SliceField,
    rank: z.enum(RANK_VALUES, {
      message: `rank must be one of: ${RANK_VALUES.join(', ')}`,
    }),
    'bears-on': z.string().trim().min(1, 'bears-on is required'),
    raised: z.string().regex(DATE, 'raised must be a YYYY-MM-DD date'),
    wave: z.coerce.number({ message: 'wave must be a number' }).int().positive(),
    // PRD 2898: the exact paths whose finding of the ready checks 4 and 5 this item excuses, once a
    // person agreed (or, for check 5, once it was adopted). Left out, the item excuses nothing.
    excuses: ExcusesSchema,
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
