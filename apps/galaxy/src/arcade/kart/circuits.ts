// OMNI KART's register of circuits (PRD 1923): each circuit is an id, a name, its `TrackSource` and the crew board its times go to, in driving-menu order.
// COMET RING, then FROST EIGHT; a circuit named by no id, or by none, is COMET RING.
import { COMET_RING, FROST_EIGHT, type TrackSource } from './track';

export interface Circuit {
  readonly id: string;
  readonly name: string;
  readonly source: TrackSource;
  /** The id of the crew board its times go to: one of the boards the registry names for OMNI KART (`games/index.ts`). */
  readonly board: string;
}

/** The circuits, in driving-menu order. */
export const CIRCUITS: readonly Circuit[] = [
  { id: 'comet-ring', name: 'COMET RING', source: COMET_RING, board: 'kart' },
  { id: 'frost-eight', name: 'FROST EIGHT', source: FROST_EIGHT, board: 'kart-frost-eight' },
];

/** The circuit raced when none is named: COMET RING, as before the register. */
export const DEFAULT_CIRCUIT: Circuit = CIRCUITS[0] ?? { id: 'comet-ring', name: 'COMET RING', source: COMET_RING, board: 'kart' };

/** Whether `id` names a circuit of the register. */
export const isCircuitId = (id: unknown): id is string => CIRCUITS.some((c) => c.id === id);

/** The circuit `id` names; COMET RING when it names none. */
export const circuitOf = (id: unknown): Circuit => CIRCUITS.find((c) => c.id === id) ?? DEFAULT_CIRCUIT;
