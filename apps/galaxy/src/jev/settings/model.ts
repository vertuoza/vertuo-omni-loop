import type { JevKeyStatus } from '../store';

// Settings › Jev's key part as pure data (PRD 812 s1): the page's state through its actions, and the
// words it draws from it. Jev is on for the workspace exactly when a key is stored: switching it on
// opens the key field, and a key is saved only once its test call answered; switching it off removes
// the key, which sets every decision Off.

export interface JevState {
  key: JevKeyStatus;
  /** The key field is open: switching on, or replacing the key. */
  editing: boolean;
  /** A call is on its way: every control waits. */
  busy: boolean;
  /** What the last call was refused with, or null. */
  refusal: string | null;
}

export type JevAction =
  | { type: 'edit' }
  | { type: 'cancel' }
  | { type: 'busy' }
  | { type: 'saved'; key: JevKeyStatus }
  | { type: 'refused'; message: string };

export const initialState = (key: JevKeyStatus): JevState => ({ key, editing: false, busy: false, refusal: null });

export function jevReducer(state: JevState, action: JevAction): JevState {
  switch (action.type) {
    case 'edit':
      return { ...state, editing: true, refusal: null };
    case 'cancel':
      return { ...state, editing: false, refusal: null };
    case 'busy':
      return { ...state, busy: true, refusal: null };
    case 'saved':
      return { key: action.key, editing: false, busy: false, refusal: null };
    case 'refused':
      return { ...state, busy: false, refusal: action.message };
  }
}

/** A stored key as the owner reads it: its last four only. */
export const maskedKey = (key: JevKeyStatus): string => `•••• ${key.lastFour ?? ''}`.trim();

/** When the key was saved, as the page says it: `30 Sep 2026`, or null. */
export function savedOn(key: JevKeyStatus): string | null {
  if (!key.setAt) return null;
  const at = new Date(key.setAt);
  if (Number.isNaN(at.getTime())) return null;
  return `${at.getUTCDate()} ${MONTHS[at.getUTCMonth()]} ${at.getUTCFullYear()}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
