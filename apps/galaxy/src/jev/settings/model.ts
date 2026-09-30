import { JEV_DECISIONS, jevEntry, type JevDecisionRow } from '../decisions';
import { decisionOf, type JevDecisionSettings, type JevKeyStatus } from '../store';

// Settings › Jev as pure data (PRD 812 s1, s2): the page's state through its actions, and the words it
// draws from it. Jev is on for the workspace exactly when a key is stored: switching it on opens the
// key field, and a key is saved only once its test call answered; switching it off removes the key,
// which sets every decision Off. Each decision's mode, threshold and floor is saved on its own: saving
// one never moves another.

export interface JevState {
  key: JevKeyStatus;
  /** The key field is open: switching on, or replacing the key. */
  editing: boolean;
  /** A call is on its way: every control waits. */
  busy: boolean;
  /** What the last call was refused with, or null. */
  refusal: string | null;
  /** The decisions' stored settings; a decision with none is Off at the defaults. */
  decisions: JevDecisionSettings[];
  /** The decision being saved, or null. */
  savingDecision: string | null;
  /** What saving a decision was last refused with, or null. */
  decisionRefusal: { decision: string; message: string } | null;
}

export type JevAction =
  | { type: 'edit' }
  | { type: 'cancel' }
  | { type: 'busy' }
  | { type: 'saved'; key: JevKeyStatus }
  | { type: 'refused'; message: string }
  | { type: 'decision-saving'; decision: string }
  | { type: 'decision-saved'; settings: JevDecisionSettings }
  | { type: 'decision-refused'; decision: string; message: string };

export const initialState = (key: JevKeyStatus, decisions: JevDecisionSettings[] = []): JevState =>
  ({ key, editing: false, busy: false, refusal: null, decisions, savingDecision: null, decisionRefusal: null });

/** Every decision Off, its tuning kept: what removing the key does. */
const allOff = (decisions: JevDecisionSettings[]) => decisions.map((d) => ({ ...d, mode: 'off' as const }));

export function jevReducer(state: JevState, action: JevAction): JevState {
  switch (action.type) {
    case 'edit':
      return { ...state, editing: true, refusal: null };
    case 'cancel':
      return { ...state, editing: false, refusal: null };
    case 'busy':
      return { ...state, busy: true, refusal: null };
    case 'saved':
      return {
        ...state, key: action.key, editing: false, busy: false, refusal: null,
        decisions: action.key.stored ? state.decisions : allOff(state.decisions),
      };
    case 'refused':
      return { ...state, busy: false, refusal: action.message };
    case 'decision-saving':
      return { ...state, savingDecision: action.decision, decisionRefusal: null };
    case 'decision-saved': {
      const others = state.decisions.filter((d) => d.decision !== action.settings.decision);
      return { ...state, decisions: [...others, action.settings], savingDecision: null, decisionRefusal: null };
    }
    case 'decision-refused':
      return { ...state, savingDecision: null, decisionRefusal: { decision: action.decision, message: action.message } };
  }
}

/** A decision as its row draws it: what it is, its settings, and whether it can be switched on yet. */
export interface DecisionLine {
  row: JevDecisionRow;
  settings: JevDecisionSettings;
  /** Its registry entry has landed; otherwise it is coming later in this PRD. */
  ready: boolean;
}

export const decisionLines = (state: Pick<JevState, 'decisions'>): DecisionLine[] =>
  JEV_DECISIONS.map((row) => ({ row, settings: decisionOf(state.decisions, row.name), ready: jevEntry(row.name) !== null }));

export const MODE_LABELS = { off: 'Off', shadow: 'Shadow', on: 'On' } as const;

/** A threshold or a floor as the page shows it: `0.50`. */
export const tuningText = (value: number): string => value.toFixed(2);

/** A stored key as the owner reads it: its last four only. */
export const maskedKey = (key: JevKeyStatus): string => `•••• ${key.lastFour ?? ''}`.trim();

/** When the key was saved, as the page says it: `30 Sep 2026`, or null. */
export const savedOn = (key: JevKeyStatus): string | null => dayOf(key.setAt);

/** A date as the page says it, in UTC: `30 Sep 2026`, or null. */
export function dayOf(iso: string | null): string | null {
  if (!iso) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  return `${at.getUTCDate()} ${MONTHS[at.getUTCMonth()]} ${at.getUTCFullYear()}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
