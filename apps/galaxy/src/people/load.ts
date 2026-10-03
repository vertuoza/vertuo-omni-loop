import { messageOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from '../../../../supabase/database.types.ts';
import { faceOf } from './face';
import { SOLO, type FleetTag, type Person } from './types';

// The people directory (PRD 652): one per page, read once as the signed-in person. It reads
// workspace_roster (every member's name, login, avatar, fleet and hero) and the workspace's fleets
// (their label, colour and mascot), then resolves anyone a screen names: by account id (ask, dossier,
// bell) or by GitHub login, ignoring case (engineering, outbox replies, fix timelines). The name a
// screen prints stays its own; the directory adds the face and the fleet. A login no member holds
// still gets its public GitHub photo; an unknown account, its initial. A read that fails is logged and
// every lookup falls back so: a failed faces read never turns a screen into "could not load".

/** A member, as workspace_roster returns them. */
const RosterRowSchema = z.object({
  user_id: z.string(),
  name: z.string().nullable(),
  github_login: z.string().nullable(),
  avatar_url: z.string().nullable(),
  fleet: z.string().nullable(),
  hero: z.unknown().optional(),
});
export type RosterRow = z.infer<typeof RosterRowSchema>;

/** A fleet, as the directory reads it from `teams`. */
const FleetLookRowSchema = z.object({ name: z.string(), label: z.string(), color: z.string().nullable(), mascot: z.string().nullable() });
export type FleetLookRow = z.infer<typeof FleetLookRowSchema>;

export interface People {
  /** The member with this account id; `name` is what the screen prints. */
  byId(userId: string, name: string): Person;
  /** The member with this GitHub login, ignoring case; `name` defaults to the login. */
  byLogin(login: string, name?: string): Person;
}

const fleetOf = (row: RosterRow, fleets: ReadonlyMap<string, FleetTag>): Person['fleet'] =>
  (!row.fleet ? SOLO : fleets.get(row.fleet) ?? { name: row.fleet, label: row.fleet.toUpperCase(), color: null, mascot: null });

/** The directory, from rows already read: pure. */
export function peopleOf(roster: readonly RosterRow[], fleetRows: readonly FleetLookRow[]): People {
  const fleets = new Map(fleetRows.map((f): [string, FleetTag] => [f.name, { name: f.name, label: f.label, color: f.color ?? null, mascot: f.mascot ?? null }]));
  const ids = new Map(roster.map((r) => [r.user_id, r]));
  const logins = new Map(roster.flatMap((r) => (r.github_login ? [[r.github_login.toLowerCase(), r] as const] : [])));
  const of = (row: RosterRow | undefined, name: string, login: string | null): Person => {
    if (!row) return { name, face: faceOf({ name, login }), fleet: null };
    const fleet = fleetOf(row, fleets);
    const color = fleet && fleet !== SOLO ? fleet.color : null;
    const face = faceOf({ name, login: row.github_login ?? login, avatarUrl: row.avatar_url, hero: row.hero, color });
    // PRD 698: a member with a login carries it, in lower case, so their chip links to their profile.
    return row.github_login ? { name, face, fleet, login: row.github_login.toLowerCase() } : { name, face, fleet };
  };
  return {
    byId: (userId, name) => of(ids.get(userId), name, null),
    byLogin: (login, name = login) => of(logins.get(login.toLowerCase()), name, login),
  };
}

async function settled<T>(what: string, row: z.ZodType<T>, read: () => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
  try {
    const { data, error } = await read();
    if (error) throw new Error(error.message);
    return z.array(row).parse(data ?? []);
  } catch (err) {
    console.error(`people: ${what} could not be read (${messageOf(err)})`);
    return [];
  }
}

/** The directory of one workspace: its roster and its fleets, read in parallel, each on its own. */
export async function loadPeople(db: Pick<SupabaseClient<Database>, 'from' | 'rpc'>, workspace: string): Promise<People> {
  const [roster, fleets] = await Promise.all([
    settled('the workspace\'s members', RosterRowSchema, () => db.rpc('workspace_roster', { workspace })),
    settled('the fleets', FleetLookRowSchema, () => db.from('teams').select('name, label, color, mascot').eq('workspace_id', workspace)),
  ]);
  return peopleOf(roster, fleets);
}
