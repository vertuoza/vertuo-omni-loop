// The pick REMEMBER MY CHOICE saves (PRD 932): kept in this browser only, under its own key, and
// read and written in try/catch like the arcade's mute (start.ts). A browser that refuses storage
// still works: it reads no pick, saves nothing, and shows the overlay every time. A value an older
// build left, or anything else that is not a pick, reads as no pick.
import type { AppPick } from '../sign-up';

/** Where the saved pick lives. */
export const CHOICE_KEY = 'omni-loop:app-choice';

export type ChoiceStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const isPick = (v: unknown): v is AppPick => v === 'app' || v === 'arcade';

/** The saved pick, or null: none saved, an unknown value, or storage that is missing or refuses. */
export function readChoice(storage: Pick<Storage, 'getItem'> | null): AppPick | null {
  try {
    const value = storage?.getItem(CHOICE_KEY);
    return isPick(value) ? value : null;
  } catch {
    return null;
  }
}

/** Saves the pick; storage that is missing or refuses saves nothing, and never throws. */
export function saveChoice(storage: ChoiceStorage | null, pick: AppPick): void {
  try { storage?.setItem(CHOICE_KEY, pick); } catch { /* nothing saved: the overlay shows next time */ }
}

/** Forgets the pick; storage that is missing or refuses is left as it is, and never throws. */
export function clearChoice(storage: ChoiceStorage | null): void {
  try { storage?.removeItem(CHOICE_KEY); } catch { /* nothing to clear that can be reached */ }
}

// A remembered pick (PRD 932, s4): it skips the overlay, and the line under SIGN UP WITH GITHUB says
// where the click will open, with **change** as the visible way back.

/** Marks the wrapper of a SIGN UP WITH GITHUB button: Controls draws the hint line in it, in the browser. */
export const HINT_SLOT_ATTR = 'data-sign-up-hint';

/** Marks the hint line's **change**: Controls makes a click on it forget the pick and open the overlay. */
export const CHANGE_ATTR = 'data-sign-up-change';

/** The words of the line under the button: where it opens, then the change control. */
export interface HintLine {
  opens: string;
  change: string;
}

const OPENS: Record<AppPick, string> = { app: 'Opens the Omni app', arcade: 'Opens the Arcade' };

/** The line under SIGN UP WITH GITHUB for a saved pick, or null when none is saved: no line at all. */
export function hintLine(pick: AppPick | null): HintLine | null {
  return pick ? { opens: OPENS[pick], change: 'change' } : null;
}

export interface SignUpClickPorts {
  storage: ChoiceStorage | null;
  /** Opens SELECT YOUR APP. */
  open: () => void;
  /** Starts the GitHub sign-in with the pick, saving nothing: it is saved already. */
  go: (pick: AppPick) => void;
}

/** A click on SIGN UP WITH GITHUB: straight to GitHub with the saved pick, or the overlay without one. */
export function answerSignUp(ports: SignUpClickPorts): void {
  const saved = readChoice(ports.storage);
  if (saved) ports.go(saved);
  else ports.open();
}

/** **change**: forgets the saved pick and opens the overlay, whether the storage let it forget or not. */
export function changeChoice(ports: SignUpClickPorts): void {
  clearChoice(ports.storage);
  ports.open();
}
