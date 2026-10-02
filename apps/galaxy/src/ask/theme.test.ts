import { runInNewContext } from 'node:vm';
import { describe, it, expect } from 'vitest';
import { CHOICE_ATTR, THEME_ATTR, THEME_CHOICES, THEME_KEY, readChoice, storeChoice, themeScript } from './theme';
import * as theme from './theme';

describe('the theme choice', () => {
  it('is Omni, Light or Dark, in that order', () => {
    expect(THEME_CHOICES).toEqual(['omni', 'light', 'dark']);
  });

  it('is the theme: nothing resolves it against the system any more', () => {
    expect('resolveTheme' in theme).toBe(false);
  });

  it('reads a stored light or dark as itself, and anything else as Omni', () => {
    expect(readChoice('light')).toBe('light');
    expect(readChoice('dark')).toBe('dark');
    for (const stored of [null, 'system', 'omni', '', 'Dark', 'sepia']) expect(readChoice(stored), String(stored)).toBe('omni');
  });

  it('stores light and dark, and forgets the key for Omni', () => {
    const store = new Map<string, string>();
    const storage = { setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) };
    storeChoice(storage, 'light');
    expect(store.get(THEME_KEY)).toBe('light');
    storeChoice(storage, 'dark');
    expect(store.get(THEME_KEY)).toBe('dark');
    storeChoice(storage, 'omni');
    expect(store.has(THEME_KEY)).toBe(false);
  });

  it('never throws when storage is refused', () => {
    const refused = { setItem() { throw new Error('denied'); }, removeItem() { throw new Error('denied'); } };
    for (const choice of THEME_CHOICES) expect(() => {
      storeChoice(refused, choice);
    }, choice).not.toThrow();
  });
});

/** Runs the inline script the layout puts before the first paint, in a bare browser-like global. */
function boot({ stored, storage = 'ok' }: { stored: string | null; storage?: 'ok' | 'throws' }) {
  const attrs = new Map<string, string>();
  const global: Record<string, unknown> = {
    localStorage: {
      getItem(key: string) {
        if (storage === 'throws') throw new Error('SecurityError');
        return key === THEME_KEY ? stored : null;
      },
    },
    document: { currentScript: { parentElement: { setAttribute: (name: string, value: string) => attrs.set(name, value) } } },
    // A system that prefers dark: Omni never follows it.
    matchMedia: (query: string) => ({ matches: query === '(prefers-color-scheme: dark)' }),
  };
  global.window = global;
  runInNewContext(themeScript, global);
  return { theme: attrs.get(THEME_ATTR), choice: attrs.get(CHOICE_ATTR) };
}

describe('the script applied before the first paint', () => {
  it('marks the root with the choice readChoice gives, for every stored value', () => {
    for (const stored of [null, 'system', 'omni', '', 'light', 'dark', 'sepia']) {
      const choice = readChoice(stored);
      expect(boot({ stored }), String(stored)).toEqual({ theme: choice, choice });
    }
  });

  it('shows Omni when storage is refused', () => {
    expect(boot({ stored: 'light', storage: 'throws' })).toEqual({ theme: 'omni', choice: 'omni' });
  });

  it('never asks the system what it prefers', () => {
    expect(themeScript).not.toContain('matchMedia');
    expect(themeScript).not.toContain('prefers-color-scheme');
  });

  it('does nothing where it has no parent to mark', () => {
    expect(() => {
      runInNewContext(themeScript, { localStorage: { getItem: () => 'dark' }, document: { currentScript: null } });
    }).not.toThrow();
  });

  it('is one small self-contained statement', () => {
    expect(themeScript.length).toBeLessThan(600);
    expect(themeScript).not.toMatch(/<\/script/i);
  });
});
