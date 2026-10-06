import type { FleetRow } from '../../arcade/types';

// HOME's own example fleets (PRD 971, s4): invented for the page, with names of their own — never
// the demo galaxy's, never a workspace's. Each flies a mascot the sprite library holds, so every
// trading card has a face, and carries example points for the leaderboard. Nothing here is read
// from a database: HOME stays static.

/** An example fleet: a fleet's row as the cards read it, plus its example points. */
export interface ExampleFleet extends FleetRow {
  points: number;
}

const fleet = (name: string, label: string, mascot: string, color: string, motto: string, points: number, sort: number): ExampleFleet => ({
  name, home: null, label, color, motto, mascot, sort, retired: false, points,
});

/** The five example fleets, in the order their cards are dealt (not the leaderboard's). */
export const EXAMPLE_FLEETS: readonly ExampleFleet[] = [
  fleet('dam-busters', 'DAM BUSTERS', 'beaver', '#c9824a', 'Every zone gets a wall.', 1240, 10),
  fleet('deep-divers', 'DEEP DIVERS', 'octopod', '#a070f0', 'All arms on every open question.', 980, 20),
  fleet('gold-diggers', 'GOLD DIGGERS', 'picsou', '#f5c842', 'Pays out in shipped features.', 1415, 30),
  fleet('spy-ring', 'SPY RING', 'cia', '#8f9ac0', 'Finds the bug before the customer does.', 760, 40),
  fleet('sea-dogs', 'SEA DOGS', 'pirate', '#35b89a', 'Boards the work nobody holds.', 1105, 50),
];
