// The pad, from the keyboard and from the screen. The letters the screens show are the keys to
// press: A is A (or Z, Space, K), B is B (or X, Esc, J, Backspace), Enter is START, Tab is SELECT,
// the arrows move. On the name screen letters type instead (ArcadeApp's onKey).
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

const HINTS: Record<string, Action> = { A: 'a', B: 'b', START: 'start', ENTER: 'start', TAB: 'select' };

/** The pad action a key hint on screen ("[A] LINK GITHUB") presses when clicked; none for ▲▼ and the like. */
export const hintAction = (key: string): Action | null => HINTS[key] ?? null;
