// Outside data, parsed where it comes in (PRD 1030). A Supabase row or rpc answer, and any JSON the
// arcade did not write, is parsed with a strict zod schema the module's type is derived from
// (`z.infer`), instead of being cast to that type on a comment's word.
//
//   const { data, error } = await db.from('jev_decisions').select(DECISION_COLUMNS);
//   if (error) return [];
//   return orEmpty(parseRows(StoredDecision, data, 'jev/store: jev_decisions'));
//
// A failed parse becomes the module's own failed read, the one it already answers on an error:
// `orEmpty` ([]), `orNull` (null), the `Parsed` itself where the module returns `{ ok: false }`, or
// `orThrow` where a thrown error is what retries (an Inngest step). It is logged once, naming
// `where` (the module, then the table, rpc or route) and the zod path of each issue, and never a
// row's values: rows can hold personal data.
//
// A module whose reads come from Supabase also registers them in a `*.boundary.ts` file beside it
// (`Boundary`, below), which `pnpm schemas:verify` runs against a real database.
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from '../../../../supabase/database.types.ts';

/** A parse: the value, typed by its schema, or the one line that says why it failed. */
export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

/** Where a failure is logged: console.error, unless a caller (the verify script) collects it. */
type Log = (line: string) => void;

const MAX_ISSUES = 5;

/** A zod path as code reads it: `[0].email`, or `(the answer)` for the value itself. */
function pathOf(path: readonly PropertyKey[]): string {
  if (path.length === 0) return '(the answer)';
  return path.map((key, i) => (typeof key === 'number' ? `[${key}]` : `${i === 0 ? '' : '.'}${String(key)}`)).join('');
}

/** One issue, by its path, its code, and what was expected or which columns are unknown: no value. */
function issueOf(issue: z.core.$ZodIssue): string {
  const at = `${pathOf(issue.path)} ${issue.code}`;
  if (issue.code === 'invalid_type') return `${at} (expected ${issue.expected})`;
  if (issue.code === 'unrecognized_keys') return `${at} (${issue.keys.join(', ')})`;
  return at;
}

/** The failure line: where, then at most five issues and how many more. */
function failureOf(where: string, error: z.ZodError): string {
  const shown = error.issues.slice(0, MAX_ISSUES).map(issueOf).join('; ');
  const more = error.issues.length - MAX_ISSUES;
  return `${where}: the answer does not parse: ${shown}${more > 0 ? ` and ${more} more` : ''}`;
}

function parseWith<T>(schema: z.ZodType<T>, answer: unknown, where: string, log: Log): Parsed<T> {
  const parsed = schema.safeParse(answer);
  if (parsed.success) return { ok: true, value: parsed.data };
  const error = failureOf(where, parsed.error);
  log(error);
  return { ok: false, error };
}

/**
 * The rows of an answer, each parsed with `schema`. An answer with no body (`null`, `undefined`)
 * is no rows, as the arcade has always read one; anything else must be a list of rows.
 */
export function parseRows<T>(schema: z.ZodType<T>, answer: unknown, where: string, log: Log = console.error): Parsed<T[]> {
  return parseWith(z.array(schema), answer ?? [], where, log);
}

/** One value (a row, an rpc's answer, a route's JSON), parsed with `schema` exactly as it came. */
export function parseRow<T>(schema: z.ZodType<T>, answer: unknown, where: string, log: Log = console.error): Parsed<T> {
  return parseWith(schema, answer, where, log);
}

/** The rows, or none: the failed read of a module that answers [] on an error. */
export function orEmpty<T>(parsed: Parsed<T[]>): T[] {
  return parsed.ok ? parsed.value : [];
}

/** The value, or null: the failed read of a module that answers null on an error. */
export function orNull<T>(parsed: Parsed<T>): T | null {
  return parsed.ok ? parsed.value : null;
}

/** The value, or a thrown error: the failed read of a module whose caller retries (an Inngest step). */
export function orThrow<T>(parsed: Parsed<T>): T {
  if (parsed.ok) return parsed.value;
  throw new Error(parsed.error);
}

/** What a Supabase read answers: its body, or its error. A query builder is a promise of one. */
export interface BoundaryAnswer {
  data: unknown;
  error: { message: string } | null;
}

/**
 * One read a module makes from Supabase, registered for `pnpm schemas:verify`
 * (scripts/schemas-verify.ts). A module lists its reads in a file beside it named `*.boundary.ts`,
 * which exports them as `boundaries`:
 *
 *   export const boundaries: Boundary[] = [{
 *     name: 'jev/store: jev_decisions',
 *     read: (db) => db.from('jev_decisions').select(DECISION_COLUMNS),
 *     schema: StoredDecision,
 *     shape: 'rows',
 *   }];
 *
 * The script finds every such file git tracks, runs each `read` against a database, and parses its
 * `data` as the module does: `shape: 'rows'` with `parseRows`, `'row'` with `parseRow`.
 *
 * - `name`: the module, then the table, rpc or route, as the module's own `where`.
 * - `read`: the module's own select or rpc, through its port, with whatever arguments reach real
 *   rows (no workspace filter, or the seed's). It only reads: the script refuses any request but a
 *   GET, so an rpc is called with `{ get: true }`, which PostgREST runs in a read-only transaction.
 * - `schema`: the schema the module parses the answer with (a row's, for `'rows'`).
 */
export interface Boundary<Db = SupabaseClient<Database>> {
  name: string;
  read: (db: Db) => PromiseLike<BoundaryAnswer>;
  schema: z.ZodType;
  shape: 'rows' | 'row';
}
