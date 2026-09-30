import type { Painter, Tint } from './forge.mjs';

export type WoundKind = 'transmission' | 'unconfirmed-ground' | 'beacon' | 'fault-line' | 'under-fire' | 'aftershock';

export const SPRITE_DEFS: Readonly<Record<string, { w: number; h: number; draw(d: Painter, f: number): void; outline?: boolean }>>;
export const MASCOTS: readonly string[];
export const WOUND_TINT: Readonly<Record<WoundKind, { p: string; ramp: readonly string[] }>>;
export function woundTint(kind: WoundKind): Tint;
/** Super Omni World's tiles, in the order its tileset lays them out (PRD 817). */
export const TILES: readonly string[];
/** Each stage's palette, as a tint over the tiles' materials; grass is the tiles as drawn. */
export const STAGE_PALETTES: Readonly<Record<string, Tint>>;
