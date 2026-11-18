import { limitWaitsOf } from '../limit-wait';
import type { LimitWaitRepository } from '../limit-wait.repository';
import { repairLinesOf } from '../repair';
import type { RepairRepository } from '../repair.repository';
import { dailyOf, missionOf, type BudgetRead, type MissionsView } from './missions-tab';
import type { MissionsTabRepository } from './missions-tab.repository';

// The Missions tab's rules (PRD 2842 s7; ADR-0095), over the repository as the signed-in person: a virtual
// fleet's missions with each one's progress, what it waits a person on and the move its status allows.

type Port = Pick<MissionsTabRepository, 'missions' | 'events' | 'owner' | 'dailyCap' | 'fleetSpent' | 'spent' | 'openStops'> & { waits: LimitWaitRepository['facts']; repairs: RepairRepository['facts'] };

export function missionsTabService(repository: Port) {
  return {
    /** The tab of `fleet` in `workspace`. */
    async view(workspace: string, fleet: string, now: Date = new Date()): Promise<MissionsView> {
      const rows = await repository.missions(workspace, fleet);
      const events = await repository.events(rows.map((row) => row.id));
      const waits = limitWaitsOf(await repository.waits(rows.map((row) => row.id)), now);
      const repairs = repairLinesOf(await repository.repairs(rows.map((row) => row.id)));
      const ids = rows.map((row) => row.id);
      const budget: BudgetRead = {
        owner: await repository.owner(workspace),
        dailyCap: await repository.dailyCap(workspace, fleet),
        fleetSpent: await repository.fleetSpent(workspace, fleet, now),
        spent: await repository.spent(ids),
        stops: await repository.openStops(workspace, fleet),
      };
      return { workspace, fleet, daily: dailyOf(budget), missions: rows.map((row) => missionOf(row, events.filter((event) => event.mission === row.id), waits, repairs, budget)) };
    },
  };
}
