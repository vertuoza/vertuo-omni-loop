import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { loadConstituents, type ConstituentsDb } from '../constituents/load';
import type { Constituent, ConstituentEvent } from '../constituents/model';
import { peopleOf } from '../people/load';
import { parseRow, parseRows, type Parsed } from '../data/parse-rows';
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

/** A workspace_roster() row, as the people directory reads it (../people/load.ts). */
export const RosterRow = z.object({
  user_id: z.string(),
  name: z.string().nullable(),
  github_login: z.string().nullable(),
  avatar_url: z.string().nullable(),
  fleet: z.string().nullable(),
  hero: z.unknown().optional(),
});

/** A fleet, as the people directory reads it from `teams`. */
export const FleetLookRow = z.object({ name: z.string(), label: z.string(), color: z.string().nullable(), mascot: z.string().nullable() });
export const FLEET_COLUMNS = 'name, label, color, mascot';

/** What is_owner() answers. */
export const IsOwner = z.boolean();

type Read = () => PromiseLike<{ data: unknown; error: { message: string } | null }>;

/** A read the panel can do without: its answer, or `none` (logged) on an error, a throw or an answer
 * that does not parse. */
async function settled<T>(what: string, where: string, read: Read, parse: (data: unknown, where: string) => Parsed<T>, none: T): Promise<T> {
  try {
    const { data, error } = await read();
    if (error) throw new Error(error.message);
    const parsed = parse(data, where);
    return parsed.ok ? parsed.value : none;
  } catch (err) {
    console.error(`business: could not read ${what} (${err instanceof Error ? err.message : String(err)})`);
    return none;
  }
}

const rows = <T>(schema: z.ZodType<T>) => (data: unknown, where: string) => parseRows(schema, data, where);

/** The client, seen through the narrow port loadConstituents() calls. */
const constituentsDbOf = (db: Pick<SupabaseClient, 'from'>): ConstituentsDb => ({
  from: (table) => ({ select: (columns) => ({ in: (column, values) => db.from(table).select(columns).in(column, values) }) }),
});

export async function loadConstituentsPanel(db: SupabaseClient, workspace: string, products: readonly string[]): Promise<ConstituentsPanelData> {
  const [load, owner, roster, fleets] = await Promise.all([
    loadConstituents(constituentsDbOf(db), products),
    settled('your role', 'business/constituents-load: is_owner', () => db.rpc('is_owner', { workspace }), (data, where) => parseRow(IsOwner, data, where), false),
    settled('the workspace\'s members', 'business/constituents-load: workspace_roster', () => db.rpc('workspace_roster', { workspace }), rows(RosterRow), []),
    settled('the fleets', 'business/constituents-load: teams', () => db.from('teams').select(FLEET_COLUMNS).eq('workspace_id', workspace), rows(FleetLookRow), []),
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
  return { constituents: load.ok ? load.constituents : null, events, owner, people };
}
