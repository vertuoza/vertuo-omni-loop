// The read behind /releases (PRD 262). Anyone may read public.releases (its migration's one select
// policy, for anon and authenticated), so the page reads it as nobody: the project's URL and its
// publishable key, the two public variables the browser already holds, with no session kept and no
// cookie read. It never writes: only the sync does, as the service role.
//
// The read itself is the table's own (sync-table.ts, releasesTable().rows()): every row, every column,
// a page at a time, each row checked against the row schema. A refusal or a row it cannot read
// throws; the page decides what a visitor then sees (page/source.ts).
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { ReleaseRow } from './row.ts';
import { releasesTable } from './sync-table.ts';

export type ReleasesEnv = { url: string; key: string };

type Env = Record<string, string | undefined>;

/** Where the page reads: the project the two public variables name, or null while either is unset. */
export function releasesEnv(env: Env): ReleasesEnv | null {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? { url, key } : null;
}

/** No session: nothing stored, nothing refreshed, nothing read from the address. */
const NO_SESSION = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } } as const;

type Connect = (url: string, key: string, options: typeof NO_SESSION) => Pick<SupabaseClient, 'from'>;

const anonymous: Connect = (url, key, options) => createClient(url, key, options);

/** Every row of public.releases, by PRD, read with the publishable key. */
export function readReleases({ url, key }: ReleasesEnv, connect: Connect = anonymous): Promise<ReleaseRow[]> {
  return releasesTable(connect(url, key, NO_SESSION)).rows();
}
