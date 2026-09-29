import type { FleetRow } from '../arcade/types';
import type { Refusal } from './refusal';

// /app/settings/fleets's state (PRD 400 s3), as a reducer: the workspace's fleets, the one form being filled
// (a new fleet, or an edit of one), the retire awaiting its confirmation on the page, the last
// refusal, and whether a call is on its way. The client component (FleetsPage.tsx) keeps it and
// calls the fleet functions; the view (FleetsView.tsx) only draws it.

/** The swatches the form offers; any other `#rrggbb` may be typed. */
export const SWATCHES: readonly string[] = ['#d08a4a', '#b07cff', '#ffd84a', '#9aa3c8', '#2fc6a4', '#4fb0ff', '#ff6b8a', '#8bd450'];

/** A new fleet's colour, before the owner picks one. */
export const BLANK_COLOR = SWATCHES[0];

/** A card's colour when the typed one is not (yet) a colour: the design's neutral, as lookOf's. */
export const NEUTRAL = '#cfd4e6';

/** The form: `name` is the fleet being edited, null for a new one. */
export interface Draft {
  name: string | null;
  label: string;
  color: string;
  motto: string;
  mascot: string | null;
}

export type DraftField = 'label' | 'color' | 'motto' | 'mascot';

export interface FleetsState {
  fleets: FleetRow[];
  draft: Draft | null;
  /** The fleet whose Retire awaits its confirmation. */
  confirming: string | null;
  refusal: Refusal | null;
  busy: boolean;
}

export type FleetsAction =
  | { type: 'new' }
  | { type: 'edit'; name: string }
  | { type: 'change'; field: DraftField; value: string }
  | { type: 'cancel' }
  | { type: 'busy' }
  /** A fleet as a function answered it: created, updated, retired or restored. */
  | { type: 'saved'; fleet: FleetRow }
  | { type: 'refused'; refusal: Refusal }
  | { type: 'ask-retire'; name: string }
  | { type: 'keep' };

const HEX = /^#[0-9a-f]{6}$/i;

const ordered = (fleets: FleetRow[]) => [...fleets].sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));

export const activeFleets = (state: FleetsState) => ordered(state.fleets.filter((f) => !f.retired));
export const retiredFleets = (state: FleetsState) => ordered(state.fleets.filter((f) => f.retired));

export const initialState = (fleets: FleetRow[]): FleetsState => ({ fleets, draft: null, confirming: null, refusal: null, busy: false });

/** The card the form draws as the owner types: the fleet as it would be saved. */
export function previewOf(draft: Draft): FleetRow {
  return {
    name: draft.name ?? 'new',
    home: null,
    label: draft.label.trim() || 'NEW FLEET',
    color: HEX.test(draft.color.trim()) ? draft.color.trim().toLowerCase() : NEUTRAL,
    motto: draft.motto.trim(),
    mascot: draft.mascot,
    sort: 0,
    retired: false,
  };
}

export function fleetsReducer(state: FleetsState, action: FleetsAction): FleetsState {
  switch (action.type) {
    case 'new':
      return { ...state, draft: { name: null, label: '', color: BLANK_COLOR, motto: '', mascot: null }, confirming: null, refusal: null };
    case 'edit': {
      const f = state.fleets.find((x) => x.name === action.name);
      if (!f) return state;
      return { ...state, draft: { name: f.name, label: f.label, color: f.color, motto: f.motto, mascot: f.mascot }, confirming: null, refusal: null };
    }
    case 'change': {
      if (!state.draft) return state;
      const value = action.field === 'mascot' ? action.value || null : action.value;
      const refusal = state.refusal?.field === action.field ? null : state.refusal;
      return { ...state, draft: { ...state.draft, [action.field]: value }, refusal };
    }
    case 'cancel':
      return { ...state, draft: null, refusal: null };
    case 'busy':
      return { ...state, busy: true };
    case 'saved': {
      const known = state.fleets.some((f) => f.name === action.fleet.name);
      const fleets = known ? state.fleets.map((f) => (f.name === action.fleet.name ? action.fleet : f)) : [...state.fleets, action.fleet];
      return { fleets, draft: null, confirming: null, refusal: null, busy: false };
    }
    case 'refused':
      return { ...state, refusal: action.refusal, confirming: null, busy: false };
    case 'ask-retire':
      return { ...state, confirming: action.name, refusal: null };
    case 'keep':
      return { ...state, confirming: null };
  }
}
