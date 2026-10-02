// SELECT YOUR APP (PRD 932, s3): the overlay's state, as a pure reducer. The cursor starts on the
// Omni app, so Enter alone opens the board; ← and → move it and wrap around; REMEMBER MY CHOICE
// starts off every time the overlay opens. A step returns the next state and, when the person picked
// or closed, what to do about it: Selector.tsx carries the effect out, and draws nothing else.
import type { AppPick } from '../sign-up';

/** The pedestals, left to right. */
export const APPS: readonly [AppPick, AppPick] = ['app', 'arcade'];

export interface SelectorState {
  /** The pedestal under the ▼ P1 cursor. */
  cursor: AppPick;
  /** REMEMBER MY CHOICE. */
  remember: boolean;
}

export type SelectorAction =
  | { type: 'key'; key: string }
  /** A pedestal took the focus (Tab, or the pointer). */
  | { type: 'select'; pick: AppPick }
  /** A pedestal was clicked. */
  | { type: 'pick'; pick: AppPick }
  | { type: 'toggle' };

/** Start the sign-in with `pick`, saving it first when `save`; or close without signing in. */
export type SelectorEffect = { type: 'go'; pick: AppPick; save: boolean } | { type: 'close' };

export function openSelector(): SelectorState {
  return { cursor: APPS[0], remember: false };
}

const move = (cursor: AppPick, by: number): AppPick => APPS[(APPS.indexOf(cursor) + by + APPS.length) % APPS.length] ?? cursor;

const go = (state: SelectorState, pick: AppPick) =>
  ({ state: { ...state, cursor: pick }, effect: { type: 'go', pick, save: state.remember } as const });

export function step(state: SelectorState, action: SelectorAction): { state: SelectorState; effect: SelectorEffect | null } {
  switch (action.type) {
    case 'select': return { state: { ...state, cursor: action.pick }, effect: null };
    case 'pick': return go(state, action.pick);
    case 'toggle': return { state: { ...state, remember: !state.remember }, effect: null };
    case 'key':
      switch (action.key) {
        case 'ArrowRight': return { state: { ...state, cursor: move(state.cursor, 1) }, effect: null };
        case 'ArrowLeft': return { state: { ...state, cursor: move(state.cursor, -1) }, effect: null };
        case 'Enter': return go(state, state.cursor);
        case 'Escape': return { state, effect: { type: 'close' } };
        default: return { state, effect: null };
      }
  }
}
