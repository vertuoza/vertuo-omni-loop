import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadConstituents, type ConstituentsDb } from '../constituents/load';
import type { Constituent, ConstituentEvent } from '../constituents/model';
import { peopleOf, type FleetLookRow, type RosterRow } from '../people/load';
import type { Person } from '../people/types';

// The Constituents panel's read for Settings › Business (PRD 871 s2), as the signed-in person: every
// constituent of the business's products and their history (../constituents/load.ts), whether the
// person owns the workspace (is_owner(), PRD 400: only then are the controls drawn), and the people the
// history names, by account id, with the face their chip draws. A role that cannot be read reads as a
// member's; members that cannot be read leave every chip on its initial. Constituents that cannot be
// read leave the panel saying so, never the page.

export type ConstituentsPanelData = {
  /** Null when the constituents could not be read. */
  constituents: Constituent[] | null;
  events: ConstituentEvent[];
  owner: boolean;
  people: Record<string, Person>;
};

async function settled<T>(what: string, read: () => PromiseLike<{ data: unknown; error: { message: string } | null }>, none: T): Promise<T> {
  try {
    const { data, error } = await read();
    if (error) throw new Error(error.message);
    return (data ?? none) as T;
  } catch (err) {
    console.error(`business: could not read ${what} (${err instanceof Error ? err.message : String(err)})`);
    return none;
  }
}

export async function loadConstituentsPanel(db: SupabaseClient, workspace: string, products: readonly string[]): Promise<ConstituentsPanelData> {
  const [load, owner, roster, fleets] = await Promise.all([
    loadConstituents(db as unknown as ConstituentsDb, products),
    settled<unknown>('your role', () => db.rpc('is_owner', { workspace }), false),
    settled<RosterRow[]>('the workspace\'s members', () => db.rpc('workspace_roster', { workspace }), []),
    settled<FleetLookRow[]>('the fleets', () => db.from('teams').select('name, label, color, mascot').eq('workspace_id', workspace), []),
  ]);
  if (!load.ok) console.error(`business: ${load.reason}`);
  const events = load.ok ? load.events : [];
  const directory = peopleOf(roster, fleets);
  const names = new Map(roster.map((r) => [r.user_id, r.name ?? r.github_login ?? null]));
  const people: Record<string, Person> = {};
  for (const by of new Set(events.flatMap((e) => (e.by ? [e.by] : [])))) {
    const name = names.get(by);
    if (name) people[by] = directory.byId(by, name);
  }
  return { constituents: load.ok ? load.constituents : null, events, owner: owner === true, people };
}
