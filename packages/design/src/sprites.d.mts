import type { Painter, Tint } from './forge.mjs';

export type WoundKind = 'transmission' | 'unconfirmed-ground' | 'beacon' | 'fault-line' | 'under-fire' | 'aftershock';

export const SPRITE_DEFS: Readonly<Record<string, { w: number; h: number; draw(d: Painter, f: number): void; outline?: boolean }>>;
export const MASCOTS: readonly string[];
export const WOUND_TINT: Readonly<Record<WoundKind, { p: string; ramp: readonly string[] }>>;
export function woundTint(kind: WoundKind): Tint;
