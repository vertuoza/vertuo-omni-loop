import { missionOf, type MissionsView } from './missions-tab';
import type { MissionsTabRepository } from './missions-tab.repository';

// The Missions tab's rules (PRD 2842 s7; ADR-0095), over the repository as the signed-in person: a virtual
// fleet's missions with each one's progress, what it waits a person on and the move its status allows.

type Port = Pick<MissionsTabRepository, 'missions' | 'events'>;

export function missionsTabService(repository: Port) {
  return {
    /** The tab of `fleet` in `workspace`. */
    async view(workspace: string, fleet: string): Promise<MissionsView> {
      const rows = await repository.missions(workspace, fleet);
      const events = await repository.events(rows.map((row) => row.id));
      return { workspace, fleet, missions: rows.map((row) => missionOf(row, events.filter((event) => event.mission === row.id))) };
    },
  };
}
