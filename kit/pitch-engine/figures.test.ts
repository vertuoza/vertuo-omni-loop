// A stats scene's figures (PRD 2030 s5): each counts up from 0 over 1.5 s, the items one after another,
// and reads the way `meta.locale` writes numbers, `en` when the storyboard names none.
import { describe, expect, it } from 'vitest';
import { COUNT_SECONDS, FIGURE_STAGGER, countedValue, figureAt, figureStarts, formatFigure } from './figures.ts';

/** French groups thousands with a narrow no-break space, as `Intl` writes it. */
const NARROW_SPACE = ' ';

describe('formatFigure', () => {
  it('writes a figure with its prefix in English when no locale is named', () => {
    expect(formatFigure({ value: 16790, prefix: '€' })).toBe('€16,790');
    expect(formatFigure({ value: 16790, prefix: '€' }, undefined, 'en')).toBe('€16,790');
  });

  it('writes the same figure the French way', () => {
    expect(formatFigure({ value: 16790, prefix: '€' }, undefined, 'fr')).toBe(`€16${NARROW_SPACE}790`);
    expect(formatFigure({ value: 2.5, decimals: 1, suffix: ' jours' }, undefined, 'fr')).toBe('2,5 jours');
  });

  it('keeps its decimals, rounding to them, and its suffix as given', () => {
    expect(formatFigure({ value: 92, suffix: '%' })).toBe('92%');
    expect(formatFigure({ value: 1.5, decimals: 1, suffix: ' days' })).toBe('1.5 days');
    expect(formatFigure({ value: 3, decimals: 2 })).toBe('3.00');
    expect(formatFigure({ value: 1.26, decimals: 1 })).toBe('1.3');
    expect(formatFigure({ value: 1.5 })).toBe('2');
  });

  it('writes the value it is given, in the figure’s own form', () => {
    expect(formatFigure({ value: 16790, prefix: '€' }, 8395)).toBe('€8,395');
    expect(formatFigure({ value: 1.5, decimals: 1 }, 0)).toBe('0.0');
  });

  it('never writes a negative zero', () => {
    expect(formatFigure({ value: -40, suffix: '%' }, -0)).toBe('0%');
  });
});

describe('countedValue', () => {
  it('counts from 0 to the value over 1.5 s, rising fast then settling', () => {
    expect(COUNT_SECONDS).toBe(1.5);
    expect(countedValue(16790, 0)).toBe(0);
    expect(countedValue(16790, -1)).toBe(0);
    const half = countedValue(16790, COUNT_SECONDS / 2);
    expect(half).toBeGreaterThan(16790 / 2);
    expect(half).toBeLessThan(16790);
    expect(countedValue(16790, COUNT_SECONDS)).toBe(16790);
    expect(countedValue(16790, 10)).toBe(16790);
  });

  it('only ever climbs', () => {
    const values = Array.from({ length: 46 }, (_, frame) => countedValue(100, frame / 30));
    expect(values).toEqual([...values].sort((a, b) => a - b));
  });
});

describe('figureStarts', () => {
  it('starts the first figure when the words before it are done, each next one a beat later', () => {
    expect(figureStarts(3, 0.8)).toEqual([0.8, 0.8 + FIGURE_STAGGER, 0.8 + 2 * FIGURE_STAGGER]);
    expect(figureStarts(1, 0.3)).toEqual([0.3]);
  });
});

describe('figureAt', () => {
  const figure = { value: 16790, prefix: '€' };

  it('reads 0 before its count starts, and its value once it is done', () => {
    expect(figureAt(figure, 0.5, 0.2)).toBe('€0');
    expect(figureAt(figure, 0.5, 0.5 + COUNT_SECONDS)).toBe('€16,790');
    expect(figureAt(figure, 0.5, 0.5 + COUNT_SECONDS, 'fr')).toBe(`€16${NARROW_SPACE}790`);
  });

  it('reads a figure on its way up in between', () => {
    const between = figureAt(figure, 0.5, 1);
    expect(between).not.toBe('€0');
    expect(between).not.toBe('€16,790');
  });
});
