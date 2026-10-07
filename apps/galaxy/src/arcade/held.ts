// The held buttons: a second input channel beside `act()`, for a game that reads what is held rather
// than what was pressed. It keeps the buttons held from the keyboard (key down to key up) and from
// the pad (a finger down to its lift or its cancel), several at once. Losing focus clears it all, as
// the key ups and finger lifts of a window in the background never arrive. Menus never read it:
// they keep `act()`, once per press.
import { keyAction, type Action } from './keys';

/** What the pad tells the channel: each finger by its pointer id, and the button under it. */
export interface HeldFingers {
  /** A finger went down on `action`'s control, or slid onto it (the D-pad's arms). */
  fingerDown(id: number, action: Action): void;
  /** The finger lifted, or slid off every control. */
  fingerUp(id: number): void;
  /** The browser took the touch away: the finger is lifted all the same. */
  fingerCancel(id: number): void;
}

export interface Held extends HeldFingers {
  keyDown(key: string): void;
  keyUp(key: string): void;
  /** The window lost focus, or the tab was hidden: nothing is held any more. */
  clear(): void;
  /** Every button held now, by a key or a finger. */
  buttons: () => ReadonlySet<Action>;
}

// A letter goes up under the case it went down in, or another if Shift moved in between.
const keyOf = (key: string) => (key.length === 1 ? key.toLowerCase() : key);

export function createHeld(): Held {
  const keys = new Map<string, Action>();
  const fingers = new Map<number, Action>();
  let held: ReadonlySet<Action> = new Set();
  const update = () => { held = new Set([...keys.values(), ...fingers.values()]); };
  return {
    keyDown(key) {
      const action = keyAction(key);
      if (!action) return;
      keys.set(keyOf(key), action);
      update();
    },
    keyUp(key) {
      if (keys.delete(keyOf(key))) update();
    },
    fingerDown(id, action) {
      fingers.set(id, action);
      update();
    },
    fingerUp(id) {
      if (fingers.delete(id)) update();
    },
    fingerCancel(id) {
      if (fingers.delete(id)) update();
    },
    clear() {
      keys.clear();
      fingers.clear();
      update();
    },
    buttons: () => held,
  };
}
