import { HERO_ROLES, roleLine, roleOf, type HeroRole } from 'omni-loop/kit/lib/virtual-fleet/roles.ts';
import type { Created, NewFleet, VirtualFleetsPort } from '../virtual-fleets.client';
import { FLEET_NAME_MAX, type RefusalField } from '../virtual-fleets.contract';

// The New virtual fleet drawer's rules (PRD 2842 s1, the `fleet-new` screen), pure so each is tested
// without a browser: what it holds as it opens (Name empty, the first icon, every role on), what each
// change does, when Create fleet is enabled, where a refusal is shown and when it goes, where the drawer
// lands once the fleet is made, and the demo's port. NewVirtualFleet.tsx draws it.

export const WORDS = {
  open: '+ New virtual fleet',
  title: 'New virtual fleet',
  name: 'Name',
  placeholder: 'Night Shift',
  icon: 'Icon',
  heroes: 'Heroes',
  cancel: 'Cancel',
  create: 'Create fleet',
  creating: 'Creating…',
  close: 'Close',
  demo: 'The demo world keeps its own fleets.',
} as const;

export interface NewFleetState {
  name: string;
  mascot: string;
  /** The roles left on, in the drawer's order. */
  roles: HeroRole[];
  busy: boolean;
  refusal: { field: RefusalField; message: string } | null;
}

export type NewFleetAction =
  | { type: 'name'; value: string }
  | { type: 'mascot'; value: string }
  | { type: 'toggle'; role: HeroRole }
  | { type: 'busy' }
  | { type: 'refused'; field: RefusalField; message: string };

/** As it opens: Name empty, the first of the fleet mascots, every role on. */
export function openedWith(mascots: readonly string[]): NewFleetState {
  return { name: '', mascot: mascots[0] ?? '', roles: [...HERO_ROLES], busy: false, refusal: null };
}

/** The field each change clears a refusal of. */
const CLEARS: Record<'name' | 'mascot' | 'toggle', RefusalField> = { name: 'name', mascot: 'mascot', toggle: 'heroes' };

export function newFleetReducer(state: NewFleetState, action: NewFleetAction): NewFleetState {
  switch (action.type) {
    case 'busy':
      return { ...state, busy: true, refusal: null };
    case 'refused':
      return { ...state, busy: false, refusal: { field: action.field, message: action.message } };
    case 'name':
    case 'mascot':
    case 'toggle': {
      const refusal = state.refusal && (state.refusal.field === CLEARS[action.type] || state.refusal.field === 'form') ? null : state.refusal;
      if (action.type === 'name') return { ...state, name: action.value, refusal };
      if (action.type === 'mascot') return { ...state, mascot: action.value, refusal };
      const on = state.roles.includes(action.role);
      return { ...state, roles: HERO_ROLES.filter((r) => (r === action.role ? !on : state.roles.includes(r))), refusal };
    }
  }
}

/** Create fleet is enabled with a name of 1 to 12 characters, an icon and at least one role on, and no call on its way. */
export const canCreate = (state: NewFleetState): boolean => {
  const name = state.name.trim();
  return !state.busy && name.length > 0 && name.length <= FLEET_NAME_MAX && state.mascot !== '' && state.roles.length > 0;
};

/** What the drawer sends. */
export const requestOf = (state: NewFleetState): NewFleet => ({ name: state.name.trim(), mascot: state.mascot, roles: [...state.roles] });

/** The refusal shown under `field`, or null. */
export const refusalUnder = (state: NewFleetState, field: RefusalField): string | null => (state.refusal?.field === field ? state.refusal.message : null);

/** Where Create fleet lands: the new fleet in the Fleet section. */
export const landingOf = (fleet: string): string => `/app/fleet?fleet=${encodeURIComponent(fleet)}`;

/** A role's switch as the drawer draws it: its name and its one line on whether it works alone. */
export function roleSwitch(role: HeroRole): { role: HeroRole; name: string; line: string } {
  return { role, name: roleOf(role).name, line: roleLine(role).line };
}

/** The demo's port: the demo world keeps its fleets, so it makes none and says so in the foot. */
export const demoPort: VirtualFleetsPort = {
  create: (): Promise<Created> => Promise.resolve({ ok: false, field: 'form', message: WORDS.demo }),
};
