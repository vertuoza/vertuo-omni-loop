// Every row of a Supabase read, a page at a time: PostgREST answers at most a thousand rows at once.
// The dashboards' reads (src/dashboard/board/load.ts) and the Engineering board's
// (src/engineering/load.ts) page through the same way.
import type { z } from 'zod';
import { orThrow, parseRows } from './parse-rows';

const PAGE = 1000;

/** One page of a read: its rows (null with none), or the error Supabase answered. */
export type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/** Every row of a paged read, PAGE rows at a time; `what` names it when it fails. */
export async function allPages<T>(what: string, page: (from: number, to: number) => Page<T>): Promise<T[]> {
  const rows: T[] = [];
  for (let start = 0; ; start += PAGE) {
    const { data, error } = await page(start, start + PAGE - 1);
    if (error) throw new Error(`Supabase: could not read ${what} (${error.message})`);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

/** One page of a read as it came: its body, unparsed, or the error Supabase answered. */
export type RawPage = PromiseLike<{ data: unknown; error: { message: string } | null }>;

/** Every row of a paged read, each page parsed with `schema` (parse-rows.ts): a page that does not
 * parse fails the read, logged by `where`, as a refused one does. */
export async function parsedPages<T>(what: string, schema: z.ZodType<T>, where: string, page: (from: number, to: number) => RawPage): Promise<T[]> {
  return allPages(what, async (from, to) => {
    const { data, error } = await page(from, to);
    return error ? { data: null, error } : { data: orThrow(parseRows(schema, data, where)), error: null };
  });
}
