/**
 * **The repository's identifiers, branded** (PRD 1049, s1): one zod brand per kind of ID the code
 * passes around, its schema for use inside other schemas, and a `parse…` function for a plain value.
 * A brand is made only by parsing, never by a cast, so a pull request number cannot pass for a PRD
 * number: the compiler names both kinds. A branded value is the same number or string at run time.
 *
 * A PRD number is its issue's number, so `PrdNumber` carries both brands and fits where an
 * `IssueNumber` is expected; nothing else fits anywhere but its own kind. Pure, depending on zod
 * only: the kit, the App, the arcade and the packages all import it, as they import `narrow.ts`.
 */
import { z } from 'zod';
import { parseOrThrow } from './schema/parse-or-throw.ts';

/** An issue's number: a positive integer. */
export const IssueNumberSchema = z.number().int().positive().brand<'IssueNumber'>();
export type IssueNumber = z.infer<typeof IssueNumberSchema>;

/** A PRD's number, which is its issue's number: it fits where an `IssueNumber` is expected. */
export const PrdNumberSchema = IssueNumberSchema.brand<'PrdNumber'>();
export type PrdNumber = z.infer<typeof PrdNumberSchema>;

/** The largest number a product PRD takes: the database's integer. */
const PRODUCT_SEQ_MAX = 2 ** 31 - 1;

/** A product PRD's id (PRD 1548): its product's key, lowercase kebab-case of at most 40 characters,
 * each part starting with a letter, then `-` and its number on that product, `mobile-12`. A key never
 * ends in `-<digits>`, so the id reads one way, and never looks like a GitHub number. */
const PRODUCT_PRD = /^([a-z][a-z0-9]*(?:-[a-z][a-z0-9]*)*)-([1-9]\d{0,9})$/;

export const ProductPrdIdSchema = z
  .string()
  .regex(PRODUCT_PRD)
  .refine((id) => {
    // The key is everything before the last hyphen, the number everything after it.
    const cut = id.lastIndexOf('-');
    return cut <= 40 && Number(id.slice(cut + 1)) <= PRODUCT_SEQ_MAX;
  })
  .brand<'ProductPrdId'>();
export type ProductPrdId = z.infer<typeof ProductPrdIdSchema>;

/** A product roadmap's id (PRD 2011): its product's key, then `-R` and its number on that product,
 * `mobile-R3`. The capital R tells it from a product PRD's id (`mobile-12`): a key is lowercase. */
const PRODUCT_ROADMAP = /^([a-z][a-z0-9]*(?:-[a-z][a-z0-9]*)*)-R([1-9]\d{0,9})$/;

export const ProductRoadmapIdSchema = z
  .string()
  .regex(PRODUCT_ROADMAP)
  .refine((id) => {
    const cut = id.lastIndexOf('-R');
    return cut <= 40 && Number(id.slice(cut + 2)) <= PRODUCT_SEQ_MAX;
  })
  .brand<'ProductRoadmapId'>();
export type ProductRoadmapId = z.infer<typeof ProductRoadmapIdSchema>;

/** A pull request's number. GitHub counts it with issues, but it is a kind of its own here. */
export const PrNumberSchema = z.number().int().positive().brand<'PrNumber'>();
export type PrNumber = z.infer<typeof PrNumberSchema>;

/** A GitHub comment's id. */
export const CommentIdSchema = z.number().int().positive().brand<'CommentId'>();
export type CommentId = z.infer<typeof CommentIdSchema>;

/**
 * The slice a piece of work ran as, which an outbox item or a slice's account is raised on: a
 * plan's slice (`s1`), or one the loop names itself — a rework, `branches.rework` filled with the
 * item it closes (`fix-s1-01-…`), or the settling of a ledger (`settle`). Lower-case words joined
 * by hyphens.
 */
export const WorkSliceIdSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).brand<'WorkSliceId'>();
export type WorkSliceId = z.infer<typeof WorkSliceIdSchema>;

/** A slice of a plan: `s1`, `s12`. It fits where a `WorkSliceId` is expected. */
export const SliceIdSchema = z.string().regex(/^s\d+$/).brand<'WorkSliceId'>().brand<'SliceId'>();
export type SliceId = z.infer<typeof SliceIdSchema>;

/**
 * An outbox item: its slice, a two-digit count and a slug, `s1-01-untracked-files-not-linted`. An
 * item a rework raised carries the rework's name before it (`fix-s1-01-zod-01-crew`), as its slice
 * does.
 */
