import { UNREADABLE, type Read } from '../part';

// Which fleet /app/fleet shows (PRD 572), decided once from the query's `?fleet=<name>`, the viewer's
// own fleet and the workspace's fleets (the season's, as the fleet ranking lists them):
//
// | the workspace's fleets | ?fleet                  | the viewer's fleet | the page shows                       |
// |------------------------|-------------------------|--------------------|--------------------------------------|
// | none                   | any                     | any                | *This workspace has no fleet yet*    |
// | some, or unreadable    | a fleet of them         | any                | that fleet's board                   |
// | some                   | a name that is not one  | any                | the picker, *Pick a fleet…*          |
// | some, or unreadable    | none                    | one                | the viewer's fleet's board           |
// | some, or unreadable    | none                    | none               | the picker, *Pick a fleet…*          |
//
// With the fleets unreadable, a named fleet is taken at its word: its board then says for itself what
// it could not load.

export type FleetChoice =
  | { kind: 'none' }
  | { kind: 'pick' }
  | { kind: 'fleet'; fleet: string };

export interface ChoiceInput {
  /** `?fleet`, as the query holds it; null when absent or empty. */
  asked: string | null;
  /** The viewer's fleet (`players.team`); null for a solo player, a member with no player row, or an unreadable roster. */
  mine: string | null;
  /** The names of the workspace's fleets. */
  fleets: Read<readonly string[]>;
}

export function chooseFleet({ asked, mine, fleets }: ChoiceInput): FleetChoice {
  if (fleets !== UNREADABLE && fleets.length === 0) return { kind: 'none' };
  if (asked) return fleets === UNREADABLE || fleets.includes(asked) ? { kind: 'fleet', fleet: asked } : { kind: 'pick' };
  return mine ? { kind: 'fleet', fleet: mine } : { kind: 'pick' };
}
