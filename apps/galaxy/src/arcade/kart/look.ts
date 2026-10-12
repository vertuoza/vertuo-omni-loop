// OMNI KART's look (PRD 1762): the colour and the design of a kart. Pure: it names the tint and the
// sprite a look draws with, and reads a stored look leniently, so a bad field never breaks a race.
import { rampFrom, type Tint } from '@omni/design';

/** The kart's eight colours: FLEET is the fleet's own colour (today's kart), the others are fixed. */
export const COLORS: readonly { readonly name: string; readonly hex: string | null }[] = Object.freeze([
  { name: 'FLEET', hex: null },
  { name: 'RED', hex: '#e03a3a' },
  { name: 'ORANGE', hex: '#f08a24' },
  { name: 'YELLOW', hex: '#f2d230' },
  { name: 'GREEN', hex: '#3cc45a' },
  { name: 'CYAN', hex: '#2fc4d8' },
  { name: 'BLUE', hex: '#3a62e0' },
  { name: 'PINK', hex: '#ee6fb8' },
].map((c) => Object.freeze(c)));

/** The kart's three designs, CLASSIC being today's. */
export const DESIGNS: readonly string[] = Object.freeze(['CLASSIC', 'ROCKET', 'RACER']);

export type KartView = 'kart' | 'kart-left' | 'kart-right';
export interface KartLook { readonly color: string; readonly design: string }

export const DEFAULT_LOOK: KartLook = Object.freeze({ color: 'FLEET', design: 'CLASSIC' });

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** A stored look: an unknown colour reads as FLEET and an unknown design as CLASSIC, each alone; anything but an object is the default. */
export function readLook(raw: unknown): KartLook {
  const o: Record<string, unknown> = isRecord(raw) ? raw : {};
  const color = COLORS.find((c) => c.name === o.color)?.name ?? DEFAULT_LOOK.color;
  const design = DESIGNS.find((d) => d === o.design) ?? DEFAULT_LOOK.design;
  return Object.freeze({ color, design });
}

/** The tint a look draws with, over the tint the kart has without one (the fleet's): FLEET is that tint itself, a colour repaints the body. */
export function kartTint(look: KartLook, fleet: Tint): Tint {
  const hex = COLORS.find((c) => c.name === look.color)?.hex;
  return hex ? { ...fleet, W: rampFrom(hex) } : fleet;
}

/** The sprite a look draws for one of the three views: CLASSIC keeps today's names. */
export function kartSprite(look: KartLook, view: KartView): string {
  const design = readLook(look).design;
  return design === 'CLASSIC' ? view : `kart-${design.toLowerCase()}${view.slice('kart'.length)}`;
}