export const OutboxItemIdSchema = z
  .string()
  .regex(/^(?:[a-z0-9]+(?:-[a-z0-9]+)*-)?s\d+-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .brand<'OutboxItemId'>();
export type OutboxItemId = z.infer<typeof OutboxItemIdSchema>;

const DIGITS = /^\d+$/;

/** A digit string as its number, the way `positiveInt` (`kit/bin/args.ts`) reads one; anything else as it came. */
function numeric(value: number | string): unknown {
  return typeof value === 'string' && DIGITS.test(value) ? Number(value) : value;
}

/** `value` parsed by `schema`, or an error naming what it should have been and the value itself. */
function parseId<S extends z.ZodType>(schema: S, value: unknown, what: string, given: number | string): z.infer<S> {
  return parseOrThrow(schema, value, `${what} ${JSON.stringify(given)}`);
}

/** An issue number, from a number or its digit string. */
export function parseIssue(value: number | string): IssueNumber {
  return parseId(IssueNumberSchema, numeric(value), 'issue number', value);
}

/** A PRD number, from a number or its digit string. */
export function parsePrd(value: number | string): PrdNumber {
  return parseId(PrdNumberSchema, numeric(value), 'PRD number', value);
}

/** A product PRD's id: `mobile-12`. */
export function parseProductPrdId(value: string): ProductPrdId {
  return parseId(ProductPrdIdSchema, value, 'product PRD', value);
}

/** A PRD of either birth (PRD 1548): a repository's, by its issue's number (`12`), or a product's, by
 * its key and its number (`mobile-12`). Anything else is refused by name. */
export function parsePrdId(value: number | string): PrdNumber | ProductPrdId {
  const product = ProductPrdIdSchema.safeParse(value);
  if (product.success) return product.data;
  const prd = PrdNumberSchema.safeParse(numeric(value));
  if (prd.success) return prd.data;
  throw new Error(`PRD ${JSON.stringify(value)}: a PRD is its number (12) or its product's key and its number (mobile-12).`);
}

/** Whether a PRD id is a product's. */
export const isProductPrdId = (id: PrdNumber | ProductPrdId): id is ProductPrdId => typeof id === 'string';

/** A product PRD's key and its number on that product: `mobile-12` is `{ key: 'mobile', seq: 12 }`. */
export function productPrdParts(id: ProductPrdId): { key: string; seq: number } {
  const cut = id.lastIndexOf('-');
  return { key: id.slice(0, cut), seq: Number(id.slice(cut + 1)) };
}

/** A product roadmap's id: `mobile-R3`. */
export function parseProductRoadmapId(value: string): ProductRoadmapId {
  return parseId(ProductRoadmapIdSchema, value, 'product roadmap', value);
}

/** A product roadmap's key and its number on that product: `mobile-R3` is `{ key: 'mobile', seq: 3 }`. */
export function productRoadmapParts(id: ProductRoadmapId): { key: string; seq: number } {
  const cut = id.lastIndexOf('-R');
  return { key: id.slice(0, cut), seq: Number(id.slice(cut + 2)) };
}

/** The id of product roadmap `seq` of the product keyed `key`. */
export const productRoadmapId = (key: string, seq: number): ProductRoadmapId => parseProductRoadmapId(`${key}-R${seq}`);

/** A pull request number, from a number or its digit string. */
export function parsePr(value: number | string): PrNumber {
  return parseId(PrNumberSchema, numeric(value), 'pull request number', value);
}

/** A comment id, from a number or its digit string. */
export function parseCommentId(value: number | string): CommentId {
  return parseId(CommentIdSchema, numeric(value), 'comment id', value);
}

/** A slice id: `s1`. */
export function parseSliceId(value: string): SliceId {
  return parseId(SliceIdSchema, value, 'slice id', value);
}

/** The slice a piece of work ran as: `s1`, `fix-s1-01-zod`, `settle`. */
export function parseWorkSliceId(value: string): WorkSliceId {
  return parseId(WorkSliceIdSchema, value, 'slice', value);
}

/** An outbox item id: `s1-01-untracked-files-not-linted`. */
export function parseOutboxItemId(value: string): OutboxItemId {
  return parseId(OutboxItemIdSchema, value, 'outbox item id', value);
}
