import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildGalaxy, demoEvents, DEMO_PROJECTS, lookOf, type FleetConfig, type GalaxyView, type LedgerEvent, type Projects } from '@omni/galaxy';
import type { FleetRow, Player } from '../arcade/types';

const PAGE = 1000;

/** The demo galaxy: a fictional GitHub snapshot through the real projector. */
export function demoGalaxy(now = new Date()): GalaxyView {
  return buildGalaxy(demoEvents(now), { projects: DEMO_PROJECTS, now, source: 'demo' });
}

/** The demo fleets, as the migration seeds them. */
export function demoFleets(): FleetRow[] {
  return fleetsFrom(Object.entries(DEMO_PROJECTS.teams).map(([name, t]) => ({ name, ...t })));
}

type TeamRow = { name: string; home: string | null; label?: string; color?: string; motto?: string; mascot?: string | null; sort?: number; retired_at?: string | null; retired?: boolean };
const fleetsFrom = (rows: TeamRow[]): FleetRow[] => rows
  .map((r) => ({ name: r.name, ...lookOf(r.name, { ...r, retired: r.retired ?? Boolean(r.retired_at) }) }))
  .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));

const TEAM_COLUMNS = 'name, home, label, color, motto, mascot, sort, retired_at';

/** Every fleet, retired ones included (history still names them). Readable signed out. */
export async function loadFleets(db: SupabaseClient): Promise<FleetRow[]> {
  const { data, error } = await db.from('teams').select(TEAM_COLUMNS);
  if (error) throw new Error(`Supabase: could not read the fleets (${error.message})`);
  return fleetsFrom((data ?? []) as TeamRow[]);
}

/** The galaxy, read as the signed-in player: row-level security lets only the crew read it. */
export async function loadGalaxy(db: SupabaseClient, now = new Date()): Promise<GalaxyView> {
  const events: LedgerEvent[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from('ledger_events')
      .select('id, at, type, planet, region, contributor, team, data')
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
  const [sectors, teams] = await Promise.all([db.from('sectors').select('name, repos'), db.from('teams').select(TEAM_COLUMNS)]);
  if (sectors.error || teams.error) throw new Error(`Supabase: could not read sectors/teams (${(sectors.error ?? teams.error)!.message})`);
  const projects: Projects = {
    sectors: Object.fromEntries((sectors.data ?? []).map((s) => [s.name, { repos: s.repos ?? [] }])),
    teams: Object.fromEntries(((teams.data ?? []) as TeamRow[]).map((t): [string, FleetConfig] => [t.name, {
      home: t.home, label: t.label, color: t.color, motto: t.motto, mascot: t.mascot, sort: t.sort, retired: Boolean(t.retired_at),
    }])),
  };
  return buildGalaxy(events, { projects, now, source: 'supabase' });
}

const PLAYER_COLUMNS = 'id, display_name, team, team_since, hero, github_login';

/** The whole crew: names and heroes for the Hall of Heroes and the fleet screens. */
export async function loadCrew(db: SupabaseClient): Promise<Player[]> {
  const { data, error } = await db.from('players').select(PLAYER_COLUMNS).order('display_name');
  if (error) throw new Error(`Supabase: could not read the players (${error.message})`);
  return (data ?? []) as Player[];
}

/** The signed-in player's own row, or null before they pick a fleet. */
export async function loadMe(db: SupabaseClient, id: string): Promise<Player | null> {
  const { data, error } = await db.from('players').select(PLAYER_COLUMNS).eq('id', id).maybeSingle();
  if (error) throw new Error(`Supabase: could not read your player (${error.message})`);
  return (data as Player | null) ?? null;
}
