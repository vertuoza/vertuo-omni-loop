import type { Tint } from './forge.mjs';

export interface Hero { v: 1; body: 'girl' | 'boy'; skin: number; hair: number; suit: number; cape: number }
export const HERO_PRESETS: {
  readonly body: readonly (readonly ['girl' | 'boy', string])[];
  readonly skin: readonly string[];
  readonly hair: readonly (readonly [string, string | null])[];
  readonly suit: readonly (readonly [string, string | null, string | null])[];
  readonly cape: readonly (readonly [string, string | null])[];
};
export function rampFrom(hex: string): readonly string[];
export function heroLook(hero: Hero, fleetColor?: string): { sprite: string; tint: Tint };
export function validHero(hero: unknown): hero is Hero;
export function randomHero(rand?: () => number, o?: { suit?: number }): Hero;
export function fleetSprite(mascot: string | null | undefined, color: string | null | undefined): { sprite: string; tint: Tint | null };
