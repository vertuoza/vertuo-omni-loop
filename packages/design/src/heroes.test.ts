import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { HERO_PRESETS, rampFrom, heroLook, heroPose, OMNI_POSES, validHero, randomHero, fleetSprite } from './heroes.ts';
import type { Hero, OmniPose } from './heroes.ts';
import { spritePixels } from './draw.ts';
import { RAMPS } from './forge.ts';

const every = (): Hero[] => {
  const out: Hero[] = [];
  for (const [body] of HERO_PRESETS.body) for (let skin = 0; skin < HERO_PRESETS.skin.length; skin++)
    for (let hair = 0; hair < HERO_PRESETS.hair.length; hair++) for (let suit = 0; suit < HERO_PRESETS.suit.length; suit++)
      for (let cape = 0; cape < HERO_PRESETS.cape.length; cape++) out.push({ v: 1, body, skin, hair, suit, cape });
  return out;
};

describe('rampFrom', () => {
  it('keeps the colour as the base tone, lighter above and darker below', () => {
    const lum = (hex: string): number => [1, 3, 5].reduce((n, i) => n + parseInt(hex.slice(i, i + 2), 16), 0);
    for (const hex of ['#2fc6a4', '#ffd84a', '#d08a4a', '#9aa3c8', '#000000', '#FFFFFF']) {
      const r = rampFrom(hex);
      expect(r[1]).toBe(hex.toLowerCase());
      expect(r.every((c) => /^#[0-9a-f]{6}$/.test(c))).toBe(true);
      expect(lum(r[0]!)).toBeGreaterThanOrEqual(lum(r[1]!));
      expect(lum(r[2]!)).toBeLessThanOrEqual(lum(r[1]!));
      expect(lum(r[3]!)).toBeLessThanOrEqual(lum(r[2]!));
    }
    expect(() => rampFrom('teal')).toThrow(/#rrggbb/);
  });
});

describe('heroes', () => {
  it(`draws every one of the ${2 * 6 * 8 * 8 * 9} combinations: a real body, four-tone ramps of real colours`, () => {
    const all = every();
    expect(all).toHaveLength(6912);
    const sprites = new Set();
    for (const hero of all) {
      const { sprite, tint } = heroLook(hero, '#2fc6a4');
      sprites.add(sprite);
      for (const ramp of Object.values(tint)) {
        expect(ramp).toHaveLength(4);
        for (const c of ramp) expect(c).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
    expect([...sprites].sort()).toEqual(['hero-boy', 'hero-boy-nc', 'hero-girl', 'hero-girl-nc']);
  });

  it('forges the four bodies in both frames, and a sample of recoloured heroes, at 32×48', () => {
    const all = every();
    const sample = [...['hero-boy', 'hero-boy-nc', 'hero-girl', 'hero-girl-nc'].map((sprite) => ({ sprite, tint: null })),
      ...Array.from({ length: 60 }, (_, i) => heroLook(all[(i * 7919) % all.length]!, '#ffd84a'))];
    for (const { sprite, tint } of sample) {
      for (const frame of [0, 1]) {
        const { w, h, pixels } = spritePixels(sprite, { frame, tint });
        expect([w, h]).toEqual([32, 48]);
        expect(pixels.filter(Boolean).length).toBeGreaterThan(w * h * 0.3);
      }
    }
  });

  it('recolours what the builder says: skin, hair, suit, cape, and the fleet on the buckle', () => {
    const base: Hero = { v: 1, body: 'girl', skin: 3, hair: 6, suit: 2, cape: 8 };
    const { sprite, tint } = heroLook(base, '#ffd84a');
    const pixels = new Set(spritePixels(sprite, { tint }).pixels);
    const shows = (hex: string): boolean => rampFrom(hex).some((c) => pixels.has(c));
    expect(sprite).toBe('hero-girl');
    expect(shows(HERO_PRESETS.skin[3]!)).toBe(true);
    expect(shows('#4a7dff')).toBe(true); // blue hair
    expect(shows('#ff5a6e')).toBe(true); // crimson suit
    expect(shows('#2fc6a4')).toBe(true); // teal cape
    expect(shows('#ffd84a')).toBe(true); // the fleet's buckle
    expect(heroLook({ ...base, cape: 0 }, '#ffd84a').sprite).toBe('hero-girl-nc');
  });

  it('dresses the FLEET suit in the fleet colour, and OMNI in the commander\'s navy and white', () => {
    const fleet = heroLook({ v: 1, body: 'boy', skin: 1, hair: 0, suit: 0, cape: 0 }, '#b07cff');
    expect(fleet.tint.W).toEqual(rampFrom('#b07cff'));
    const omni = heroLook({ v: 1, body: 'boy', skin: 1, hair: 0, suit: 1, cape: 0 }, '#b07cff');
    expect(omni.tint.W).toBeUndefined();
    expect(new Set(spritePixels(omni.sprite, { tint: omni.tint }).pixels).has(RAMPS.W![1]!)).toBe(true);
  });

  it('draws two different builds for girl and boy', () => {
    const girl = spritePixels('hero-girl').pixels.join();
    const boy = spritePixels('hero-boy').pixels.join();
    expect(girl).not.toBe(boy);
  });
});

describe('heroPose', () => {
  const base: Hero = { v: 1, body: 'girl', skin: 3, hair: 6, suit: 2, cape: 8 };

  it.each<OmniPose>(['omni-point', 'omni-cheer', 'omni-run'])('recolours %s like the idle body: skin, hair, suit, cape and buckle', (pose) => {
    expect(OMNI_POSES).toContain(pose);
    const { sprite, tint } = heroPose(base, pose, '#ffd84a');
    expect(sprite).toBe(`${pose}-cape`);
    expect(tint).toEqual(heroLook(base, '#ffd84a').tint);
    for (const frame of [0, 1]) {
      const pixels = new Set(spritePixels(sprite, { frame, tint }).pixels);
      const shows = (hex: string): boolean => rampFrom(hex).some((c) => pixels.has(c));
      expect(shows(HERO_PRESETS.skin[3]!), 'skin').toBe(true);
      expect(shows('#4a7dff'), 'hair').toBe(true);
      expect(shows('#ff5a6e'), 'suit').toBe(true);
      expect(shows('#2fc6a4'), 'cape').toBe(true);
      expect(shows('#ffd84a'), 'buckle').toBe(true);
    }
  });

  it('drops the cape for a hero without one, and dresses OMNI in the commander\'s own colours', () => {
    expect(heroPose({ ...base, cape: 0 }, 'omni-run').sprite).toBe('omni-run');
    const omni = heroPose({ v: 1, body: 'boy', skin: 1, hair: 0, suit: 1, cape: 0 }, 'omni-point', '#b07cff');
    expect(omni.tint.W).toBeUndefined();
    expect(new Set(spritePixels(omni.sprite, { tint: omni.tint }).pixels).has(RAMPS.W![1]!)).toBe(true);
  });

  it('refuses a pose that is not drawn', () => {
    expect(() => heroPose(base, 'omni-dance' as OmniPose)).toThrow(/omni-dance/);
  });
});

describe('validHero', () => {
  it('accepts every preset combination and refuses anything else', () => {
    expect(every().every(validHero)).toBe(true);
    for (const bad of [null, {}, { v: 2, body: 'girl', skin: 0, hair: 0, suit: 0, cape: 0 },
      { v: 1, body: 'cat', skin: 0, hair: 0, suit: 0, cape: 0 }, { v: 1, body: 'boy', skin: 6, hair: 0, suit: 0, cape: 0 },
      { v: 1, body: 'boy', skin: 0, hair: 0, suit: 0, cape: 9 }, { v: 1, body: 'boy', skin: 1.5, hair: 0, suit: 0, cape: 0 }]) {
      expect(validHero(bad)).toBe(false);
    }
  });

  it('agrees with the database: valid_hero() allows the same ranges', () => {
    const dir = new URL('../../../supabase/migrations/', import.meta.url);
    const sql = readdirSync(dir).filter((f) => f.endsWith('.sql')).map((f) => readFileSync(new URL(f, dir), 'utf8')).join('\n');
    const max = (k: string): number => Number(new RegExp(`\\(h ->> '${k}'\\)::int <= (\\d+)`).exec(sql)![1]);
    expect(max('skin')).toBe(HERO_PRESETS.skin.length - 1);
    expect(max('hair')).toBe(HERO_PRESETS.hair.length - 1);
    expect(max('suit')).toBe(HERO_PRESETS.suit.length - 1);
    expect(max('cape')).toBe(HERO_PRESETS.cape.length - 1);
  });
});

describe('randomHero', () => {
  it('draws a valid hero in the fleet colour, from any random source', () => {
    for (const r of [() => 0, () => 0.999999, Math.random]) {
      const h = randomHero(r);
      expect(validHero(h)).toBe(true);
      expect(h.suit).toBe(0);
      expect(h.cape).toBeGreaterThan(0);
    }
  });
});

describe('fleetSprite', () => {
  it('uses the mascot when it is drawn, else a caped hero in the fleet colour', () => {
    expect(fleetSprite('pirate', '#2fc6a4')).toEqual({ sprite: 'pirate', tint: null });
    const newcomer = fleetSprite('dragon', '#ff6a3d');
    expect(newcomer.sprite).toBe('hero-boy');
    expect(newcomer.tint!.W).toEqual(rampFrom('#ff6a3d'));
    expect(fleetSprite(null, 'not a colour').tint!.W).toEqual(rampFrom('#cfd4e6'));
  });
});
