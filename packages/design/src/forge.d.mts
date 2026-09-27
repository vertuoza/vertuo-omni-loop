export type Tint = Record<string, readonly string[]>;
/** One `#rrggbb` per flat colour to recolour (any other value keeps the default): `1` to `4` are the stripes on every hero's suit. */
export type Flat = Readonly<Record<string, string>>;
export interface Painter { w: number; h: number; [op: string]: unknown }

export const RAMPS: Readonly<Record<string, readonly string[]>>;
export const FLAT: Readonly<Record<string, string>>;
export function forge(w: number, h: number, draw: (d: Painter) => void, o?: { tint?: Tint; flat?: Flat; outline?: boolean }): { w: number; h: number; pixels: (string | null)[] };
