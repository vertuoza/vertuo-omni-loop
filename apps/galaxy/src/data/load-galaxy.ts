import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildGalaxy, demoEvents, DEMO_PROJECTS, lookOf, type FleetConfig, type GalaxyView, type LedgerEvent, type Projects } from '@omni/galaxy';
import type { FleetRow, Player } from '../arcade/types';
import { PLAYER_COLUMNS } from './players';
import { liveSeason, seasonKey, type Newest, type SeasonDeps } from './season-cache';

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

type TeamRow = { name: string; home: string | null; label?: string; color?: string; motto?: string; mascot?: string | null; sort?: number; retired_at?: string | null; retired?: boolean };
const fleetsFrom = (rows: TeamRow[]): FleetRow[] => rows
  .map((r) => ({ name: r.name, ...lookOf(r.name, { ...r, retired: r.retired ?? Boolean(r.retired_at) }) }))
  .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));

const TEAM_COLUMNS = 'name, home, label, color, motto, mascot, sort, retired_at';

/** Every fleet of the workspace, retired ones included (history still names them). */
export async function loadFleets(db: SupabaseClient, workspace: string): Promise<FleetRow[]> {
  const { data, error } = await db.from('teams').select(TEAM_COLUMNS).eq('workspace_id', workspace);
  if (error) throw new Error(`Supabase: could not read the fleets (${error.message})`);
  return fleetsFrom((data ?? []) as TeamRow[]);
}

/**
 * The workspace's galaxy: its ledger, sectors and fleets, folded by buildGalaxy. With a service key
 * (season-cache.ts, PRD 657), the fold is cached: the viewer reads the newest event with the count, and
 * the sectors and fleets, and the ledger is paged, with the service key, only when that key is new. A
 * viewer who reads no event (not a member, or an empty ledger) gets the fold of nothing, as the
 * uncached read gives them, and the service key is never used for them.
 */
export async function loadGalaxy(db: SupabaseClient, workspace: string, now = new Date(), season: SeasonDeps = liveSeason()): Promise<GalaxyView> {
  if (!season) {
    const [events, projects] = await Promise.all([readLedger(db, workspace), readProjects(db, workspace)]);
    return buildGalaxy(events, { projects, now, source: 'supabase' });
  }
  const [newest, projects] = await Promise.all([readNewest(db, workspace), readProjects(db, workspace)]);
  if (!newest) return buildGalaxy([], { projects, now, source: 'supabase' });
  return season.cache(seasonKey(workspace, newest, projects, now), async () =>
    buildGalaxy(await readLedger(season.service, workspace), { projects, now, source: 'supabase' }));
}

/** The workspace's newest ledger event and how many it holds, as the viewer reads them; null when none shows. */
async function readNewest(db: SupabaseClient, workspace: string): Promise<Newest | null> {
  const { data, error, count } = await db
    .from('ledger_events')
    .select('id, at', { count: 'exact' })
    .eq('workspace_id', workspace)
    .order('at', { ascending: false })
    .order('id', { ascending: false })
    .limit(1);
  if (error) throw new Error(`Supabase: could not read ledger_events (${error.message})`);
  const row = (data ?? [])[0] as { id: string; at: string } | undefined;
  return row ? { id: row.id, at: new Date(row.at).toISOString(), count: count ?? 0 } : null;
}

/** Every event of the workspace's ledger, oldest first, a page at a time. */
async function readLedger(db: SupabaseClient, workspace: string): Promise<LedgerEvent[]> {
  const events: LedgerEvent[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from('ledger_events')
      .select('id, at, type, planet, region, contributor, team, data')
      .eq('workspace_id', workspace)
      .order('at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Supabase: could not read ledger_events (${error.message})`);
    for (const row of data ?? []) {
      events.push({
        id: row.id, at: new Date(row.at).toISOString().replace(/\.\d{3}Z$/, 'Z'), type: row.type, planet: row.planet, data: row.data ?? {},
        ...(row.region ? { region: row.region } : {}),
        ...(row.contributor ? { contributor: row.contributor } : {}),
        ...(row.team ? { team: row.team } : {}),
      });
    }
    if (!data || data.length < PAGE) break;
  }
  return events;
}

/** The workspace's sectors and fleets, as buildGalaxy takes them. */
async function readProjects(db: SupabaseClient, workspace: string): Promise<Projects> {
  const [sectors, teams] = await Promise.all([
    db.from('sectors').select('name, repos').eq('workspace_id', workspace),
    db.from('teams').select(TEAM_COLUMNS).eq('workspace_id', workspace),
  ]);
  if (sectors.error || teams.error) throw new Error(`Supabase: could not read sectors/teams (${(sectors.error ?? teams.error)!.message})`);
  return {
    sectors: Object.fromEntries((sectors.data ?? []).map((s) => [s.name, { repos: s.repos ?? [] }])),
    teams: Object.fromEntries(((teams.data ?? []) as TeamRow[]).map((t): [string, FleetConfig] => [t.name, {
      home: t.home, label: t.label, color: t.color, motto: t.motto, mascot: t.mascot, sort: t.sort, retired: Boolean(t.retired_at),
    }])),
  };
}

/** The workspace's whole crew: names and heroes for the Hall of Heroes and the fleet screens. */
export async function loadCrew(db: SupabaseClient, workspace: string): Promise<Player[]> {
  const { data, error } = await db.from('players').select(PLAYER_COLUMNS).eq('workspace_id', workspace).order('display_name');
  if (error) throw new Error(`Supabase: could not read the players (${error.message})`);
  return (data ?? []) as unknown as Player[];
}

/** The signed-in person's own player row in the workspace, or null before they pick a fleet. */
export async function loadMe(db: SupabaseClient, workspace: string, userId: string): Promise<Player | null> {
  const { data, error } = await db.from('players').select(PLAYER_COLUMNS).eq('workspace_id', workspace).eq('user_id', userId).maybeSingle();
  if (error) throw new Error(`Supabase: could not read your player (${error.message})`);
  return (data as unknown as Player | null) ?? null;
}
