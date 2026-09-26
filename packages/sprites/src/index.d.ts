type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
export type Tint = Record<string, readonly string[]>;
/** One `#rrggbb` per flat colour to recolour (any other value keeps the default): `1` to `4` are the stripes on every hero's suit. */
export type Flat = Readonly<Record<string, string>>;
export type WoundKind = 'transmission' | 'unconfirmed-ground' | 'beacon' | 'fault-line' | 'under-fire' | 'aftershock';

export const PALETTE: Readonly<Record<string, string>>;
export const INK: Readonly<Record<string, string>>;
export const RAMPS: Readonly<Record<string, readonly string[]>>;
export const FLAT: Readonly<Record<string, string>>;
export interface Painter { w: number; h: number; [op: string]: unknown }
export const SPRITE_DEFS: Readonly<Record<string, { w: number; h: number; draw(d: Painter, f: number): void; outline?: boolean }>>;
export function forge(w: number, h: number, draw: (d: Painter) => void, o?: { tint?: Tint; flat?: Flat; outline?: boolean }): { w: number; h: number; pixels: (string | null)[] };
export function spritePixels(name: string, o?: { frame?: number; tint?: Tint | null; flat?: Flat | null }): { w: number; h: number; pixels: (string | null)[] };
export function woundTint(kind: WoundKind): Tint;
export const FLEET_SPRITE: Readonly<Record<string, string>>;
export const WOUND_TINT: Readonly<Record<WoundKind, { p: string; ramp: readonly string[] }>>;
export const SURFACES: Readonly<Record<string, readonly string[]>>;

export function spriteImage(name: string, o?: { tint?: Tint | null; flat?: Flat | null; flip?: boolean; frame?: number; silhouette?: string | null }): CanvasImageSource & { width: number; height: number };
export function drawSprite(ctx: Ctx, name: string, x: number, y: number, o?: { scale?: number; tint?: Tint; flat?: Flat | null; flip?: boolean; alpha?: number; frame?: number; glow?: string | null }): void;
export function spriteSize(name: string): { w: number; h: number };
export function rng(seed: number): () => number;
export function planetTexture(seed: number): { height: Float32Array; order: Float32Array };
export function drawPlanet(ctx: Ctx, o: {
  cx: number; cy: number; r: number; seed: number; rot?: number; progress?: number;
  mood?: 'alive' | 'lost' | 'locked' | 'ghost'; atmosphere?: string | null; ring?: readonly string[] | null;
}): void;
/** A sun's frames: its surface boils and its corona flickers through them, four a second. */
export const SUN_FRAMES: number;
/** The side of the square a sun of radius `r` is drawn in: its disc and its corona. */
export function sunSize(r: number): number;
/** One frame of a sun, as a square of colours (`null` is empty space); the same for the same radius, seed and frame. */
export function sunPixels(r: number, seed: number, frame?: number): { size: number; pixels: (string | null)[] };
/** Draws a sun of radius `r` centred on (`cx`, `cy`), within a square of side `sunSize(r)`, at the frame the clock `t` (seconds) is on. */
export function drawSun(ctx: Ctx, o: { cx: number; cy: number; r: number; seed: number; t?: number }): void;
export interface Star { x: number; y: number; layer: number; phase: number }
export function makeStarfield(seed: number, w: number, h: number, count?: number): Star[];
export function drawStarfield(ctx: Ctx, stars: Star[], t: number, o?: { w: number; h: number; speed?: number }): void;
export function makeNebula(seed: number, w: number, h: number, colors: readonly string[], density?: number): CanvasImageSource;

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
