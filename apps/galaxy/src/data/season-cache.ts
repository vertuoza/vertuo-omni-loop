import 'server-only';
import { createHash } from 'node:crypto';
import { gunzipSync, gzipSync } from 'node:zlib';
import { unstable_cache } from 'next/cache';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../../supabase/database.types.ts';
import type { GalaxyView, Projects } from '@omni/galaxy';
import { serverEnv } from '../env';

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
export type SeasonDeps = { cache: SeasonCache; service: SupabaseClient<Database> } | null;

/** The workspace's newest ledger event, as the viewer read it, and how many events its ledger holds. */
export interface Newest { id: string; at: string; count: number }

const DAY = 24 * 60 * 60;

/** The cache key of one workspace's season. */
export function seasonKey(workspace: string, newest: Newest, projects: Projects, now: Date): string[] {
  const shape = createHash('sha256').update(JSON.stringify(projects)).digest('hex').slice(0, 16);
  return ['season', workspace, newest.id, newest.at, String(newest.count), shape, now.toISOString().slice(0, 10)];
}

/** The season as Next's data cache keeps it: its JSON, gzipped, in base64. Next refuses an entry over
 * 2 MB and keeps nothing (#1800), and a season's planets carry their logs: a grown workspace's season
 * passed 2 MB, while its gzip stays a tenth of that. */
const packSeason = (season: GalaxyView): string => gzipSync(JSON.stringify(season)).toString('base64');

/** The fields every fold gives a season, and their kinds. */
const SEASON_FIELDS = {
  source: 'string', season: 'string', planets: 'array', sectors: 'array', teams: 'array', heroes: 'array', feed: 'array', totals: 'object', rules: 'object',
} as const;

/** Whether an unpacked entry is a season: each of SEASON_FIELDS, of its kind. */
const isSeason = (value: unknown): value is GalaxyView =>
  typeof value === 'object' && value !== null && Object.entries(SEASON_FIELDS).every(([name, kind]) => {
    const field: unknown = Reflect.get(value, name);
    return kind === 'array' ? Array.isArray(field) : typeof field === kind && field !== null;
  });

/** The season a packed entry holds, or null when it holds none: an entry stored before seasons were
 * packed (the season itself, from a workspace still under 2 MB), or one that does not unpack. */
function unpackSeason(entry: unknown): GalaxyView | null {
  if (typeof entry !== 'string') return null;
  try {
    const value: unknown = JSON.parse(gunzipSync(Buffer.from(entry, 'base64')).toString('utf8'));
    return isSeason(value) ? value : null;
  } catch {
    return null;
  }
}

/** Next's data cache: the key names the entry, and an entry lives a day at most. An entry that holds
 * no season is folded again, as on a miss. */
export const nextCache: SeasonCache = async (key, compute) => {
  const entry: unknown = await unstable_cache(async () => packSeason(await compute()), key, { revalidate: DAY })();
  return unpackSeason(entry) ?? compute();
};

/** The cache and the service client of this deployment, or null when it holds no service key. */
let live: SeasonDeps | undefined;
export function liveSeason(): SeasonDeps {
  if (live !== undefined) return live;
  const { supabase, serviceRole } = serverEnv();
  const url = serviceRole?.url ?? supabase?.url;
  const key = serviceRole?.key;
  if (!url || !key) return (live = null);
  const service = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  return (live = { cache: nextCache, service });
}
