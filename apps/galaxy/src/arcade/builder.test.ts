import { describe, it, expect } from 'vitest';
import { HERO_PRESETS, validHero, type Hero } from '@omni/sprites';
import { BUILDER_ROWS, cycleHero, rowValue } from './builder';

const hero: Hero = { v: 1, body: 'girl', skin: 0, hair: 0, suit: 0, cape: 0 };

describe('cycleHero', () => {
  it('toggles the body and wraps every other row both ways', () => {
    expect(cycleHero(hero, 'BODY', 1).body).toBe('boy');
    expect(cycleHero(cycleHero(hero, 'BODY', 1), 'BODY', -1).body).toBe('girl');
    expect(cycleHero(hero, 'SKIN', -1).skin).toBe(HERO_PRESETS.skin.length - 1);
    expect(cycleHero(hero, 'CAPE', -1).cape).toBe(HERO_PRESETS.cape.length - 1);
    expect(cycleHero({ ...hero, hair: HERO_PRESETS.hair.length - 1 }, 'HAIR', 1).hair).toBe(0);
    expect(cycleHero(hero, 'DONE', 1)).toBe(hero);
  });

  it('never leaves the presets, however far it cycles', () => {
    let h = hero;
    for (let i = 0; i < 50; i++) for (const row of BUILDER_ROWS) h = cycleHero(h, row, i % 3 ? 1 : -1);
    expect(validHero(h)).toBe(true);
  });
});

describe('rowValue', () => {
  it('shows the fleet colour on the FLEET suit and nothing on a missing cape', () => {
    expect(rowValue(hero, 'SUIT', '#2fc6a4')).toEqual({ label: 'FLEET', swatches: ['#2fc6a4'] });
    expect(rowValue(hero, 'CAPE', '#2fc6a4')).toEqual({ label: 'NONE', swatches: [] });
    expect(rowValue({ ...hero, suit: 2 }, 'SUIT', '#2fc6a4').swatches).toHaveLength(2);
  });
});
