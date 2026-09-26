// The pad, from the keyboard and from the screen. The letters the screens show are the keys to
// press: A is A (or Z, Space, K), B is B (or X, Esc, J, Backspace), Enter is START, Tab is SELECT,
// the arrows move. On the name screen letters type instead (ArcadeApp's onKey).
import type { Form } from './form';

export type Action = 'up' | 'down' | 'left' | 'right' | 'a' | 'b' | 'start' | 'select';

const KEYS: Record<string, Action> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  a: 'a', A: 'a', z: 'a', Z: 'a', k: 'a', K: 'a', ' ': 'a',
  b: 'b', B: 'b', x: 'b', X: 'b', j: 'b', J: 'b', Escape: 'b', Backspace: 'b',
  Enter: 'start',
  Tab: 'select', Shift: 'select',
};

/** The pad action a key press stands for, if any. */
export const keyAction = (key: string): Action | null => KEYS[key] ?? null;

const HINTS: Record<string, Action> = { A: 'a', B: 'b', START: 'start', ENTER: 'start', TAB: 'select', SELECT: 'select' };

/** The pad action a key hint on screen ("[A] LINK GITHUB") presses when clicked; none for ▲▼ and the like. */
export const hintAction = (key: string): Action | null => HINTS[key] ?? null;

// On the Game Boy bodies the pad's buttons are the keys, so a hint names the button that does what
// the key does. TYPE has no button: there is no keyboard to type on.
const ON_PAD: Record<string, string | null> = { ENTER: 'START', TAB: 'SELECT', '⌫': 'B', ESC: 'B', TYPE: null };

/**
 * The key a hint names on `form`: the keyboard's on `full`, as it always read; on `handheld` and
 * `advance` the Game Boy's buttons, START for ENTER, SELECT for TAB and B for ⌫ or ESC. A, B, START
 * and the arrows read the same everywhere. Null when the hint has no button on `form` (TYPE), and is
 * dropped.
 */
export function hintKey(key: string, form: Form): string | null {
  if (form === 'full' || !(key in ON_PAD)) return key;
  return ON_PAD[key];
}
