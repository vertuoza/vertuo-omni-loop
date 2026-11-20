import { describe, expect, it } from 'vitest';
import { ICON_GRIDS, ICON_NAMES, ICON_SIZE, drawIcon } from './icons.ts';

const NAVIGATION = ['home', 'prds', 'roadmap', 'outbox', 'runners', 'settings', 'search', 'close', 'menu', 'chevron-up', 'chevron-down', 'chevron-left', 'chevron-right', 'external-link'];

describe('the 1-bit icon set', () => {
  it('has each navigation icon', () => {
    for (const name of NAVIGATION) expect(ICON_NAMES, name).toContain(name);
  });

  it('has the four tone icons a Notice draws, in currentColor', () => {
    for (const name of ['tone-info', 'tone-success', 'tone-warning', 'tone-danger'] as const) {
      expect(ICON_NAMES, name).toContain(name);
      expect(drawIcon(name), name).toContain('fill="currentColor"');
    }
  });

  it('draws every icon on a 16×16 grid of on and off pixels only', () => {
    for (const name of ICON_NAMES) {
      const grid = ICON_GRIDS[name];
      expect(grid, name).toHaveLength(ICON_SIZE);
      for (const row of grid) expect(row, name).toMatch(/^[#.]{16}$/);
      expect(grid.join('').includes('#'), `${name} has an on pixel`).toBe(true);
    }
  });

  it('draws an SVG in currentColor, crisp, at whole-number scales', () => {
    const svg = drawIcon('home', 2);
    expect(svg).toContain('fill="currentColor"');
    expect(svg).toContain('shape-rendering="crispEdges"');
    expect(svg).toContain('width="32"');
    expect(svg).toContain('viewBox="0 0 16 16"');
    expect(() => drawIcon('home', 1.5)).toThrow(/whole number/);
    expect(() => drawIcon('home', 0)).toThrow(/whole number/);
  });

  it('draws the pixels of the grid and no others', () => {
    const on = ICON_GRIDS.menu.join('').split('#').length - 1;
    const area = [...drawIcon('menu').matchAll(/h(\d+)v1/g)].reduce((sum, m) => sum + Number(m[1]), 0);
    expect(area).toBe(on);
  });
});
