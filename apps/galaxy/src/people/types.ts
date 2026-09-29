import type { Face } from './face';

// A person and a fleet as every screen shows them (PRD 652): a Person is a name and a decided face; a
// FleetTag is a fleet's label, its colour and its mascot.

/** A fleet as a chip names it: its label, in its colour (null when not known), and its mascot. */
export interface FleetTag { name: string; label: string; color: string | null; mascot: string | null }

/** A player with no fleet (PRD 400). */
export const SOLO = 'solo';

export interface Person {
  name: string;
  face: Face;
  /** Their fleet: a FleetTag, SOLO, or null when not known (no player row, or outside the workspace). */
  fleet?: FleetTag | typeof SOLO | null;
}
