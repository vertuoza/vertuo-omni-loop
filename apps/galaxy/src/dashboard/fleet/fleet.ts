import 'server-only';
import { messageOf } from 'omni-loop/kit/lib/narrow.ts';
import type { GalaxyView } from '@omni/galaxy';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Database } from '../../../../../supabase/database.types.ts';
import { demoGalaxy, loadGalaxy } from '../../data/load-galaxy';
import { memberWorkspace, type Workspace } from '../../data/workspace';
import { once, UNREADABLE } from '../part';
import { demoActivity, demoAnswered, demoPrds, demoRoster, DEMO_VIEWER } from '../board/demo';
import { supabaseReads } from '../board/load';
import type { Period } from '../board/period';
import { MASCOTS } from '@omni/design';
import { virtualFleetsServiceAs } from '../../virtual-fleets/virtual-fleets.live';
import { fleetOf, loadFleet, type FleetValue } from './load';

// /app/fleet's read (PRD 572), as the signed-in person, in the workspace they joined first, as /app
// and /app/workspace read theirs. With the workspace itself out of reach, nobody is turned away: the
// fleet asked for (or the picker) says for each part that it could not load.

// PRD 2842 s1: the Fleet section also makes Virtual Fleets. Its read carries what the New virtual fleet
// button needs (the workspace it makes the fleet in, null in the demo, and the fleet mascots) and the keys
// of the workspace's virtual fleets, whose chips it marks. A failed read of those keys marks none.

/** What the New virtual fleet button needs, and which fleets are virtual. */
export interface VirtualOf {
  workspace: string | null;
  mascots: readonly string[];
  names: readonly string[];
}

export type FleetBoard = { kind: 'no-workspace' } | (FleetValue & { virtual?: VirtualOf });

/** The keys of the workspace's virtual fleets, or none when they cannot be read. */
async function virtualNames(db: SupabaseClient<Database>, workspace: string): Promise<string[]> {
  try {
    return await virtualFleetsServiceAs(db).names(workspace);
  } catch (error) {
    console.error(`fleet: the virtual fleets could not be read (${messageOf(error)})`);
    return [];
  }
}

export async function loadFleetBoard(db: SupabaseClient<Database>, user: Pick<User, 'id'>, asked: string | null, period: Period, now: Date): Promise<FleetBoard> {
  const request = { asked, viewerId: user.id, period, now };
  let workspace: Workspace | null;
  try {
    workspace = await memberWorkspace(db, user.id);
  } catch (error) {
    console.error(`dashboard: your workspace could not be read (${messageOf(error)})`);
    return fleetOf({ roster: UNREADABLE, activity: UNREADABLE, answered: UNREADABLE, galaxy: UNREADABLE }, request);
  }
  if (!workspace) return { kind: 'no-workspace' };
  const id = workspace.id;
  const [value, names] = await Promise.all([loadFleet(supabaseReads(db, id, once(() => loadGalaxy(db, id, now))), request), virtualNames(db, id)]);
  return { ...value, virtual: { workspace: id, mascots: MASCOTS, names } };
}

/** The demo's Fleet: the demo world's, seen by the demo's *you*, who plays solo. */
export function demoFleetBoard(asked: string | null, period: Period, now: Date, galaxy: GalaxyView = demoGalaxy(now)): FleetBoard {
  const roster = demoRoster(galaxy);
  const value = fleetOf(
    { roster, activity: demoActivity(roster, now), answered: demoAnswered(roster), galaxy, prds: demoPrds(roster) },
    { asked, viewerId: DEMO_VIEWER.userId, period, now },
  );
  return { ...value, virtual: { workspace: null, mascots: MASCOTS, names: [] } };
}
