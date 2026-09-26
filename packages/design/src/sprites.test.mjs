import { describe, it, expect, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { FLAT, RAMPS, forge } from './forge.mjs';
import { SPRITE_DEFS, FLEET_SPRITE, WOUND_TINT, woundTint } from './sprites.mjs';
import { drawSprite, planetTexture, spriteImage, spritePixels } from './draw.mjs';
import { heroLook } from './heroes.mjs';
import { WOUND_KINDS } from '../../../game/events.mjs';

const KNOWN = new Set([...Object.values(RAMPS).flat(), ...Object.values(FLAT), '#0b0a26']);

// Both frames of a sprite, forged, reduced to a short digest.
const digest = (name, o = {}) => createHash('sha256')
  .update(JSON.stringify([0, 1].map((frame) => spritePixels(name, { frame, ...o }))))
  .digest('hex').slice(0, 16);

// What every sprite forged to before the stripes became tintable (PRD 100, s3).
const FORGED = {
  omni: 'e1bddb628d6f1e89', beaver: 'ae4e1b6a90480c40', octopod: '936bcdcd823ea72b', picsou: 'a80e31cbf635ce92',
  cia: '077ff18deb26a1d6', invincible: '0824c1604921ee22', pirate: '7915214f639b3720',
  'hero-girl': 'b1019ef3265b2a8e', 'hero-boy': 'd6379f01321630b1', 'hero-girl-nc': '177bfbb578ac7273', 'hero-boy-nc': 'eb56b682e5c3615d',
  entropy: 'a0e459224884c265', flag: '2e9eced9cda88223', hammer: '0ac43955ba2e3949', fire: '0401bb95ed1e5055',
  lock: '2b6b3393eae8b4f6', skull: 'ab2e39696a26bb5a', beacon: 'a46810cc963139ab', coin: '1b58b50f666861b3',
  check: 'f6ea65ad9194e380', open: 'e3b78dad19e1099c', star: '17cb38ff80c23c8f', ship: 'a77451377f2203c2',
  cursor: '253d3264e5006812',
};
const FORGED_WOUNDED = {
  transmission: '36e0b517c4c911e4', 'unconfirmed-ground': 'b1db9c109ced6935', beacon: '0ac20bcc96a66c5b',
  'fault-line': 'f94fa7e9bab65b49', 'under-fire': '1ad3f05ce152d3ed', aftershock: 'f1ad2dca0de3a274',
};
const FORGED_HEROES = [
  [{ v: 1, body: 'girl', skin: 3, hair: 6, suit: 2, cape: 8 }, '#ffd84a', '06f04d748c59abe8'],
  [{ v: 1, body: 'boy', skin: 0, hair: 3, suit: 0, cape: 0 }, '#2fc6a4', '6803a12fcfdf85a9'],
];

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

describe('forging with no stripe override', () => {
  it('forges every sprite exactly as before', () => {
    expect(Object.keys(FORGED).sort()).toEqual(Object.keys(SPRITE_DEFS).sort());
    for (const name of Object.keys(SPRITE_DEFS)) expect(digest(name), name).toBe(FORGED[name]);
  });

  it('forges wounded Entropy and recoloured heroes exactly as before', () => {
    for (const kind of WOUND_KINDS) expect(digest('entropy', { tint: woundTint(kind) }), kind).toBe(FORGED_WOUNDED[kind]);
    for (const [hero, color, was] of FORGED_HEROES) {
      const { sprite, tint } = heroLook(hero, color);
      expect(digest(sprite, { tint }), sprite).toBe(was);
    }
  });
});

describe('stripe override', () => {
  // Colours no sprite draws today, so a pixel wearing one can only be a recoloured stripe.
  const STRIPES = { 1: '#010203', 2: '#040506', 3: '#070809', 4: '#0a0b0c' };
  const WAS = Object.fromEntries(Object.entries(STRIPES).map(([k, hex]) => [hex, FLAT[k]]));
  const shows = (image, hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    for (let k = 0; k < image.data.length; k += 4) if (image.data[k] === r && image.data[k + 1] === g && image.data[k + 2] === b) return true;
    return false;
  };

  it('forge recolours a flat colour through `flat`, and nothing else', () => {
    for (const hex of Object.values(STRIPES)) expect(KNOWN.has(hex)).toBe(false);
    const draw = (d) => d.rect(1, 1, 6, 6, 'W').px(2, 2, '1').px(4, 4, '1').px(3, 3, 'Q');
    const plain = forge(8, 8, draw).pixels;
    const striped = forge(8, 8, draw, { flat: { 1: STRIPES[1] } }).pixels;
    expect(striped[2 * 8 + 2]).toBe(STRIPES[1]);
    expect(striped[4 * 8 + 4]).toBe(STRIPES[1]);
    expect(striped.filter((p, i) => p !== plain[i])).toEqual([STRIPES[1], STRIPES[1]]);
  });

  it('forge keeps the default of an override that is not a #rrggbb colour, as fleetSprite does', () => {
    const draw = (d) => d.px(1, 1, '1').px(2, 1, '2');
    const { pixels } = forge(4, 4, draw, { flat: { 1: 'red', 2: '#abc', 3: null } });
    expect(pixels).toEqual(forge(4, 4, draw).pixels);
    expect(pixels[1 * 4 + 1]).toBe(FLAT[1]);
  });

  it.each(Object.keys(SPRITE_DEFS))('%s: with 1 to 4 overridden, only the stripe pixels change colour', (name) => {
    for (const frame of [0, 1]) {
      const plain = spritePixels(name, { frame }).pixels;
      const striped = spritePixels(name, { frame, flat: STRIPES }).pixels;
      expect(striped).toHaveLength(plain.length);
      striped.forEach((p, i) => {
        if (p !== plain[i]) expect(WAS[p], `${name} pixel ${i}: ${plain[i]} → ${p}`).toBe(plain[i]);
      });
    }
  });

  it('recolours all four stripes on every suit that wears them', () => {
    for (const name of ['omni', 'beaver', 'hero-girl', 'hero-boy', 'hero-girl-nc', 'hero-boy-nc']) {
      spritePixels(name);
      const worn = new Set(spritePixels(name, { flat: STRIPES }).pixels);
      for (const hex of Object.values(STRIPES)) expect(worn.has(hex), `${name} ${hex}`).toBe(true);
    }
    const { sprite, tint } = heroLook(FORGED_HEROES[0][0], FORGED_HEROES[0][1]);
    expect(new Set(spritePixels(sprite, { tint, flat: STRIPES }).pixels).has(STRIPES[4])).toBe(true);
  });

  it('spriteImage and drawSprite draw the stripes in the override colours', () => {
    class FakeCanvas {
      constructor(w, h) { this.width = w; this.height = h; this.data = null; }
      getContext() {
        return {
          createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
          putImageData: (img) => { this.data = img.data; },
        };
      }
    }
    vi.stubGlobal('OffscreenCanvas', FakeCanvas);
    try {
      expect(shows(spriteImage('omni'), STRIPES[1])).toBe(false);
      expect(shows(spriteImage('omni', { flat: STRIPES }), STRIPES[1])).toBe(true);
      const drawn = [];
      const ctx = { globalAlpha: 1, drawImage: (img) => drawn.push(img) };
      drawSprite(ctx, 'beaver', 0, 0, { flat: STRIPES, glow: '#a45cff' });
      expect(shows(drawn.at(-1), STRIPES[2])).toBe(true);
      drawSprite(ctx, 'beaver', 0, 0);
      expect(shows(drawn.at(-1), STRIPES[2])).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
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
