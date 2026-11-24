import { HERO_ROLES, roleLine, roleOf, type HeroRole } from 'omni-loop/kit/lib/virtual-fleet/roles.ts';
import type { Created, NewFleet, VirtualFleetsPort } from '../virtual-fleets.client';
import { FLEET_NAME_MAX, type FleetLevel, type RefusalField } from '../virtual-fleets.contract';

// The New AI fleet drawer's rules (PRD 2842 s1, PRD 2873 s3, PRD 2896 s1, the `fleet-new` screen), pure so each is tested
// without a browser: what it holds as it opens (Name empty, the first icon, every role on, `Reviews with you`), what each
// change does, when Create fleet is enabled, where a refusal is shown and when it goes, where the drawer
// lands once the fleet is made, and the demo's port. NewVirtualFleet.tsx draws it.

export const WORDS = {
  open: '+ New AI fleet',
  title: 'New AI fleet',
  name: 'Name',
  placeholder: 'Night Shift',
  icon: 'Icon',
  heroes: 'Heroes',
  cancel: 'Cancel',
  create: 'Create fleet',
  creating: 'Creating…',
  close: 'Close',
  demo: 'The demo world keeps its own fleets.',
  level: 'Level',
  ownersOnly: 'Only an owner of the workspace chooses the two others.',
  needsRoles: 'Works alone needs a PM, an Architect and a Reviewer.',
} as const;

/** The three levels as the drawer offers them, with the one line each says a person still does. */
export const LEVELS: readonly { level: FleetLevel; name: string; line: string }[] = [
  { level: 'with-you', name: 'Reviews with you', line: 'You merge each PRD' },
  { level: 'own-branch', name: 'Own branch', line: 'You land the mission' },
  { level: 'alone', name: 'Works alone', line: 'Asks you when needed' },
];

/** The roles a fleet needs to work alone. */
const ALONE_ROLES: readonly HeroRole[] = ['pm', 'architect', 'reviewer'];

export interface NewFleetState {
  name: string;
  mascot: string;
  /** The roles left on, in the drawer's order. */
  roles: HeroRole[];
  /** The fleet's level: `with-you` as it opens. */
  level: FleetLevel;
  /** True for a workspace owner: only they choose a level above `with-you`. */
  owner: boolean;
  busy: boolean;
  refusal: { field: RefusalField; message: string } | null;
  /** Where the drawer lands once the fleet is made: set, the drawer closes and goes there (#2866). */
  landing?: string;
}

export type NewFleetAction =
  | { type: 'name'; value: string }
  | { type: 'mascot'; value: string }
  | { type: 'toggle'; role: HeroRole }
  | { type: 'level'; level: FleetLevel }
  | { type: 'busy' }
  | { type: 'refused'; field: RefusalField; message: string }
  | { type: 'made'; fleet: string };

/** As it opens: Name empty, the first of the fleet mascots, every role on, `Reviews with you`. */
export function openedWith(mascots: readonly string[], owner = false): NewFleetState {
  return { name: '', mascot: mascots[0] ?? '', roles: [...HERO_ROLES], level: 'with-you', owner, busy: false, refusal: null };
}

/** True when the roles left on let a fleet work alone: a PM, an Architect and a Reviewer. */
export const canWorkAlone = (roles: readonly HeroRole[]): boolean => ALONE_ROLES.every((role) => roles.includes(role));

/** True when `level` cannot be chosen: a member who is not an owner keeps `with-you`, and `alone` needs three roles. */
export function levelDisabled(state: NewFleetState, level: FleetLevel): boolean {
  if (level === 'with-you') return false;
  return !state.owner || (level === 'alone' && !canWorkAlone(state.roles));
}

/** The field each change clears a refusal of. */
const CLEARS: Record<'name' | 'mascot' | 'toggle' | 'level', RefusalField> = { name: 'name', mascot: 'mascot', toggle: 'heroes', level: 'level' };

/** Switches a role, the roles kept in the drawer's order; a fleet that loses a role Works alone needs falls back to Own branch. */
function toggled(state: NewFleetState, role: HeroRole): Pick<NewFleetState, 'roles' | 'level'> {
  const on = state.roles.includes(role);
  const roles = HERO_ROLES.filter((r) => (r === role ? !on : state.roles.includes(r)));
  return { roles, level: state.level === 'alone' && !canWorkAlone(roles) ? 'own-branch' : state.level };
}

type Change = Extract<NewFleetAction, { type: 'name' | 'mascot' | 'toggle' | 'level' }>;

/** What a change to one field sets, or null when it cannot be made (a level the drawer disables). */
function edit(state: NewFleetState, action: Change): Partial<NewFleetState> | null {
  if (action.type === 'name') return { name: action.value };
  if (action.type === 'mascot') return { mascot: action.value };
  if (action.type === 'level') return levelDisabled(state, action.level) ? null : { level: action.level };
  return toggled(state, action.role);
}

/** A change to one field, its refusal cleared when it was that field's (or the foot's). */
function changed(state: NewFleetState, action: Change): NewFleetState {
  const patch = edit(state, action);
  if (patch === null) return state;
  const field = state.refusal?.field;
  const clears = field === CLEARS[action.type] || field === 'form';
  return { ...state, ...patch, refusal: clears ? null : state.refusal };
}

export function newFleetReducer(state: NewFleetState, action: NewFleetAction): NewFleetState {
  switch (action.type) {
    case 'busy':
      return { ...state, busy: true, refusal: null };
    case 'refused':
      return { ...state, busy: false, refusal: { field: action.field, message: action.message } };
    case 'made':
      return { ...state, busy: false, refusal: null, landing: landingOf(action.fleet) };
    case 'name':
    case 'mascot':
    case 'level':
    case 'toggle':
      return changed(state, action);
  }
}

/** Create fleet is enabled with a name of 1 to 12 characters, an icon and at least one role on, and no call on its way. */
export const canCreate = (state: NewFleetState): boolean => {
  const name = state.name.trim();
  return !state.busy && name.length > 0 && name.length <= FLEET_NAME_MAX && state.mascot !== '' && state.roles.length > 0;
};

/** What the drawer sends. */
export const requestOf = (state: NewFleetState): NewFleet => ({ name: state.name.trim(), mascot: state.mascot, roles: [...state.roles], level: state.level });

/** The refusal shown under `field`, or null. */
export const refusalUnder = (state: NewFleetState, field: RefusalField): string | null => (state.refusal?.field === field ? state.refusal.message : null);

/** Where Create fleet lands: the new fleet in the Fleet section. */
export const landingOf = (fleet: string): string => `/app/ai-fleet?fleet=${encodeURIComponent(fleet)}`;

/** A role's switch as the drawer draws it: its name and its count line (`Runs <k> of <n> skills alone`). */
export function roleSwitch(role: HeroRole): { role: HeroRole; name: string; line: string } {
  return { role, name: roleOf(role).name, line: roleLine(role).line };
}

/** The demo's port: the demo world keeps its fleets, so it makes none and says so in the foot. */
export const demoPort: VirtualFleetsPort = {
  create: (): Promise<Created> => Promise.resolve({ ok: false, field: 'form', message: WORDS.demo }),
};
