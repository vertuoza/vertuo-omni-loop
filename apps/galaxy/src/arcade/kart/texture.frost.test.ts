import { describe, expect, it } from 'vitest';
import { TOKENS } from '../theme';
import { sure } from '../test/sure';
import { FROST_SURFACE, pack, paintTrack, VOID } from './texture';
import { FROST_EIGHT, parseTrack, TILE } from './track';

// FROST EIGHT's ground (PRD 1923): powder, ice, asphalt, snow banks and red-and-white kerbs, and no void anywhere.
describe('FROST_SURFACE', () => {
  it('has no colour equal to a theme token (ADR-0046)', () => {
    const tokens = new Set(Object.values(TOKENS).map((c) => c.toLowerCase()));
    for (const [name, colour] of Object.entries(FROST_SURFACE)) expect(tokens.has(colour.toLowerCase()), name).toBe(false);
  });
});

describe('paintTrack on FROST EIGHT', () => {
  const track = parseTrack(FROST_EIGHT);
  const texture = paintTrack(track);
  const colours = new Set<number>(texture.px);
  const has = (hex: string) => colours.has(pack(hex));
  const pixel = (x: number, y: number) => sure(texture.px[Math.floor(y) * texture.w + Math.floor(x)], `pixel ${x},${y}`);

  it('is the size of the map and has no void pixel: nothing is see-through', () => {
    expect(texture.w).toBe(track.size.w);
    expect(texture.h).toBe(track.size.h);
    expect(texture.px.includes(VOID)).toBe(false);
  });

  it('draws powder, ice, asphalt, snow banks and red and white kerbs', () => {
    for (const hex of [FROST_SURFACE.powder, FROST_SURFACE.ice, FROST_SURFACE.bank, FROST_SURFACE.bankShade, FROST_SURFACE.kerbRed, FROST_SURFACE.kerbWhite]) expect(has(hex), hex).toBe(true);
  });

  it('paints powder far from the road, the lake in ice, and the road in asphalt tones', () => {
    const powder = new Set([FROST_SURFACE.powder, FROST_SURFACE.powderShade, FROST_SURFACE.powderLight].map(pack));
    const ice = new Set([FROST_SURFACE.ice, FROST_SURFACE.iceDeep, FROST_SURFACE.iceCrack].map(pack));
    expect(powder.has(pixel(5.5 * TILE, 40.5 * TILE))).toBe(true);
    expect(ice.has(pixel(36 * TILE, 36 * TILE))).toBe(true);
    expect(ice.has(pixel(33 * TILE, 33 * TILE))).toBe(true);
    // The two frozen patches (PRD 1963), on the middle of bend 4's and bend 8's curves.
    expect(ice.has(pixel(16.5 * TILE, 8.5 * TILE))).toBe(true);
    expect(ice.has(pixel(16.5 * TILE, 64.5 * TILE))).toBe(true);
    // The start straight, off the line, is not powder and not ice.
    const road = pixel(40.5 * TILE, 64.5 * TILE);
    expect(powder.has(road) || ice.has(road)).toBe(false);
  });

  it('banks the snow against the road\'s edge, white next to the road', () => {
    // The start straight is 5 tiles wide, centred on row 64.5: its edge is 2.5 tiles off.
    const edge = 64.5 * TILE + 2.5 * TILE;
    expect(pixel(40.5 * TILE, edge + 0.5)).toBe(pack(FROST_SURFACE.bank));
  });

  it('leaves COMET RING\'s ground without a single frost colour', () => {
    const comet = new Set<number>(paintTrack(parseTrack()).px);
    for (const hex of Object.values(FROST_SURFACE)) expect(comet.has(pack(hex)), hex).toBe(false);
  });
});
