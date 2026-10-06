// The engine's colours and fonts come only from the look (PRD 1108 s4): every colour the scenes paint
// is one of the look's four, or a mix or a shade of them.
import { describe, expect, it } from 'vitest';
import { presetLook } from '../lib/pitch/settings.ts';
import { alpha, fontsOf, mixColour, paletteOf } from './palette.ts';

describe('mixColour and alpha', () => {
  it('mixes two colours channel by channel', () => {
    expect(mixColour('#000000', '#FFFFFF', 0.5)).toBe('#808080');
    expect(mixColour('#102030', '#102030', 0.7)).toBe('#102030');
    expect(mixColour('#FF0000', '#0000FF', 0)).toBe('#ff0000');
  });

  it('writes a colour with an opacity', () => {
    expect(alpha('#08104D', 0.5)).toBe('rgba(8, 16, 77, 0.5)');
  });
});

describe('paletteOf', () => {
  it('paints the ground in paper and the words in ink, from the look', () => {
    const keynote = paletteOf(presetLook('keynote'));
    expect(keynote).toMatchObject({ paper: '#FBFBFD', ink: '#0B0B12', accent: '#6D28D9', cta: '#DB2777', dark: false });
    const arcade = paletteOf(presetLook('arcade'));
    expect(arcade).toMatchObject({ paper: '#07071A', ink: '#E7E7FF', accent: '#4EE1FF', cta: '#FFD23F', dark: true });
  });

  it('derives every other colour from the look alone: a different look, different colours', () => {
    const keynote = paletteOf(presetLook('keynote'));
    const arcade = paletteOf(presetLook('arcade'));
    for (const key of ['muted', 'hairline', 'surface', 'shade', 'onCta'] as const) expect(arcade[key]).not.toBe(keynote[key]);
    expect(keynote.muted).toBe(mixColour('#0B0B12', '#FBFBFD', 0.4));
  });

  it('writes on the call to action in whichever of ink and paper reads better on it', () => {
    const look = presetLook('keynote');
    expect(paletteOf({ ...look, colors: { ...look.colors, cta: '#FFE600' } }).onCta).toBe('#0B0B12');
    expect(paletteOf({ ...look, colors: { ...look.colors, cta: '#1A1A60' } }).onCta).toBe('#FBFBFD');
  });

  it('shades with the darker of ink and paper', () => {
    expect(paletteOf(presetLook('keynote')).shade).toBe('#0B0B12');
    expect(paletteOf(presetLook('arcade')).shade).toBe('#07071A');
  });
});

describe('fontsOf', () => {
  it('names the look families first in each stack, at their weights', () => {
    const fonts = fontsOf(presetLook('keynote'), {});
    expect(fonts.heading).toEqual({ stack: '"Inter", system-ui, sans-serif', weight: 900 });
    expect(fonts.text).toEqual({ stack: '"Inter", system-ui, sans-serif', weight: 500 });
  });

  it('takes the stacks a fonts provider loaded, when given', () => {
    const fonts = fontsOf(presetLook('arcade'), { heading: '"Anton", serif', text: '"Inter", serif' });
    expect(fonts.heading.stack).toBe('"Anton", serif');
    expect(fonts.text.stack).toBe('"Inter", serif');
  });
});
