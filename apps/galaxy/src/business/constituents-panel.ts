import { historyOf, liveOf, type Constituent, type ConstituentEvent, type EventAction } from '../constituents/model';
import type { ConstituentPort, SavedConstituent } from '../constituents/store';

// Settings › Business's Constituents panel (PRD 871 s2), its state and the rules it draws by. Per
// product, above the claims: the Statement (what the product is) and the Never list (what it must never
// become or do), and a History drawer of every change, newest first. Only an owner changes them, one
// field open at a time; every write goes through ../constituents/store.ts, and the page logs the event
// the database logged in the same transaction, so the drawer shows it at once. Members read the same.
//
// The vague-word hint: while an owner types a Never line, a fixed list of words that name nothing a
// spec can break shows a hint under the field. It never blocks; the Statement gets none.

/** The words that name nothing a spec can break (spec, solution step 3). */
export const VAGUE_WORDS: readonly string[] = ['world-class', 'best', 'nice', 'quality', 'great', 'beautiful', 'modern', 'seamless'];

const escaped = (word: string) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const VAGUE = VAGUE_WORDS.map((word) => ({ word, at: new RegExp(`(^|[^a-z0-9-])${escaped(word)}(?![a-z0-9-])`, 'i') }));

/** The vague words a Never line holds, whole words only, in the list's order. */
export function vagueWordsOf(text: string): string[] {
  return VAGUE.filter(({ at }) => at.test(text)).map(({ word }) => word);
}

/** The hint under the Never line field, or null when the line names something checkable. */
export function vagueHint(text: string): string | null {
  const words = vagueWordsOf(text);
  if (words.length === 0) return null;
  return `${words.map((w) => `“${w}”`).join(', ')} names nothing a spec can break — say what it would look like.`;
}

// ── The panel's state ────────────────────────────────────────────────────────────

/** The field an owner has open: the Statement (its id, null while there is none) or a new Never line. */
export type ConstituentField = { kind: 'statement'; id: string | null } | { kind: 'never' };

export interface ConstituentsState {
  /** Every constituent of every product, removed ones included: the history names them. */
  constituents: Constituent[];
  /** Every product's history, in any order. */
  events: ConstituentEvent[];
  editing: ConstituentField | null;
  /** The open field's text. */
  text: string;
  /** A write is on its way: every control waits. */
  busy: boolean;
  /** What the last write was refused with, or null. */
  refusal: string | null;
}

export type ConstituentsAction =
  | { type: 'edit-statement'; statement: Constituent | null }
  | { type: 'add-never' }
  | { type: 'text'; text: string }
  | { type: 'cancel' }
  | { type: 'busy' }
  /** A write the database answered with the saved row; the event it logged is `action` by `by` at `at`. */
  | { type: 'saved'; constituent: Constituent; action: EventAction; before: string | null; by: string | null; at: string }
  | { type: 'refused'; message: string };

export function initialConstituentsState(constituents: readonly Constituent[], events: readonly ConstituentEvent[]): ConstituentsState {
  return { constituents: [...constituents], events: [...events], editing: null, text: '', busy: false, refusal: null };
}

const nextEventId = (events: readonly ConstituentEvent[]) => events.reduce((most, e) => Math.max(most, e.id), 0) + 1;

export function constituentsReducer(state: ConstituentsState, action: ConstituentsAction): ConstituentsState {
  switch (action.type) {
    case 'edit-statement':
      return { ...state, editing: { kind: 'statement', id: action.statement?.id ?? null }, text: action.statement?.text ?? '', refusal: null };
    case 'add-never':
      return { ...state, editing: { kind: 'never' }, text: '', refusal: null };
    case 'text':
      return { ...state, text: action.text };
    case 'cancel':
      return { ...state, editing: null, text: '', refusal: null };
    case 'busy':
      return { ...state, busy: true, refusal: null };
    case 'refused':
      return { ...state, busy: false, refusal: action.message };
    case 'saved': {
      const saved = action.constituent;
      const was = state.constituents.find((c) => c.id === saved.id);
      const constituents = was ? state.constituents.map((c) => (c.id === saved.id ? saved : c)) : [...state.constituents, saved];
      // The same text saved again changes nothing, and the database logs nothing.
      const changed = !was || was.text !== saved.text || was.removed !== saved.removed;
      const event: ConstituentEvent = {
        id: nextEventId(state.events), product: saved.product, constituent: saved.id, action: action.action,
        before: action.before, after: action.action === 'removed' ? null : saved.text, note: null, by: action.by, at: action.at,
      };
      return {
        ...state, constituents, events: changed ? [...state.events, event] : state.events,
        busy: false, refusal: null, editing: action.action === 'removed' ? state.editing : null, text: action.action === 'removed' ? state.text : '',
      };
    }
  }
}

// ── What the panel draws ─────────────────────────────────────────────────────────

/** One product's panel: its live Statement and Never lines, and its history, newest first. */
export function panelOf(state: Pick<ConstituentsState, 'constituents' | 'events'>, product: string) {
  return { ...liveOf(state.constituents, product), history: historyOf(state.events, product) };
}

/** The anchor a Never line carries, which the App's "Change the line" links to (`#never-<n>`). */
export const neverAnchor = (line: Pick<Constituent, 'displayId'>) => line.displayId.replace('#', '-');

/** The display id an event names: its constituent's, or `statement` / a bare id when it is not known. */
export function eventTarget(event: ConstituentEvent, constituents: readonly Constituent[]): string {
  const row = constituents.find((c) => c.id === event.constituent);
  return row ? row.displayId : 'a line';
}

export const ACTION_LABEL: Readonly<Record<EventAction, string>> = {
  added: 'added', edited: 'edited', removed: 'removed', moved: 'moved from Business',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const two = (n: number) => String(n).padStart(2, '0');

/** An event's date and time, the same on the server and in the browser: "1 Oct 2026, 09:12 UTC". */
export function whenOf(at: string): string {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return at;
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${two(d.getUTCHours())}:${two(d.getUTCMinutes())} UTC`;
}

// ── The writes ───────────────────────────────────────────────────────────────────

/** Saving the open field of `product` (`before`: the Statement's text when it is edited), or removing a
 * Never line. */
export type ConstituentWrite =
  | { kind: 'save'; product: string; field: ConstituentField; text: string; before: string | null }
  | { kind: 'remove'; line: Constituent };

/** Makes one write through the port, and answers the action the panel takes from it: `saved` with the
 * event the database logged, or `refused` with what the person reads. */
export async function writeConstituent(
  port: ConstituentPort, write: ConstituentWrite, by: string | null, now: () => string = () => new Date().toISOString(),
): Promise<ConstituentsAction> {
  const answer = (saved: SavedConstituent, action: EventAction, before: string | null): ConstituentsAction =>
    (saved.ok ? { type: 'saved', constituent: saved.constituent, action, before, by, at: now() } : { type: 'refused', message: saved.message });
  if (write.kind === 'remove') return answer(await port.remove(write.line.id), 'removed', write.line.text);
  const { product, field, text } = write;
  if (field.kind === 'statement' && field.id !== null) return answer(await port.edit(field.id, text), 'edited', write.before);
  return answer(await port.add(product, field.kind, text), 'added', null);
}
