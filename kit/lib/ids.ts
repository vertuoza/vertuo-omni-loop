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
