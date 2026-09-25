import { describe, it, expect } from 'vitest';
import { PALETTE } from './palette.mjs';
import { SPRITES, FLEET_SPRITE, WOUND_TINT } from './sprites.mjs';
import { planetTexture } from './draw.mjs';
import { WOUND_KINDS } from '../../../game/events.mjs';

describe('sprites', () => {
  it.each(Object.entries(SPRITES))('%s is a rectangle drawn only from the palette', (name, rows) => {
    const width = rows[0].length;
    rows.forEach((row, y) => expect(row.length, `${name} row ${y}`).toBe(width));
    for (const ch of rows.join('')) expect(ch === '.' || ch in PALETTE, `${name}: '${ch}'`).toBe(true);
  });

  it('has a hero for every fleet and a tint for every wound kind', () => {
    for (const sprite of Object.values(FLEET_SPRITE)) expect(SPRITES[sprite]).toBeDefined();
    expect(Object.keys(WOUND_TINT).sort()).toEqual([...WOUND_KINDS].sort());
  });
});

describe('planetTexture', () => {
  it('is deterministic per seed and ramps the terraform order over [0, 1)', () => {
    const a = planetTexture(7), b = planetTexture(7);
    expect(a).toBe(b);
    const order = [...a.order];
    expect(Math.min(...order)).toBe(0);
    expect(Math.max(...order)).toBeLessThan(1);
    const half = order.filter((o) => o < 0.5).length / order.length;
    expect(half).toBeGreaterThan(0.4);
    expect(half).toBeLessThan(0.6);
  });
});
