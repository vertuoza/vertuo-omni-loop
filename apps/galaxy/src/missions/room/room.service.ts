import { bugLinesOf, cleanUpLine, filterOf, ledgerOf, nowLines, type RoomView } from './room';
import { limitWaitsOf } from '../limit-wait';
import { repairLinesOf } from '../repair';
import type { RepairRepository } from '../repair.repository';
import type { LimitWaitRepository } from '../limit-wait.repository';
import type { RoomRepository } from './room.repository';
import { withTokens } from './qa';

// The Operation room's rules over the repository (PRD 2842 s8; ADR-0095): the heroes' now lines, the clean-up
// line and the ledger of an AI fleet's missions, as the signed-in person reads them.

type Port = Pick<RoomRepository, 'heroes' | 'missions' | 'events' | 'kept' | 'tokens' | 'qaJobs'> & { waits: LimitWaitRepository['facts']; repairs: RepairRepository['facts'] };

export function roomService(repository: Port) {
  return {
    /** The room of `fleet` in `workspace`, filtered as the address asks. */
    async view(workspace: string, fleet: string, color: string | null, query: Record<string, string | string[] | undefined>, now: Date): Promise<RoomView> {
      const [heroes, missions, kept] = await Promise.all([repository.heroes(workspace, fleet), repository.missions(workspace, fleet), repository.kept(workspace, now)]);
      const read = await repository.events(missions.map((m) => m.id));
      const events = withTokens(read, await repository.tokens(read.flatMap((e) => (e.job === null ? [] : [e.job]))));
      const qa = await repository.qaJobs(missions.map((m) => m.id));
      const waits = limitWaitsOf(await repository.waits(missions.map((m) => m.id)), now);
      const repairs = repairLinesOf(await repository.repairs(missions.map((m) => m.id)));
      const filter = filterOf(query, missions.map((m) => m.id));
      return { fleet, color, now: nowLines(heroes, events, waits, repairs, qa), cleanUp: cleanUpLine(kept), bugs: bugLinesOf(events), stopped: repairs.filter((line) => line.kind === 'stopped'), ledger: ledgerOf(events, filter), missions, filter, empty: events.length === 0 };
    },
  };
}
