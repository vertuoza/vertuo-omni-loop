import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../../supabase/database.types.ts';
import { buildGalaxy, demoEvents, DEMO_PROJECTS, lookOf, type FleetConfig, type GalaxyView, type LedgerEvent, type Projects } from '@omni/galaxy';
import type { FleetRow, Player } from '../arcade/types';
import { defined } from 'omni-loop/kit/lib/narrow.ts';
import { LEDGER_COLUMNS, LedgerRow } from './ledger-row';
import { orThrow, parseRow, parseRows } from './parse-rows';
import { PLAYER_COLUMNS, StoredPlayer } from './players';
import { LEDGER, ledgerKey, liveSeason, SEASON, seasonKey, type Newest, type ReadLedger, type SeasonDeps } from './season-cache';
import { listOf } from './unparsed';

// Every loader reads one workspace, as the signed-in member: row-level security already hides every
// workspace they do not belong to, and the filter keeps a member of several to the one shown.

const PAGE = 1000;

/** The demo galaxy: a fictional GitHub snapshot through the real projector. */
export function demoGalaxy(now = new Date()): GalaxyView {
  return buildGalaxy(demoEvents(now), { projects: DEMO_PROJECTS, now, source: 'demo' });
}

/**
 * The demo world's fleets, invented like the rest of it: the demo mode's, HOME's trading cards and
 * the artifact's. Never a signed-out visitor's or a workspace's whose read failed (PRD 400).
 */
export function demoFleets(): FleetRow[] {
  return fleetsFrom(Object.entries(DEMO_PROJECTS.teams).map(([name, t]) => ({ name, ...t })));
}

type TeamRow = { name: string; home: string | null; label?: string | undefined; color?: string | undefined; motto?: string | undefined; mascot?: string | null | undefined; sort?: number | undefined; retired_at?: string | null | undefined; retired?: boolean | undefined };
const fleetsFrom = (rows: TeamRow[]): FleetRow[] => rows
  .map((r) => ({ name: r.name, ...lookOf(r.name, { ...r, retired: r.retired ?? Boolean(r.retired_at) }) }))
  .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));

const TEAM_COLUMNS = 'name, home, label, color, motto, mascot, sort, retired_at';

/** Every fleet of the workspace, retired ones included (history still names them). */
export async function loadFleets(db: SupabaseClient<Database>, workspace: string): Promise<FleetRow[]> {
  const { data, error } = await db.from('teams').select(TEAM_COLUMNS).eq('workspace_id', workspace);
  if (error) throw new Error(`Supabase: could not read the fleets (${error.message})`);
  return fleetsFrom(listOf(data));
}

/**
 * The workspace's galaxy: its ledger, sectors and fleets, folded by buildGalaxy. With a service key
 * (season-cache.ts, PRD 657), the fold is cached: the viewer reads the newest event with the count, and
 * the sectors and fleets, and the ledger is read, with the service key, only when that key is new, and
 * then only past the ledger read before (ledgerTo, #1844). A
 * viewer who reads no event (not a member, or an empty ledger) gets the fold of nothing, as the
 * uncached read gives them, and the service key is never used for them.
 *
 * Each cached load writes one `galaxy-season` line (ADR-0102): its total `ms`, and in its message hit or
 * miss and what each stage took (the viewer's reads, the ledger cache, the rows after its tail or a
 * whole reread and why, the fold, the season cache), so a slow page says where its time went.
 */
export async function loadGalaxy(db: SupabaseClient<Database>, workspace: string, now = new Date(), season: SeasonDeps = liveSeason()): Promise<GalaxyView> {
  if (!season) {
    const [rows, projects] = await Promise.all([readRows(db, workspace), readProjects(db, workspace)]);
    return buildGalaxy(rows.map(eventOf), { projects, now, source: 'supabase' });
  }
  const trace: Trace = { stages: [], miss: false };
  const started = performance.now();
  try {
    const [newest, projects] = await timed(trace, () => 'viewer', () => Promise.all([readNewest(db, workspace), readProjects(db, workspace)]));
    const view = newest
      ? await timed(trace, () => 'season', () => season.cache(seasonKey(workspace, newest, projects, now), async () => {
        trace.miss = true;
        const events = await ledgerTo(season, workspace, newest, trace);
        return timed(trace, () => `fold ${plural(events.length, 'event')}`, () => Promise.resolve(buildGalaxy(events, { projects, now, source: 'supabase' })));
      }, SEASON))
      : buildGalaxy([], { projects, now, source: 'supabase' });
    season.log?.({ event: 'galaxy-season', outcome: 'ok', ms: since(started), message: lineOf(trace, newest !== null) });
    return view;
  } catch (error) {
    season.log?.({ event: 'galaxy-season', outcome: 'failed', ms: since(started), message: lineOf(trace, true), error });
    throw error;
  }
}

