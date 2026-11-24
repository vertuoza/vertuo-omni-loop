import 'server-only';
import { messageOf } from 'omni-loop/kit/lib/narrow.ts';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Database } from '../../../../../supabase/database.types.ts';
import { loadMissionsTab } from '../../missions/page/missions-tab.live';
import { runnersPageReads } from '../../runners/page/live';
import { loadRunnersPage } from '../../runners/page/load';
import type { Board } from '../../runners/runners.contract';
import type { ListFleetRead } from '../list/list';
import { fleetRunnersView } from './runners-view';
import { fleetHeadOf, runnersTabOf, type FleetHead, type RunnersTab } from './runners-tab';

// An AI fleet's runners read (PRD 3233 s4), as the person `db` acts for: the Runners board (members only, read once), the fleet's
// missions, and the view built from them. A board that cannot be read is the block's one notice; missions that cannot be read leave
// the view with none.

export type FleetRunnersRead =
  | { kind: 'unreadable' }
  | { kind: 'ok'; head: FleetHead; tab: RunnersTab; board: Board };

export async function loadFleetRunners(db: SupabaseClient<Database>, user: Pick<User, 'id'>, workspace: string, fleet: { name: string; label: string }, now: Date): Promise<FleetRunnersRead> {
  const reads = runnersPageReads(db, user);
  if (!reads) return { kind: 'unreadable' };
  const [page, missions] = await Promise.all([
    loadRunnersPage(reads, now),
    loadMissionsTab(db, workspace, fleet.name).then((tab) => tab.missions, (error: unknown): ListFleetRead['missions'] => {
      console.error(`ai-fleet: the missions of ${fleet.name} could not be read (${messageOf(error)})`);
      return [];
    }),
  ]);
  if (page.kind !== 'board') return { kind: 'unreadable' };
  const fleets = page.fleets.some((f) => f.name === fleet.name) ? page.fleets : [...page.fleets, fleet];
  const view = fleetRunnersView(page.board, fleet, missions.map((mission) => mission.id), now, page.prds, fleets);
  return { kind: 'ok', head: fleetHeadOf(view, missions), tab: runnersTabOf(view, page.board), board: page.board };
}
