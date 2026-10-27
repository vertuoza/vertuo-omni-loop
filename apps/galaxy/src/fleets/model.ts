import { at } from 'omni-loop/kit/lib/narrow.ts';
import type { FleetRow } from '../arcade/types';
import type { Refusal } from './refusal';

// PRD 2530: a fleet may name a GitHub project board, and the omni-loop App writes a note on what it
// last did for it. Both are read with the fleet, and drawn on its card.

/** A fleet's board: the organization project's link, and the App's last note about it (a line of at
 * most 200 characters) with the time it was written. */
export interface Board {
  url: string;
  note: string | null;
  notedAt: string | null;
}

/** A fleet as the page holds it: its look, and its board when it has one. */
export type Fleet = FleetRow & { board?: Board | undefined };

const PROJECT = /^https:\/\/github\.com\/orgs\/([A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)\/projects\/([0-9]+)\/?$/;

/** The organization and number a project link names, or null when it is not an organization project. */
export function projectOf(url: string): { org: string; number: number } | null {
  const m = PROJECT.exec(url.trim());
  const [org, number] = [m?.[1], m?.[2]];
  return org && number ? { org, number: Number(number) } : null;
}

/** What the card says of a refused note, in full (the note itself is one short line). A note the App
 * wrote that this page does not know is its own title. */
export function noteTitle(note: string): string {
  if (note === 'Not added: ask an org admin') {
    return 'The App cannot write organization projects yet. An admin of the organization accepts its Organization projects permission once, in the organization’s settings, and the next pull request is added.';
  }
  if (note === 'Not added: no such project') {
    return 'The App found no project at this link. Check the link on the fleet, and that the project belongs to the workspace’s organization.';
  }
  return note;
}

// /app/settings/fleets's state (PRD 400 s3), as a reducer: the workspace's fleets, the one form being filled
// (a new fleet, or an edit of one), the retire awaiting its confirmation on the page, the last
// refusal, and whether a call is on its way. The client component (FleetsPage.tsx) keeps it and
// calls the fleet functions; the view (FleetsView.tsx) only draws it.

/** The swatches the form offers; any other `#rrggbb` may be typed. */
export const SWATCHES: readonly string[] = ['#d08a4a', '#b07cff', '#ffd84a', '#9aa3c8', '#2fc6a4', '#4fb0ff', '#ff6b8a', '#8bd450'];

/** A new fleet's colour, before the owner picks one. */
export const BLANK_COLOR = at(SWATCHES, 0, 'the first swatch');

/** A card's colour when the typed one is not (yet) a colour: the design's neutral, as lookOf's. */
export const NEUTRAL = '#cfd4e6';

/** The form: `name` is the fleet being edited, null for a new one. */
export interface Draft {
  name: string | null;
  label: string;
  color: string;
  motto: string;
  mascot: string | null;
  /** The GitHub project field: the link as typed, empty for none. */
  project: string;
}

export type DraftField = 'label' | 'color' | 'motto' | 'mascot' | 'project';

export interface FleetsState {
  fleets: Fleet[];
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
  | { type: 'saved'; fleet: Fleet }
  /** The look was saved but its board was refused: the fleet as saved, the form kept (now an edit of it) with the refusal. */
  | { type: 'saved-look'; fleet: Fleet; refusal: Refusal }
  | { type: 'refused'; refusal: Refusal }
  | { type: 'ask-retire'; name: string }
  | { type: 'keep' };

const HEX = /^#[0-9a-f]{6}$/i;

const withFleet = (fleets: Fleet[], fleet: Fleet): Fleet[] =>
  fleets.some((f) => f.name === fleet.name) ? fleets.map((f) => (f.name === fleet.name ? fleet : f)) : [...fleets, fleet];

const ordered = (fleets: Fleet[]) => [...fleets].sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));

export const activeFleets = (state: FleetsState) => ordered(state.fleets.filter((f) => !f.retired));
export const retiredFleets = (state: FleetsState) => ordered(state.fleets.filter((f) => f.retired));

export const initialState = (fleets: Fleet[]): FleetsState => ({ fleets, draft: null, confirming: null, refusal: null, busy: false });

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
      return { ...state, draft: { name: null, label: '', color: BLANK_COLOR, motto: '', mascot: null, project: '' }, confirming: null, refusal: null };
    case 'edit': {
      const f = state.fleets.find((x) => x.name === action.name);
      if (!f) return state;
      return { ...state, draft: { name: f.name, label: f.label, color: f.color, motto: f.motto, mascot: f.mascot, project: f.board?.url ?? '' }, confirming: null, refusal: null };
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
    case 'saved':
      return { fleets: withFleet(state.fleets, action.fleet), draft: null, confirming: null, refusal: null, busy: false };
    case 'saved-look':
      return {
        fleets: withFleet(state.fleets, action.fleet),
        draft: state.draft && { ...state.draft, name: action.fleet.name },
        confirming: null, refusal: action.refusal, busy: false,
      };
    case 'refused':
      return { ...state, refusal: action.refusal, confirming: null, busy: false };
    case 'ask-retire':
      return { ...state, confirming: action.name, refusal: null };
    case 'keep':
      return { ...state, confirming: null };
  }
}
