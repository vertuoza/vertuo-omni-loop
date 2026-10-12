import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Action } from '../arcade/keys';

// The dock's keys are a React effect: here it runs as soon as the hook is called, with no DOM,
// against a window and a document whose listeners the test holds.
vi.mock('react', () => ({ useEffect: (effect: () => void) => { effect(); } }));

const { useDockKeys } = await import('./dock-keys');
const { backFromGame } = await import('./dock');

type Listener = (e: unknown) => void;

function page() {
  const on = new Map<string, Set<Listener>>();
  const add = (type: string, fn: Listener) => { on.set(type, (on.get(type) ?? new Set<Listener>()).add(fn)); };
  const remove = (type: string, fn: Listener) => { on.get(type)?.delete(fn); };
  vi.stubGlobal('window', { addEventListener: add, removeEventListener: remove });
  vi.stubGlobal('document', { hidden: false, addEventListener: add, removeEventListener: remove });
  vi.stubGlobal('HTMLElement', function HTMLElement() {});
  /** A key pressed on the page, outside any field: whether the dock took it from the page. */
  const press = (key: string) => {
    const e = { key, target: null, metaKey: false, ctrlKey: false, altKey: false, shiftKey: key === 'Shift', repeat: false, preventDefault: vi.fn() };
    for (const fn of on.get('keydown') ?? []) fn(e);
    return { taken: e.preventDefault.mock.calls.length > 0 };
  };
  return { press };
}

// BR-PRODUCT-57: the corner game box never takes the page's Tab or Shift keys, so a reader can
// always move between links while a game is open; Escape folds the box and B goes back to the game
// list.
describe('BR-PRODUCT-57: the play dock leaves Tab and Shift to the page', () => {
  beforeEach(() => { vi.unstubAllGlobals(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('never takes Tab or Shift while a game is open: no press, no fold, the page keeps the key', () => {
    const { press } = page();
    const act = vi.fn<(a: Action) => void>();
    const fold = vi.fn();
    useDockKeys(act, null, fold, () => {});

    expect(press('Tab')).toEqual({ taken: false });
    expect(press('Shift')).toEqual({ taken: false });
    expect(act).not.toHaveBeenCalled();
    expect(fold).not.toHaveBeenCalled();
  });

  it('folds the box on Escape, and B is pressed in the game, which goes back to the game list', () => {
    const { press } = page();
    const act = vi.fn<(a: Action) => void>();
    const fold = vi.fn();
    useDockKeys(act, null, fold, () => {});

    expect(press('Escape')).toEqual({ taken: true });
    expect(fold).toHaveBeenCalledTimes(1);
    expect(act).not.toHaveBeenCalled();

    expect(press('b')).toEqual({ taken: true });
    expect(act).toHaveBeenCalledWith('b');
    expect(fold).toHaveBeenCalledTimes(1);
    expect(backFromGame(['invaders', 'platformer'], 'platformer')).toEqual({ kind: 'picker', sel: 1 });
  });
});
