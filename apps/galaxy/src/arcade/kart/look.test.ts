import { describe, expect, it } from 'vitest';
import { COLOURS, fleetSprite, rampFrom, spritePixels, SPRITE_DEFS } from '@omni/design';
import { COLORS, DEFAULT_LOOK, DESIGNS, kartSprite, kartTint, readLook } from './look';

describe('the kart look (PRD 1762)', () => {
  it('lists eight colours and three designs, FLEET and CLASSIC first', () => {
    expect(COLORS.map((c) => c.name)).toEqual(['FLEET', 'RED', 'ORANGE', 'YELLOW', 'GREEN', 'CYAN', 'BLUE', 'PINK']);
    expect(DESIGNS).toEqual(['CLASSIC', 'ROCKET', 'RACER']);
    expect(DEFAULT_LOOK).toEqual({ color: 'FLEET', design: 'CLASSIC' });
  });

  it('keeps every colour apart from a theme token default and from the others', () => {
    const tokens = new Set(Object.values(COLOURS).map((c) => c.toLowerCase()));
    const hexes = COLORS.flatMap((c) => (c.hex === null ? [] : [c.hex]));
    expect(hexes).toHaveLength(7);
    for (const hex of hexes) expect(tokens.has(hex.toLowerCase()), hex).toBe(false);
    expect(new Set(hexes).size).toBe(7);
  });

  it('draws FLEET plus CLASSIC as today: the fleet\'s own tint and the kart sprites', () => {
    const fleet = fleetSprite(null, '#c0392b').tint ?? {};
    expect(kartTint(DEFAULT_LOOK, fleet)).toBe(fleet);
    for (const view of ['kart', 'kart-left', 'kart-right'] as const) expect(kartSprite(DEFAULT_LOOK, view)).toBe(view);
  });

  it('recolours the body with a colour, keeping the rest of the tint', () => {
    const fleet = fleetSprite(null, '#c0392b').tint ?? {};
    const red = COLORS.find((c) => c.name === 'RED');
    const tint = kartTint({ color: 'RED', design: 'CLASSIC' }, fleet);
    expect(tint.W).toEqual(rampFrom(red?.hex ?? ''));
    expect(tint.Y).toEqual(fleet.Y);
    expect(fleet.W).toEqual(rampFrom('#c0392b'));
  });

  it('names a design\'s sprite for each of the three views, all of them drawn', () => {
    expect(kartSprite({ color: 'FLEET', design: 'ROCKET' }, 'kart-left')).toBe('kart-rocket-left');
    expect(kartSprite({ color: 'FLEET', design: 'RACER' }, 'kart-right')).toBe('kart-racer-right');
    expect(kartSprite({ color: 'FLEET', design: 'RACER' }, 'kart')).toBe('kart-racer');
    for (const design of DESIGNS) for (const view of ['kart', 'kart-left', 'kart-right'] as const) {
      const name = kartSprite({ color: 'FLEET', design }, view);
      expect(SPRITE_DEFS[name], name).toBeDefined();
      expect(spritePixels(name).pixels.length).toBe(28 * 18);
    }
  });

  it('reads an unknown colour or design as FLEET or CLASSIC, each on its own', () => {
    expect(readLook({ color: 'MAUVE', design: 'ROCKET' })).toEqual({ color: 'FLEET', design: 'ROCKET' });
    expect(readLook({ color: 'PINK', design: 'TANK' })).toEqual({ color: 'PINK', design: 'CLASSIC' });
    for (const raw of [null, undefined, 3, 'RED', [], {}]) expect(readLook(raw)).toEqual(DEFAULT_LOOK);
    expect(readLook({ color: 'cyan', design: 'racer' })).toEqual(DEFAULT_LOOK);
  });
});
