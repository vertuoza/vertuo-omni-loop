import 'server-only';
import { createHash } from 'node:crypto';
import { gunzipSync, gzipSync } from 'node:zlib';
import { unstable_cache } from 'next/cache';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../../supabase/database.types.ts';
import type { GalaxyView, LedgerEvent, Projects } from '@omni/galaxy';
import { log, type LogEntry } from 'vertuo-omni-plan/kit/lib/log/log.ts';
import { serverEnv } from '../env';

// The season, cached per workspace (PRD 657, s8). Folding the whole ledger through buildGalaxy on every
// page view pages the history; the fold is kept in Next's data cache, which Vercel shares across
// function instances. The key is everything the fold reads: the workspace, its newest ledger event and
// how many events it holds (an event backfilled behind the newest still changes the count), its
// sectors and fleets, and the UTC day (the fold ages wounds by the clock). A change to any of them is a
// new key, so a cached season is never stale by more than the day's clock.
//
// A new key folds again, but never rereads the whole ledger (#1844): the ledger read is cached too, per
// workspace, and a fold reads only the events after its tail (load-galaxy.ts). The ledger only grows
// (N-PRODUCT-16), so an older copy is never wrong, only short: it is read again every hour, so what is
// read after its tail stays a page.
//
// A cache entry cannot carry a viewer's cookies, so the fold on a miss reads the ledger with the
// service key, which bypasses row-level security. load-galaxy.ts reaches it only once the viewer's own
// newest-event read returned a row of that workspace, which proves them a member of it.

/** What an entry holds: how long it lives before it is computed again, and whether an unpacked entry is one. */
export interface Kept<T> { revalidate: number; is: (value: unknown) => value is T }

/** The data cache: the value under `key`, computed by `compute` when absent. */
export type SeasonCache = <T>(key: string[], compute: () => Promise<T>, kept: Kept<T>) => Promise<T>;

/** What the cached read needs: the cache, the service role's client, and where each load writes its one
 * line (none: nothing is logged). Null: the season is not cached. */
export type SeasonDeps = { cache: SeasonCache; service: SupabaseClient<Database>; log?: (entry: LogEntry) => void } | null;

/** The workspace's newest ledger event, as the viewer read it, and how many events its ledger holds. */
export interface Newest { id: string; at: string; count: number }

/** The workspace's ledger as a fold last read it, oldest first, and its last row as stored (`at` to the
 * microsecond, which the events' `at` is not), from which the next read starts. Null tail: it was empty. */
export interface ReadLedger { events: LedgerEvent[]; tail: { id: string; at: string } | null }

const DAY = 24 * 60 * 60;
const HOUR = 60 * 60;

/** The cache key of one workspace's season. */
export function seasonKey(workspace: string, newest: Newest, projects: Projects, now: Date): string[] {
  const shape = createHash('sha256').update(JSON.stringify(projects)).digest('hex').slice(0, 16);
  return ['season', workspace, newest.id, newest.at, String(newest.count), shape, now.toISOString().slice(0, 10)];
}

/** The key of one workspace's read ledger. */
export const ledgerKey = (workspace: string): string[] => ['season-ledger', workspace];

/** An entry as Next's data cache keeps it: its JSON, gzipped, in base64. Next refuses an entry over
 * 2 MB and keeps nothing (#1800), and a season's planets carry their logs: a grown workspace's season
 * passed 2 MB, while its gzip stays a tenth of that (10,571 events: the season 217 kB, its ledger 284 kB). */
const pack = (value: unknown): string => gzipSync(JSON.stringify(value)).toString('base64');

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

/** Whether an unpacked entry is a read ledger: its events, and a tail of an id and a date, or none. */
const isReadLedger = (value: unknown): value is ReadLedger => {
  if (typeof value !== 'object' || value === null || !Array.isArray(Reflect.get(value, 'events'))) return false;
  const tail: unknown = Reflect.get(value, 'tail');
  return tail === null || (typeof tail === 'object' && typeof Reflect.get(tail, 'id') === 'string' && typeof Reflect.get(tail, 'at') === 'string');
};

/** A season lives a day at most; the key changes with the day anyway. */
export const SEASON: Kept<GalaxyView> = { revalidate: DAY, is: isSeason };
/** A read ledger is read again every hour, so the events read after its tail stay few. */
export const LEDGER: Kept<ReadLedger> = { revalidate: HOUR, is: isReadLedger };

/** The value a packed entry holds, or null when it holds none: an entry stored before entries were
 * packed (the season itself, from a workspace still under 2 MB), or one that does not unpack. */
function unpack<T>(entry: unknown, is: (value: unknown) => value is T): T | null {
  if (typeof entry !== 'string') return null;
  try {
    const value: unknown = JSON.parse(gunzipSync(Buffer.from(entry, 'base64')).toString('utf8'));
    return is(value) ? value : null;
  } catch {
    return null;
  }
}

/** Next's data cache: the key names the entry, and an entry lives `kept.revalidate` at most. An entry
 * that holds no value of its kind is computed again, as on a miss. */
export const nextCache: SeasonCache = async (key, compute, kept) => {
  const entry: unknown = await unstable_cache(async () => pack(await compute()), key, { revalidate: kept.revalidate })();
  return unpack(entry, kept.is) ?? compute();
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
  return (live = { cache: nextCache, service, log: (entry) => { (entry.outcome === 'failed' ? log.error : log.info)(entry); } });
}
