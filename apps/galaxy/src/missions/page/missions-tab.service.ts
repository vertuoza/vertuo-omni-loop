import { limitWaitsOf } from '../limit-wait';
import type { LimitWaitRepository } from '../limit-wait.repository';
import { repairLinesOf } from '../repair';
import type { RepairRepository } from '../repair.repository';
import { boxOf, dailyOf, missionOf, WORDS, type BudgetRead, type MissionsView } from './missions-tab';
import type { MissionsTabRepository } from './missions-tab.repository';

// The Missions tab's rules (PRD 2842 s7; ADR-0095), over the repository as the signed-in person: a virtual
// fleet's missions with each one's progress, what it waits a person on and the move its status allows, and, since
// PRD 3065, its stuck state, its milestone retros and the questions of its own outbox.

type Port = Pick<MissionsTabRepository, 'missions' | 'events' | 'planDecisions' | 'owner' | 'dailyCap' | 'fleetSpent' | 'spent' | 'openStops' | 'retros' | 'items' | 'fleetLevel' | 'requests'> & { waits: LimitWaitRepository['facts']; repairs: RepairRepository['facts'] };

export function missionsTabService(repository: Port) {
  return {
    /** The tab of `fleet` in `workspace`. */
    async view(workspace: string, fleet: string, now: Date = new Date()): Promise<MissionsView> {
      const read = await repository.missions(workspace, fleet);
      const plans = await repository.planDecisions(read.map((row) => row.id));
      const rows = read.map((row) => ({ ...row, planDecisions: plans.get(row.id) ?? 0 }));
      const events = await repository.events(rows.map((row) => row.id));
      const waits = limitWaitsOf(await repository.waits(rows.map((row) => row.id)), now);
      const repairFacts = await repository.repairs(rows.map((row) => row.id));
      const repairs = repairLinesOf(repairFacts);
      const ids = rows.map((row) => row.id);
      const budget: BudgetRead = {
        owner: await repository.owner(workspace),
        dailyCap: await repository.dailyCap(workspace, fleet),
        fleetSpent: await repository.fleetSpent(workspace, fleet, now),
        spent: await repository.spent(ids),
        stops: await repository.openStops(workspace, fleet),
      };
      const retro = { repairs: repairFacts.rows, retros: await repository.retros(ids), items: await repository.items(ids) };
      const box = boxOf(await repository.fleetLevel(workspace, fleet), budget.owner);
      return { workspace, fleet, daily: dailyOf(budget), box, requests: (await repository.requests(workspace, fleet)).map((request) => ({ ...request, words: WORDS.writingMission })), missions: rows.map((row) => missionOf(row, events.filter((event) => event.mission === row.id), waits, repairs, budget, retro)) };
    },
  };
}
