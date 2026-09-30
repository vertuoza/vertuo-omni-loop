export type PersonaTrade =
  | 'builder' | 'plumber' | 'heating' | 'electrician' | 'carpenter' | 'roofer' | 'painter' | 'foreman'
  | 'office' | 'accountant' | 'doctor' | 'nurse' | 'shopkeeper' | 'driver' | 'developer';

/** A stored persona avatar: preset numbers into its trade's sprite variations. */
export interface PersonaAvatar { v: 1; skin: number; hair: number; hairColor: number; outfit: number; accessory: number }

interface Range { readonly min: number; readonly max: number }

/** The generic trade list, the same for every workspace. */
export const PERSONA_TRADES: readonly { readonly id: PersonaTrade; readonly label: string }[];
/** The stored avatar's ranges, inclusive; the database's valid_persona_avatar() checks the same. */
export const PERSONA_AVATAR_RANGES: {
  readonly v: 1; readonly skin: Range; readonly hair: Range; readonly hairColor: Range; readonly outfit: Range; readonly accessory: Range;
};
/** How many avatars one trade can draw. */
export const PERSONA_VARIATIONS: number;
export const PERSONA_PRESETS: {
  readonly skin: readonly string[];
  readonly hair: readonly string[];
  readonly hairColor: readonly string[];
  readonly accessory: readonly ['none', 'cap', 'glasses', 'helmet'];
  readonly outfit: Readonly<Record<PersonaTrade, readonly string[]>>;
};
export function validPersonaAvatar(avatar: unknown): avatar is PersonaAvatar;
/** A 32×32 portrait, row by row (`null` is empty); the same trade and avatar always give the same grid. Throws on an unknown trade or an avatar out of range. */
export function personaGrid(trade: string, avatar: PersonaAvatar): { w: number; h: number; pixels: (string | null)[] };
/** One avatar picked by a seed: the same seed always gives the same avatar. */
export function randomAvatar(seed: number | string): PersonaAvatar;
/** A page of `count` (24) distinct avatars in an order the seed shuffles; each next page shows others. */
export function personaVariations(seed: number | string, page?: number, count?: number): PersonaAvatar[];
