import { cleanUpLine, filterOf, ledgerOf, nowLines, type RoomView } from './room';
import { limitWaitsOf } from '../limit-wait';
import type { RoomRepository } from './room.repository';

// The Operation room's rules over the repository (PRD 2842 s8; ADR-0095): the heroes' now lines, the clean-up
// line and the ledger of a virtual fleet's missions, as the signed-in person reads them.

type Port = Pick<RoomRepository, 'heroes' | 'missions' | 'events' | 'kept' | 'waits'>;

export function roomService(repository: Port) {
  return {
    /** The room of `fleet` in `workspace`, filtered as the address asks. */
    async view(workspace: string, fleet: string, color: string | null, query: Record<string, string | string[] | undefined>, now: Date): Promise<RoomView> {
      const [heroes, missions, kept] = await Promise.all([repository.heroes(workspace, fleet), repository.missions(workspace, fleet), repository.kept(workspace, now)]);
      const events = await repository.events(missions.map((m) => m.id));
      const waits = limitWaitsOf(await repository.waits(missions.map((m) => m.id)), now);
      const filter = filterOf(query, missions.map((m) => m.id));
      return { fleet, color, now: nowLines(heroes, events, waits), cleanUp: cleanUpLine(kept), ledger: ledgerOf(events, filter), missions, filter, empty: events.length === 0 };
    },
  };
}
