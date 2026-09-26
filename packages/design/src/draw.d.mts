import type { Flat, Tint } from './forge.mjs';

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export const SURFACES: Readonly<Record<string, readonly string[]>>;

export function spritePixels(name: string, o?: { frame?: number; tint?: Tint | null; flat?: Flat | null }): { w: number; h: number; pixels: (string | null)[] };
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