/** What one load did, stage by stage, for its one log line (ADR-0102); `miss`: the season was folded. */
type Trace = { stages: string[]; miss: boolean };

const since = (start: number): number => Math.round(performance.now() - start);
const plural = (n: number, noun: string): string => `${String(n)} ${noun}${n === 1 ? '' : 's'}`;

/** `run`, its time added to the trace under the label its value gives. */
async function timed<T>(trace: Trace, label: (value: T) => string, run: () => Promise<T>): Promise<T> {
  const start = performance.now();
  const value = await run();
  trace.stages.push(`${label(value)} ${String(since(start))} ms`);
  return value;
}

/** The line's message: hit or miss (or none, when the viewer read no event), then each stage in order. */
const lineOf = (trace: Trace, read: boolean): string =>
  [read ? (trace.miss ? 'miss' : 'hit') : 'no event', ...trace.stages].join(' · ');

/**
 * The workspace's ledger up to the viewer's newest event, with the service key: the ledger read before
 * (the cached one), and only the rows from its tail on. When the events up to the newest are not as
 * many as the count says, one was added behind the tail (a backfill), and the whole ledger is read again.
 */
async function ledgerTo(season: NonNullable<SeasonDeps>, workspace: string, newest: Newest, trace: Trace): Promise<LedgerEvent[]> {
  let cached = true;
  const read = await timed(trace, (r) => (cached ? 'ledger cache' : `ledger cache miss: whole ledger, ${plural(r.events.length, 'row')}`),
    () => season.cache(ledgerKey(workspace), () => { cached = false; return readWhole(season.service, workspace); }, LEDGER));
  const whole = (why: string) => timed(trace, (events) => `whole ledger again (${why}), ${plural(events.length, 'row')}`,
    async () => (await readRows(season.service, workspace)).map(eventOf));
  if (read.events.some((e) => e.id === newest.id)) return upTo(read.events, newest) ?? whole('an event behind its tail');
  if (!read.tail) return whole('it was empty');
  const tail = read.tail;
  const known = new Set(read.events.map((e) => e.id));
  const fresh = await timed(trace, (rows) => `after its tail, ${plural(rows.length, 'new row')}`,
    async () => (await readRows(season.service, workspace, tail.at)).filter((row) => !known.has(row.id)));
  // A new row at the tail's own instant may sort before the tail: it is a backfill.
  if (fresh.some((row) => row.at === tail.at)) return whole('an event at its tail\'s instant');
  return upTo([...read.events, ...fresh.map(eventOf)], newest) ?? whole('an event behind its tail');
}

/** The events up to `newest`, or null when they are not as many as its count. */
function upTo(events: LedgerEvent[], newest: Newest): LedgerEvent[] | null {
  const end = events.findIndex((e) => e.id === newest.id) + 1;
  return end === newest.count ? events.slice(0, end) : null;
}

/** The whole ledger, read with its tail, as the cache keeps it. */
async function readWhole(db: SupabaseClient<Database>, workspace: string): Promise<ReadLedger> {
  const rows = await readRows(db, workspace);
  const last = rows.at(-1);
  return { events: rows.map(eventOf), tail: last ? { id: last.id, at: last.at } : null };
}

/** The workspace's newest ledger event and how many it holds, as the viewer reads them; null when none shows. */
async function readNewest(db: SupabaseClient<Database>, workspace: string): Promise<Newest | null> {
  const { data, error, count } = await db
    .from('ledger_events')
    .select('id, at', { count: 'exact' })
    .eq('workspace_id', workspace)
    .not('home', 'is', null)
    .order('at', { ascending: false })
    .order('id', { ascending: false })
    .limit(1);
  if (error) throw new Error(`Supabase: could not read ledger_events (${error.message})`);
  const row = listOf(data)[0];
  return row ? { id: row.id, at: new Date(row.at).toISOString(), count: count ?? 0 } : null;
}


