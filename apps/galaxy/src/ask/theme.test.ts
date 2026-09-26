import { runInNewContext } from 'node:vm';
import { describe, it, expect } from 'vitest';
import { CHOICE_ATTR, THEME_ATTR, THEME_KEY, readChoice, resolveTheme, storeChoice, themeScript } from './theme';

describe('the theme resolver', () => {
  it('follows the system when the choice is system', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });

  it('keeps light and dark whatever the system says', () => {
    for (const systemDark of [true, false]) {
      expect(resolveTheme('light', systemDark)).toBe('light');
      expect(resolveTheme('dark', systemDark)).toBe('dark');
    }
  });

  it('reads a stored choice, and anything else as system', () => {
    expect(readChoice('light')).toBe('light');
    expect(readChoice('dark')).toBe('dark');
    expect(readChoice('system')).toBe('system');
    for (const stored of [null, '', 'Dark', 'sepia']) expect(readChoice(stored), String(stored)).toBe('system');
  });

  it('stores light and dark, and forgets the key for system', () => {
    const store = new Map<string, string>();
    const storage = { setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) };
    storeChoice(storage, 'dark');
    expect(store.get(THEME_KEY)).toBe('dark');
    storeChoice(storage, 'system');
    expect(store.has(THEME_KEY)).toBe(false);
  });

  it('never throws when storage is refused', () => {
    const refused = { setItem() { throw new Error('denied'); }, removeItem() { throw new Error('denied'); } };
    expect(() => storeChoice(refused, 'light')).not.toThrow();
  });
});

/** Runs the inline script the layout puts before the first paint, in a bare browser-like global. */
function boot({ stored, systemDark, storage = 'ok', media = true }: { stored: string | null; systemDark: boolean; storage?: 'ok' | 'throws'; media?: boolean }) {
  const attrs = new Map<string, string>();
  const global: Record<string, unknown> = {
    localStorage: {
      getItem(key: string) {
        if (storage === 'throws') throw new Error('SecurityError');
        return key === THEME_KEY ? stored : null;
      },
    },
    document: { currentScript: { parentElement: { setAttribute: (name: string, value: string) => attrs.set(name, value) } } },
  };
  if (media) global.matchMedia = (query: string) => ({ matches: query === '(prefers-color-scheme: dark)' && systemDark });
  global.window = global;
  runInNewContext(themeScript, global);
  return { theme: attrs.get(THEME_ATTR), choice: attrs.get(CHOICE_ATTR) };
}

describe('the script applied before the first paint', () => {
  it('sets the theme the resolver picks, for every stored choice and system setting', () => {
    for (const stored of [null, 'system', 'light', 'dark', 'sepia']) {
      for (const systemDark of [true, false]) {
        const choice = readChoice(stored);
        expect(boot({ stored, systemDark }), `${stored} / ${systemDark ? 'dark' : 'light'} system`).toEqual({
          theme: resolveTheme(choice, systemDark),
          choice,
        });
      }
    }
  });

  it('falls back to the system when storage is refused, and to light without media queries', () => {
    expect(boot({ stored: 'light', systemDark: true, storage: 'throws' })).toEqual({ theme: 'dark', choice: 'system' });
    expect(boot({ stored: null, systemDark: true, media: false })).toEqual({ theme: 'light', choice: 'system' });
  });

  it('does nothing where it has no parent to mark', () => {
    expect(() => runInNewContext(themeScript, { localStorage: { getItem: () => 'dark' }, document: { currentScript: null } })).not.toThrow();
  });

  it('is one small self-contained statement', () => {
    expect(themeScript.length).toBeLessThan(600);
    expect(themeScript).not.toMatch(/<\/script/i);
  });
});
