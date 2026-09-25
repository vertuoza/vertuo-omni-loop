import { describe, it, expect } from 'vitest';
import { FLAT, RAMPS, forge } from './forge.mjs';
import { SPRITE_DEFS, FLEET_SPRITE, WOUND_TINT, woundTint } from './sprites.mjs';
import { planetTexture, spritePixels } from './draw.mjs';
import { WOUND_KINDS } from '../../../game/events.mjs';

const KNOWN = new Set([...Object.values(RAMPS).flat(), ...Object.values(FLAT), '#0b0a26']);

describe('forge', () => {
  it('lights a shape from the top left: several tones of one material, darkest bottom right', () => {
    const { w, pixels } = forge(20, 20, (d) => d.ellipse(10, 10, 8, 8, 'W'));
    const tones = new Set(pixels.filter((p) => RAMPS.W.includes(p)));
    expect(tones.size).toBeGreaterThanOrEqual(3);
    expect(RAMPS.W.indexOf(pixels[5 * w + 6])).toBeLessThan(RAMPS.W.indexOf(pixels[14 * w + 14]));
  });

  it('outlines the silhouette: its own dark tone on the lit side, near-black on the shadow side', () => {
    const { w, pixels } = forge(12, 12, (d) => d.rect(3, 3, 6, 6, 'N'));
    expect(pixels[3 * w + 2]).toBe(RAMPS.N[3]);
    expect(pixels[3 * w + 9]).toBe('#0b0a26');
    expect(pixels[0]).toBeNull();
  });

  it('recolours a material through a tint, and keeps flat colours flat', () => {
    const { pixels } = forge(8, 8, (d) => d.rect(2, 2, 4, 4, 'Z').px(3, 3, 'Q'), { tint: { Z: WOUND_TINT.beacon.ramp } });
    expect(pixels.some((p) => WOUND_TINT.beacon.ramp.includes(p))).toBe(true);
    expect(pixels.some((p) => RAMPS.Z.includes(p))).toBe(false);
    expect(pixels[3 * 8 + 3]).toBe('#ffffff');
  });
});

describe('sprites', () => {
  it.each(Object.keys(SPRITE_DEFS))('%s forges both frames from known colours only', (name) => {
    for (const frame of [0, 1]) {
      const { w, h, pixels } = spritePixels(name, { frame });
      expect(pixels).toHaveLength(w * h);
      const drawn = pixels.filter(Boolean);
      expect(drawn.length).toBeGreaterThan(w * h * 0.08);
      for (const p of drawn) expect(KNOWN.has(p), `${name}: ${p}`).toBe(true);
    }
  });

  it('gives heroes GBA detail: 32 wide, with at least a dozen distinct colours', () => {
    for (const name of ['omni', ...Object.values(FLEET_SPRITE)]) {
      const { w, pixels } = spritePixels(name);
      expect(w).toBe(32);
      expect(new Set(pixels.filter(Boolean)).size, name).toBeGreaterThanOrEqual(12);
    }
  });

  it('has a hero for every fleet and a tint for every wound kind', () => {
    for (const sprite of Object.values(FLEET_SPRITE)) expect(SPRITE_DEFS[sprite]).toBeDefined();
    expect(Object.keys(WOUND_TINT).sort()).toEqual([...WOUND_KINDS].sort());
    for (const k of WOUND_KINDS) expect(woundTint(k).Z).toHaveLength(4);
  });
});

describe('planetTexture', () => {
  it('is deterministic per seed and ramps the terraform order over [0, 1)', () => {
    const a = planetTexture(7, 128), b = planetTexture(7, 128);
    expect(a).toBe(b);
    const order = [...a.order];
    expect(Math.min(...order)).toBe(0);
    expect(Math.max(...order)).toBeLessThan(1);
    const half = order.filter((o) => o < 0.5).length / order.length;
    expect(half).toBeGreaterThan(0.4);
    expect(half).toBeLessThan(0.6);
  });
});
