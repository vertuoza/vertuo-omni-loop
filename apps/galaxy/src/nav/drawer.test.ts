import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CLOSED, DRAWER_BELOW, drawer, drawerKey } from './drawer';

// The phone drawer's pure state (PRD 438): ☰ opens the sidebar as a drawer with the focus inside it;
// Escape, a tap on the scrim or choosing an item closes it and gives the focus back to ☰.

describe('the drawer', () => {
  it('starts closed', () => {
    expect(CLOSED).toEqual({ open: false, focus: 'none' });
  });

  it('opens on ☰ with the focus moved inside it', () => {
    expect(drawer(CLOSED, 'toggle')).toEqual({ open: true, focus: 'drawer' });
  });

  it.each(['toggle', 'escape', 'scrim', 'choose'] as const)('closes on %s and gives the focus back to ☰', (event) => {
    const open = drawer(CLOSED, 'toggle');
    expect(drawer(open, event)).toEqual({ open: false, focus: 'menu-button' });
  });

  it.each(['escape', 'scrim', 'choose'] as const)('stays closed on %s when already closed, moving no focus', (event) => {
    expect(drawer(CLOSED, event)).toEqual(CLOSED);
  });
});

describe('a key inside the open drawer', () => {
  it('Escape closes it', () => {
    expect(drawerKey('Escape', false, 2, 9)).toEqual({ kind: 'close' });
  });

  it('Tab on the last item wraps to the first, and Shift+Tab on the first to the last', () => {
    expect(drawerKey('Tab', false, 8, 9)).toEqual({ kind: 'focus', index: 0 });
    expect(drawerKey('Tab', true, 0, 9)).toEqual({ kind: 'focus', index: 8 });
  });

  it('Tab anywhere else is left to the browser, as is any other key', () => {
    expect(drawerKey('Tab', false, 3, 9)).toEqual({ kind: 'none' });
    expect(drawerKey('Tab', true, 3, 9)).toEqual({ kind: 'none' });
    expect(drawerKey('Tab', false, -1, 9)).toEqual({ kind: 'focus', index: 0 });
    expect(drawerKey('a', false, 3, 9)).toEqual({ kind: 'none' });
  });

  it('Tab with nothing to focus does nothing', () => {
    expect(drawerKey('Tab', false, -1, 0)).toEqual({ kind: 'none' });
  });
});

describe('the phone breakpoint', () => {
  const css = (name: string) => readFileSync(new URL(name, import.meta.url), 'utf8');

  it('is 900px, the one width the sidebar, the top bar and the drawer all switch at', () => {
    expect(DRAWER_BELOW).toBe(900);
    for (const sheet of ['./sidebar.css', './app-bar.css', './drawer.css']) {
      const widths = [...css(sheet).matchAll(/\((?:min|max)-width:\s*([\d.]+)px\)/g)].map((m) => m[1]);
      expect(widths.length, sheet).toBeGreaterThan(0);
      for (const w of widths) expect(['899.98', '900'], sheet).toContain(w);
    }
  });

  it('draws the scrim with the ask pages\' tokens only', () => {
    const sheet = css('./drawer.css').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(sheet).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(sheet).not.toMatch(/\b(?:rgba?|hsla?|oklch|color-mix)\(/i);
    expect(sheet).not.toMatch(/(?<![\w-])(?:white|black)(?![\w-])/);
  });
});
