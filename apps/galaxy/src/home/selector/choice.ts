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
export function readChoice(storage: ChoiceStorage | null): AppPick | null {
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
