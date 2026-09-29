import type { SupabaseClient } from '@supabase/supabase-js';
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
export interface RosterRow {
  user_id: string;
  name: string | null;
  github_login: string | null;
  avatar_url: string | null;
  fleet: string | null;
  hero?: unknown;
}

/** A fleet, as the directory reads it from `teams`. */
export interface FleetLookRow { name: string; label: string; color: string | null; mascot: string | null }

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
    return { name, face: faceOf({ name, login: row.github_login ?? login, avatarUrl: row.avatar_url, hero: row.hero, color }), fleet };
  };
  return {
    byId: (userId, name) => of(ids.get(userId), name, null),
    byLogin: (login, name = login) => of(logins.get(login.toLowerCase()), name, login),
  };
}

async function settled<T>(what: string, read: () => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
  try {
    const { data, error } = await read();
    if (error) throw new Error(error.message);
    return (data ?? []) as T[];
  } catch (err) {
    console.error(`people: ${what} could not be read (${(err as Error).message})`);
    return [];
  }
}

/** The directory of one workspace: its roster and its fleets, read in parallel, each on its own. */
export async function loadPeople(db: SupabaseClient, workspace: string): Promise<People> {
  const [roster, fleets] = await Promise.all([
    settled<RosterRow>('the workspace\'s members', () => db.rpc('workspace_roster', { workspace })),
    settled<FleetLookRow>('the fleets', () => db.from('teams').select('name, label, color, mascot').eq('workspace_id', workspace)),
  ]);
  return peopleOf(roster, fleets);
}
