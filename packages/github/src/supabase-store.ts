// The client's store in Supabase (PRD 902, s1): github_etags and github_budget, written and read with the
// service role, the only role granted them (supabase/migrations/*_github_budget.sql). `db` is a
// supabase-js client's two tables; nothing here imports it, so either app passes its own. Every row is parsed where
// it comes in (PRD 1030). Every refusal throws, and the client then calls GitHub without the store.
import { z } from 'zod';
import type { GithubStore } from './client.ts';

type Answer = PromiseLike<{ data: unknown; error: { message: string } | null }>;

/** A read or write filtered by its table's two key columns, then read as one row or as the rows it touched. */
interface Keyed {
  maybeSingle(): Answer;
  select(columns: string): Answer;
}
interface Filtered<Key extends string> {
  eq(column: 'installation_id', value: number): { eq(column: Key, value: string): Keyed };
}

type EtagInsert = { installation_id: number; url: string; etag: string; body: string; content_type: string | null; read_at: string };
type BudgetInsert = { installation_id: number; resource: string; limit: number; remaining: number; reset_at: string; paused_until?: string | null; updated_at: string };

/** One table as the store writes it. */
interface Table<Insert, Key extends string> {
  select(columns: string): Filtered<Key>;
  update(values: Partial<Insert>): Filtered<Key>;
  upsert(values: Insert, options: { onConflict: string }): Answer;
}

/** The slice of a supabase-js client the store calls. */
export interface GithubDb {
  /** `db.etags()`, made fresh for each query. */
  etags(): Table<EtagInsert, 'url'>;
  /** `db.budget()`, made fresh for each query. */
  budget(): Table<BudgetInsert, 'resource'>;
}

const ETAG_COLUMNS = 'etag, body, content_type, read_at';
const StoredEtagRow = z.strictObject({ etag: z.string(), body: z.string(), content_type: z.string().nullable(), read_at: z.string() });
const BUDGET_COLUMNS = 'limit, remaining, reset_at, paused_until, updated_at';
const StoredBudgetRow = z.strictObject({
  limit: z.number(), remaining: z.number(), reset_at: z.string(), paused_until: z.string().nullable(), updated_at: z.string(),
});
const PausedRows = z.array(z.strictObject({ resource: z.string() }));

const ms = (value: string) => Date.parse(value);
const iso = (value: number) => new Date(value).toISOString();

function refused(what: string, error: { message: string } | null): void {
  if (error) throw new Error(`Supabase refused to ${what}: ${error.message}`);
}

/** A row read back, or null when there is none; a row of another shape throws, naming the zod path only. */
function rowOf<T>(schema: z.ZodType<T>, data: unknown, table: string): T | null {
  if (data === null) return null;
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new Error(`${table} answered an unexpected row (${parsed.error.issues.map((issue) => `${issue.path.join('.') || '(the row)'} ${issue.code}`).join('; ')})`);
  return parsed.data;
}

export function supabaseGithubStore(db: GithubDb): GithubStore {
  return {
    async etag(installation, url) {
      const { data, error } = await db.etags().select(ETAG_COLUMNS)
        .eq('installation_id', installation).eq('url', url).maybeSingle();
      refused('read an ETag', error);
      const row = rowOf(StoredEtagRow, data, 'github_etags');
      return row ? { etag: row.etag, body: row.body, contentType: row.content_type, readAt: ms(row.read_at) } : null;
    },
    async saveEtag(installation, url, { etag, body, contentType = null, at }) {
      const { error } = await db.etags().upsert(
        { installation_id: installation, url, etag, body, content_type: contentType, read_at: iso(at) },
        { onConflict: 'installation_id,url' },
      );
      refused('store an ETag', error);
    },
    async touchEtag(installation, url, at) {
      const { error } = await db.etags().update({ read_at: iso(at) }).eq('installation_id', installation).eq('url', url).select('url');
      refused('mark an ETag read', error);
    },
    async budget(installation, resource) {
      const { data, error } = await db.budget().select(BUDGET_COLUMNS)
        .eq('installation_id', installation).eq('resource', resource).maybeSingle();
      refused('read the GitHub budget', error);
      const row = rowOf(StoredBudgetRow, data, 'github_budget');
      return row
        ? { limit: row.limit, remaining: row.remaining, resetAt: ms(row.reset_at), pausedUntil: row.paused_until === null ? null : ms(row.paused_until), updatedAt: ms(row.updated_at) }
        : null;
    },
    /** What an answer reported; the columns it leaves out (paused_until) keep their value. */
    async saveBudget(installation, resource, { limit, remaining, resetAt, at }) {
      const { error } = await db.budget().upsert(
        { installation_id: installation, resource, limit, remaining, reset_at: iso(resetAt), updated_at: iso(at) },
        { onConflict: 'installation_id,resource' },
      );
      refused('store the GitHub budget', error);
    },
    async pause(installation, resource, until, at) {
      const { data, error } = await db.budget().update({ paused_until: iso(until), updated_at: iso(at) })
        .eq('installation_id', installation).eq('resource', resource).select('resource');
      refused('pause the GitHub budget', error);
      if ((rowOf(PausedRows, data, 'github_budget') ?? []).length > 0) return;
      const inserted = await db.budget().upsert(
        { installation_id: installation, resource, limit: 0, remaining: 0, reset_at: iso(until), paused_until: iso(until), updated_at: iso(at) },
        { onConflict: 'installation_id,resource' },
      );
      refused('pause the GitHub budget', inserted.error);
    },
  };
}
