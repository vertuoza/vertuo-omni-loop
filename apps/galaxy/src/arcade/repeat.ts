// Hold to repeat, for the on-screen controls. A held direction fires once, again after 400 ms, then
// every 120 ms until it is released; A, B, START and SELECT fire once per press, as with the keyboard.
// Each control keeps its own, so the D-pad and A can be held at the same time.
import type { Action } from './keys';

export const REPEAT_DELAY = 400;
export const REPEAT_EVERY = 120;

const REPEATS: ReadonlySet<Action> = new Set(['up', 'down', 'left', 'right']);

export function holdToRepeat(fire: (action: Action) => void) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stop = () => { if (timer !== undefined) clearTimeout(timer); timer = undefined; };
  const again = (action: Action, ms: number) => {
    timer = setTimeout(() => { fire(action); again(action, REPEAT_EVERY); }, ms);
  };
  return {
    /** A new press: fires at once, and repeats while held if it is a direction. Replaces any press held. */
    press(action: Action) {
      stop();
      fire(action);
      if (REPEATS.has(action)) again(action, REPEAT_DELAY);
    },
    /** The press is over: nothing more fires. */
    release: stop,
  };
}