/**
 * A stored ledger row as buildGalaxy reads an event: its date to the second, empty fields left out.
 * Its home (PRD 728) keys its planet by `<home>#<n>`. Rows written before the fresh start have none
 * and are never read: they count for nothing and show no planet (PRD 728, the fresh start).
 */
function eventOf(row: LedgerRow): LedgerEvent {
  return {
    id: row.id, at: new Date(row.at).toISOString().replace(/\.\d{3}Z$/, 'Z'), type: row.type, planet: row.planet, data: row.data ?? {},
    ...(row.home ? { home: row.home } : {}),
    ...(row.region ? { region: row.region } : {}),
    ...(row.contributor ? { contributor: row.contributor } : {}),
    ...(row.team ? { team: row.team } : {}),
  };
}

/** One page of the workspace's ledger, oldest first, from the date `since` on when it is given. */
async function ledgerPage(db: SupabaseClient<Database>, workspace: string, from: number, since: string | undefined): Promise<LedgerRow[]> {
  const rows = db
    .from('ledger_events')
    .select(LEDGER_COLUMNS)
    .eq('workspace_id', workspace)
    .not('home', 'is', null);
  const { data, error } = await (since === undefined ? rows : rows.gte('at', since))
    .order('at', { ascending: true })
    .order('id', { ascending: true })
    .range(from, from + PAGE - 1);
  if (error) throw new Error(`Supabase: could not read ledger_events (${error.message})`);
  return orThrow(parseRows(LedgerRow, data, 'data/load-galaxy: ledger_events'));
}

/** Every row of the workspace's ledger, oldest first, a page at a time; from the date `since` on when it is given. */
async function readRows(db: SupabaseClient<Database>, workspace: string, since?: string): Promise<LedgerRow[]> {
  const rows: LedgerRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const page = await ledgerPage(db, workspace, from, since);
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}

/** The workspace's sectors and fleets, as buildGalaxy takes them. */
async function readProjects(db: SupabaseClient<Database>, workspace: string): Promise<Projects> {
  const [sectors, teams] = await Promise.all([
    db.from('sectors').select('name, repos').eq('workspace_id', workspace),
    db.from('teams').select(TEAM_COLUMNS).eq('workspace_id', workspace),
  ]);
  if (sectors.error || teams.error) throw new Error(`Supabase: could not read sectors/teams (${defined(sectors.error ?? teams.error, 'the refusal').message})`);
  return {
    sectors: Object.fromEntries(listOf(sectors.data).map((s) => [s.name, { repos: listOf(s.repos) }])),
    teams: Object.fromEntries(listOf(teams.data).map((t): [string, FleetConfig] => [t.name, {
      home: t.home, label: t.label, color: t.color, motto: t.motto, mascot: t.mascot, sort: t.sort, retired: Boolean(t.retired_at),
    }])),
  };
}

/** The workspace's whole crew: names and heroes for the Hall of Heroes and the fleet screens. */
export async function loadCrew(db: SupabaseClient<Database>, workspace: string): Promise<Player[]> {
  const { data, error } = await db.from('players').select(PLAYER_COLUMNS).eq('workspace_id', workspace).order('display_name');
  if (error) throw new Error(`Supabase: could not read the players (${error.message})`);
  return orThrow(parseRows(StoredPlayer, data, 'data/load-galaxy: players'));
}

/** The signed-in person's own player row in the workspace, or null before they pick a fleet. */
export async function loadMe(db: SupabaseClient<Database>, workspace: string, userId: string): Promise<Player | null> {
  const { data, error } = await db.from('players').select(PLAYER_COLUMNS).eq('workspace_id', workspace).eq('user_id', userId).maybeSingle();
  if (error) throw new Error(`Supabase: could not read your player (${error.message})`);
  return data === null ? null : orThrow(parseRow(StoredPlayer, data, 'data/load-galaxy: players'));
}
