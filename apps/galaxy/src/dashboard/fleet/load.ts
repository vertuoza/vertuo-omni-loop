import type { FleetTag } from '../../people/types';
import { UNREADABLE, type Read } from '../part';
import { boardOf, readBoard, type BoardRead, type BoardReads, type BoardValue } from '../board/load';
import type { Period } from '../board/period';
import { rankFleets, type FleetRank } from '../rankings/rank';
import { chooseFleet } from './pick';

// /app/fleet's read (PRD 572): the board of one fleet, the viewer's by default or the one `?fleet`
// names, with scope *a fleet* for both its activity and its People table. The board's four reads start
// together, each on its own (settle); the roster (whose fleet the viewer is in) and the galaxy (the
// workspace's fleets, their look and their season places) decide which fleet is shown, then the
// board is drawn from all four. The picker lists every fleet of the season's ranking, the viewer's
// marked; it is unreadable with the galaxy.

/** A fleet as its board's heading shows it: its label, its colour, its mascot (PRD 652: its chip) and
 * its place this season. */
export interface FleetHead extends FleetTag {
  /** Its place in the season's fleet ranking; null for a fleet the season does not rank. */
  place: Read<{ rank: number; of: number } | null>;
}

export type FleetValue =
  | { kind: 'none' }
  | { kind: 'pick'; fleets: Read<FleetRank[]> }
  | { kind: 'board'; fleet: FleetHead; fleets: Read<FleetRank[]>; board: BoardValue };

export interface FleetRequest {
  /** `?fleet`, or null. */
  asked: string | null;
  viewerId: string | null;
  period: Period;
  now: Date;
}

/** Which fleet to show and its board, from what was read: pure, so the loader and the demo agree. */
export function fleetOf(read: BoardRead, request: FleetRequest): FleetValue {
  const mine = read.roster === UNREADABLE ? null : read.roster.find((m) => m.userId === request.viewerId)?.fleet ?? null;
  const fleets = read.galaxy === UNREADABLE ? UNREADABLE : rankFleets(read.galaxy.teams, mine);
  const choice = chooseFleet({ asked: request.asked, mine, fleets: fleets === UNREADABLE ? UNREADABLE : fleets.map((f) => f.name) });
  if (choice.kind === 'none') return { kind: 'none' };
  if (choice.kind === 'pick') return { kind: 'pick', fleets };
  const name = choice.fleet;
  const team = read.galaxy === UNREADABLE ? undefined : read.galaxy.teams.find((t) => t.name === name);
  const ranked = fleets === UNREADABLE ? UNREADABLE : fleets.find((f) => f.name === name);
  const scope = { kind: 'fleet', fleet: name } as const;
  return {
    kind: 'board',
    fleet: {
      name,
      label: team?.label ?? name.toUpperCase(),
      color: team?.color ?? null,
      mascot: team?.mascot ?? null,
      place: ranked === UNREADABLE || fleets === UNREADABLE ? UNREADABLE : ranked ? { rank: ranked.rank, of: fleets.length } : null,
    },
    fleets,
    board: boardOf(read, { scope, people: scope, viewerId: request.viewerId, period: request.period, now: request.now }),
  };
}

/** The fleet's board: the board's reads together, each on its own, then fleetOf. */
export async function loadFleet(reads: BoardReads, request: FleetRequest): Promise<FleetValue> {
  return fleetOf(await readBoard(reads, request), request);
}
