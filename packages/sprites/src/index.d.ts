type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
export type Tint = Record<string, string>;
export type WoundKind = 'transmission' | 'unconfirmed-ground' | 'beacon' | 'fault-line' | 'under-fire' | 'aftershock';

export const PALETTE: Readonly<Record<string, string>>;
export const INK: Readonly<Record<string, string>>;
export const SPRITES: Readonly<Record<string, readonly string[]>>;
export const FLEET_SPRITE: Readonly<Record<string, string>>;
export const WOUND_TINT: Readonly<Record<WoundKind, { P: string; p: string }>>;
export const SURFACES: Readonly<Record<string, readonly string[]>>;

export function spriteImage(name: string, o?: { tint?: Tint | null; flip?: boolean }): CanvasImageSource & { width: number; height: number };
export function drawSprite(ctx: Ctx, name: string, x: number, y: number, o?: { scale?: number; tint?: Tint; flip?: boolean; alpha?: number }): void;
export function spriteSize(name: string): { w: number; h: number };
export function rng(seed: number): () => number;
export function planetTexture(seed: number): { height: Float32Array; order: Float32Array };
export function drawPlanet(ctx: Ctx, o: {
  cx: number; cy: number; r: number; seed: number; rot?: number; progress?: number;
  mood?: 'alive' | 'lost' | 'locked' | 'ghost'; atmosphere?: string | null; ring?: readonly string[] | null;
}): void;
export interface Star { x: number; y: number; layer: number; phase: number }
export function makeStarfield(seed: number, w: number, h: number, count?: number): Star[];
export function drawStarfield(ctx: Ctx, stars: Star[], t: number, o?: { w: number; h: number; speed?: number }): void;
export function makeNebula(seed: number, w: number, h: number, colors: readonly string[], density?: number): CanvasImageSource;
