import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { buildGalaxy, demoEvents, DEMO_PROJECTS, type GalaxyView, type LedgerEvent, type Projects } from '@omni/galaxy';

const PAGE = 1000;

// Reads the ledger from Supabase when a project is configured, else plays the demo galaxy.
// Either way the view comes out of the same fold (buildGalaxy), so the UI cannot tell them apart.
export async function loadGalaxy(now = new Date()): Promise<GalaxyView> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return buildGalaxy(demoEvents(now), { projects: DEMO_PROJECTS, now, source: 'demo' });

  const db = createClient(url, key, { auth: { persistSession: false } });
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
        id: row.id, at: new Date(row.at).toISOString(), type: row.type, planet: row.planet, data: row.data ?? {},
        ...(row.region ? { region: row.region } : {}),
        ...(row.contributor ? { contributor: row.contributor } : {}),
        ...(row.team ? { team: row.team } : {}),
      });
    }
    if (!data || data.length < PAGE) break;
  }

  const [sectors, teams] = await Promise.all([
    db.from('sectors').select('name, repos'),
    db.from('teams').select('name, home'),
  ]);
  if (sectors.error || teams.error) throw new Error(`Supabase: could not read sectors/teams (${(sectors.error ?? teams.error)!.message})`);
  const projects: Projects = {
    sectors: Object.fromEntries((sectors.data ?? []).map((s) => [s.name, { repos: s.repos ?? [] }])),
    teams: Object.fromEntries((teams.data ?? []).map((t) => [t.name, { home: t.home }])),
  };
  return buildGalaxy(events, { projects, now, source: 'supabase' });
}
