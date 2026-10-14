// OMNI KART's register of circuits (PRD 1923): each circuit is an id, a name and its `TrackSource`, in driving-menu order.
// COMET RING is the only one for now; a circuit named by no id, or by none, is COMET RING.
import { COMET_RING, type TrackSource } from './track';

export interface Circuit { readonly id: string; readonly name: string; readonly source: TrackSource }

/** The circuits, in driving-menu order. */
const CIRCUITS: readonly Circuit[] = [{ id: 'comet-ring', name: 'COMET RING', source: COMET_RING }];

/** The circuit raced when none is named: COMET RING, as before the register. */
export const DEFAULT_CIRCUIT: Circuit = CIRCUITS[0] ?? { id: 'comet-ring', name: 'COMET RING', source: COMET_RING };

/** Whether `id` names a circuit of the register. */
export const isCircuitId = (id: unknown): id is string => CIRCUITS.some((c) => c.id === id);

/** The circuit `id` names; COMET RING when it names none. */
export const circuitOf = (id: unknown): Circuit => CIRCUITS.find((c) => c.id === id) ?? DEFAULT_CIRCUIT;
