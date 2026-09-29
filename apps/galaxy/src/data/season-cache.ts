import 'server-only';
import { createHash } from 'node:crypto';
import { unstable_cache } from 'next/cache';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { GalaxyView, Projects } from '@omni/galaxy';

// The season, cached per workspace (PRD 657, s8). Folding the whole ledger through buildGalaxy on every
// page view pages the history; the fold is kept in Next's data cache, which Vercel shares across
// function instances. The key is everything the fold reads: the workspace, its newest ledger event and
// how many events it holds (an event backfilled behind the newest still changes the count), its
// sectors and fleets, and the UTC day (the fold ages wounds by the clock). A change to any of them is a
// new key, so a cached season is never stale by more than the day's clock.
//
// A cache entry cannot carry a viewer's cookies, so the fold on a miss reads the ledger with the
// service key, which bypasses row-level security. load-galaxy.ts reaches it only once the viewer's own
// newest-event read returned a row of that workspace, which proves them a member of it.

/** The data cache: the value under `key`, computed by `compute` when absent. */
export type SeasonCache = (key: string[], compute: () => Promise<GalaxyView>) => Promise<GalaxyView>;

/** What the cached read needs: the cache and the service role's client. Null: the season is not cached. */
export type SeasonDeps = { cache: SeasonCache; service: SupabaseClient } | null;

/** The workspace's newest ledger event, as the viewer read it, and how many events its ledger holds. */
export interface Newest { id: string; at: string; count: number }

const DAY = 24 * 60 * 60;

/** The cache key of one workspace's season. */
export function seasonKey(workspace: string, newest: Newest, projects: Projects, now: Date): string[] {
  const shape = createHash('sha256').update(JSON.stringify(projects)).digest('hex').slice(0, 16);
  return ['season', workspace, newest.id, newest.at, String(newest.count), shape, now.toISOString().slice(0, 10)];
}

/** Next's data cache: the key names the entry, and an entry lives a day at most. */
const nextCache: SeasonCache = (key, compute) => unstable_cache(compute, key, { revalidate: DAY })();

/** The cache and the service client of this deployment, or null when it holds no service key. */
let live: SeasonDeps | undefined;
export function liveSeason(): SeasonDeps {
  if (live !== undefined) return live;
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return (live = null);
  const service = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  return (live = { cache: nextCache, service });
}
