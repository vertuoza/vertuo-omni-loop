import { PERSONA_TRADES, personaVariations, randomAvatar, type PersonaAvatar } from '@omni/design';
import { hasProducts, type Product } from './model';
import { at, isOneOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';

// Settings → Business → Personas (PRD 799 s3): a product's cast, the team's own picture of its
// customers. Each persona has a name, a stance, a trade, an avatar into that trade's sprite variations
// (@omni/design), who they are and how they use the product. They are not claims: no source, state or
// receipt, edited directly through the persona functions of
// supabase/migrations/20261022090000_personas.sql (./personas-store.ts).
//
// This file is the section's model and its state through its actions: the cast of the tab shown, the
// drawer that adds or edits one persona (its fields and its portrait picker, 24 variations a page,
// Shuffle for the next page), and Delete, which removes a persona at once and offers Undo for
// UNDO_MS. A new persona starts on an avatar picked at random for its trade: the seed comes with the
// action, so the reducer stays pure.

export type Stance = 'excited' | 'neutral' | 'skeptical';

export const STANCES: readonly Stance[] = ['excited', 'neutral', 'skeptical'];

/** A persona's own fields, as a person gives them. */
export interface PersonaFields {
  name: string;
  stance: Stance;
  /** A trade id of @omni/design's PERSONA_TRADES. */
  trade: string;
  avatar: PersonaAvatar;
  who: string;
  usage: string;
}

export interface Persona extends PersonaFields {
  id: string;
  /** The product it belongs to. */
  product: string;
  /** Its place in the cast: oldest first. */
  ordinal: number;
}

/** A public.personas row, as PostgREST answers it. */
export interface StoredPersona {
  id: string;
  product_id: string;
  ordinal: number | string;
  name: string;
  stance: string;
  trade: string;
  avatar: PersonaAvatar;
  who: string | null;
  usage: string | null;
}

export const PERSONA_COLUMNS = 'id, product_id, ordinal, name, stance, trade, avatar, who, usage';

/** How long Undo stays after a delete. */
export const UNDO_MS = 5000;
/** How many variations the portrait picker shows at once. */
export const PICKER_SIZE = 24;
export const NAME_MAX = 40;
export const TEXT_MAX = 400;

const isStance = (s: unknown): s is Stance => isOneOf(STANCES, s);

export function personaOf(row: StoredPersona): Persona {
  return {
    id: row.id,
    product: row.product_id,
    ordinal: Number(row.ordinal),
    name: row.name,
    stance: isStance(row.stance) ? row.stance : 'neutral',
    trade: row.trade,
    avatar: row.avatar,
    who: row.who ?? '',
    usage: row.usage ?? '',
  };
}

/** A trade's label, or the id itself for a trade this page cannot name. */
export const tradeLabel = (trade: string) => PERSONA_TRADES.find((t) => t.id === trade)?.label ?? trade;

/** True when the page can draw the trade: the database takes any short lower-case word. */
export const drawable = (trade: string) => PERSONA_TRADES.some((t) => t.id === trade);

/** An avatar's version, read as a number: the type names one version, a stored row may hold another. */
const versionOf = (avatar: PersonaAvatar): number => avatar.v;

export const sameAvatar = (a: PersonaAvatar, b: PersonaAvatar) =>
  versionOf(a) === versionOf(b) && a.skin === b.skin && a.hair === b.hair && a.hairColor === b.hairColor && a.outfit === b.outfit && a.accessory === b.accessory;

const byOrdinal = (a: Persona, b: Persona) => a.ordinal - b.ordinal;

/** The cast one product's tab shows: every persona while there is one product; else that product's. */
export function viewPersonas(personas: readonly Persona[], products: readonly Product[], current: string | null): Persona[] {
  const shown = hasProducts(products) ? personas.filter((p) => p.product === current) : [...personas];
  return shown.sort(byOrdinal);
}

// ── The state ────────────────────────────────────────────────────────────────────

export interface PersonaDrawer {
  /** The persona being edited, or null for a new one. */
  editing: string | null;
  /** The product a new persona joins. */
  product: string | null;
  fields: PersonaFields;
  /** What orders the picker's variations. */
  seed: string;
  /** The picker's page: Shuffle shows the next. */
  page: number;
}

export interface PersonasState {
  /** Every persona of the business, of every product. */
  personas: Persona[];
  drawer: PersonaDrawer | null;
  /** A call is on its way: every control waits. */
  busy: boolean;
  /** What the last call was refused with, or null. */
  refusal: string | null;
  /** The persona just deleted, which Undo brings back until `until`. */
  undo: { persona: Persona; until: number } | null;
}

export type PersonasAction =
  /** + Add a persona: a drawer for `product`, on an avatar `seed` picks. */
  | { type: 'new'; product: string | null; seed: string }
  | { type: 'edit'; persona: string; seed: string }
  | { type: 'change'; fields: Partial<PersonaFields> }
  | { type: 'shuffle' }
  | { type: 'close' }
  | { type: 'busy' }
  | { type: 'refused'; message: string }
  /** A persona was added or changed, as saved. */
  | { type: 'saved'; persona: Persona }
  /** A persona was deleted `at` (ms): Undo stays until `at` + UNDO_MS. */
  | { type: 'deleted'; persona: Persona; at: number }
  | { type: 'restored'; persona: Persona }
  /** The clock read `at`: an Undo past its time goes. */
  | { type: 'tick'; at: number };

export const initialPersonasState = (personas: Persona[] = []): PersonasState => ({
  personas: [...personas].sort(byOrdinal), drawer: null, busy: false, refusal: null, undo: null,
});

/** The first trade: where a new persona starts. */
const FIRST_TRADE = at(PERSONA_TRADES, 0, 'the first trade').id;

const blankFields = (seed: string): PersonaFields => ({
  name: '', stance: 'neutral', trade: FIRST_TRADE, avatar: randomAvatar(seed), who: '', usage: '',
});

/** The variations the picker shows now. */
export const pickerOf = (drawer: PersonaDrawer): PersonaAvatar[] => personaVariations(drawer.seed, drawer.page, PICKER_SIZE);

const withPersona = (personas: readonly Persona[], persona: Persona) =>
  [...personas.filter((p) => p.id !== persona.id), persona].sort(byOrdinal);

type Handlers = { [T in PersonasAction['type']]: (state: PersonasState, action: Extract<PersonasAction, { type: T }>) => PersonasState };

const HANDLERS: Handlers = {
  'new': (state, { product, seed }) => ({
    ...state, refusal: null, drawer: { editing: null, product, fields: blankFields(seed), seed, page: 0 },
  }),
  'edit': (state, { persona, seed }) => {
    const found = state.personas.find((p) => p.id === persona);
    if (!found) return state;
    const { name, stance, trade, avatar, who, usage } = found;
    return { ...state, refusal: null, drawer: { editing: found.id, product: found.product, fields: { name, stance, trade, avatar, who, usage }, seed, page: 0 } };
  },
  'change': (state, { fields }) => (state.drawer ? { ...state, drawer: { ...state.drawer, fields: { ...state.drawer.fields, ...fields } } } : state),
  'shuffle': (state) => (state.drawer ? { ...state, drawer: { ...state.drawer, page: state.drawer.page + 1 } } : state),
  'close': (state) => ({ ...state, drawer: null, refusal: null }),
  'busy': (state) => ({ ...state, busy: true, refusal: null }),
  'refused': (state, { message }) => ({ ...state, busy: false, refusal: message }),
  'saved': (state, { persona }) => ({ ...state, personas: withPersona(state.personas, persona), drawer: null, busy: false }),
  'deleted': (state, { persona, at }) => ({
    ...state, personas: state.personas.filter((p) => p.id !== persona.id), drawer: null, busy: false,
    undo: { persona, until: at + UNDO_MS },
  }),
  'restored': (state, { persona }) => ({ ...state, personas: withPersona(state.personas, persona), undo: null, busy: false }),
  'tick': (state, { at }) => (state.undo && at >= state.undo.until ? { ...state, undo: null } : state),
};

export function personasReducer(state: PersonasState, action: PersonasAction): PersonasState {
  const handle = HANDLERS[action.type] as (state: PersonasState, action: PersonasAction) => PersonasState; // ts-allow: HANDLERS keys each handler by the action type it takes, which TypeScript cannot correlate
  return handle(state, action);
}

/** True while Undo may still bring the deleted persona back. */
export const canUndo = (state: PersonasState, at: number) => state.undo !== null && at < state.undo.until;
