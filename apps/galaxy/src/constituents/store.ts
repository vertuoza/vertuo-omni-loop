import {
  constituentOf, NEVER_MAX, SavedConstituentRow, STATEMENT_MAX,
  type Constituent, type ConstituentEvent, type ConstituentKind, type StoredConstituent,
} from './model';
import { parseRow } from '../data/parse-rows';
import { propertyOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import { settled } from '../stages/settled';

// The constituents' writes (PRD 871). In production, the functions of
// supabase/migrations/20261029090000_constituents.sql, called as the signed-in person:
// constituent_add(), constituent_edit() and constituent_remove(), each answering the saved row and
// logging its event in the same transaction, or refusing: 42501 not an owner, P0002 gone, 22023 invalid
// with the field in `hint`. In the demo, the same rules kept in memory, history included, so the panel
// can be tried with no database.

export type SavedConstituent = { ok: true; constituent: Constituent } | { ok: false; message: string };

export interface ConstituentPort {
  /** Adds the product's Statement (refused while one is live) or a Never line, numbered after every
   * line the product ever had. */
  add(product: string, kind: ConstituentKind, text: string): Promise<SavedConstituent>;
  /** Rewrites a live constituent; the same text changes nothing. */
  edit(constituent: string, text: string): Promise<SavedConstituent>;
  /** Removes a live constituent: kept, marked removed, its id never reused. */
  remove(constituent: string): Promise<SavedConstituent>;
}

export const NOT_OWNER = 'Only an owner of the workspace can change its constituents.';
export const GONE = 'That line is no longer here. Reload the page.';
export const COULD_NOT_SAVE = 'Couldn’t save this. Try again in a moment.';

/** What a 22023 says, by the field its `hint` names. */
export const INVALID_FIELD: Readonly<Record<string, string>> = {
  text: `One line: a Statement up to ${STATEMENT_MAX} characters, a Never line up to ${NEVER_MAX}.`,
  kind: 'This product has a Statement already: edit it.',
  product: 'Reload the page, then add the line again.',
};
const INVALID = 'That can’t be saved. Check the text.';

/** An error as PostgREST answers it, or anything thrown, as the panel says it. */
export function constituentRefusalOf(error: unknown): string {
  const code = propertyOf(error, 'code');
  const hint = propertyOf(error, 'hint');
  if (code === '42501') return NOT_OWNER;
  if (code === 'P0002') return GONE;
  if (code === '22023') return INVALID_FIELD[String(hint)] ?? INVALID;
  return COULD_NOT_SAVE;
}

type Rpc = { rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }> };

export function databaseConstituents(db: Rpc, workspace: string): ConstituentPort {
  const call = async (fn: string, args: Record<string, unknown>): Promise<SavedConstituent> => {
    try {
      const { data, error } = await db.rpc(fn, { p_workspace: workspace, ...args });
      if (error || !data) return { ok: false, message: constituentRefusalOf(error) };
      const saved = parseRow(SavedConstituentRow, data, `constituents/store: ${fn}`);
      return saved.ok ? { ok: true, constituent: constituentOf(saved.value) } : { ok: false, message: COULD_NOT_SAVE };
    } catch (err) {
      return { ok: false, message: constituentRefusalOf(err) };
    }
  };
  return {
    add: (product, kind, text) => call('constituent_add', { p_product: product, p_kind: kind, p_text: text }),
    edit: (constituent, text) => call('constituent_edit', { p_constituent: constituent, p_text: text }),
    remove: (constituent) => call('constituent_remove', { p_constituent: constituent }),
  };
}

/** constituent_text()'s rule: trimmed, on one line, within the kind's length; null when it breaks it. */
function textOf(text: string, kind: ConstituentKind): string | null {
  const v = text.trim();
  const most = kind === 'statement' ? STATEMENT_MAX : NEVER_MAX;
  return v.length < 1 || v.length > most || /[\r\n\t]/.test(v) ? null : v;
}

/** The demo's port: the functions' rules on constituents kept in memory, and the history they log. */
export type DemoConstituentPort = ConstituentPort & {
  constituents(): Constituent[];
  history(): ConstituentEvent[];
};

export function demoConstituentsPort(
  { products, by, now = () => new Date().toISOString() }: { products: readonly string[]; by: string; now?: () => string },
): DemoConstituentPort {
  const rows = new Map<string, StoredConstituent>();
  const events: ConstituentEvent[] = [];
  let made = 0;
  const refused = (field: string): SavedConstituent => ({ ok: false, message: INVALID_FIELD[field] ?? INVALID });
  const log = (row: StoredConstituent, action: ConstituentEvent['action'], before: string | null, after: string | null) => {
    events.push({ id: events.length + 1, product: row.product_id, constituent: row.id, action, before, after, note: null, by, at: now() });
  };
  const live = (id: string) => {
    const row = rows.get(id);
    return row && row.removed_at === null ? row : null;
  };
  const saved = (row: StoredConstituent): SavedConstituent => ({ ok: true, constituent: constituentOf(row) });
  return {
    add(product, kind, text) {
      return settled(() => {
        const v = textOf(text, kind);
        if (v === null) return refused('text');
        if (!products.includes(product)) return { ok: false, message: GONE };
        const mine = [...rows.values()].filter((r) => r.product_id === product);
        if (kind === 'statement' && mine.some((r) => r.kind === 'statement' && r.removed_at === null)) return refused('kind');
        const seq = kind === 'never' ? Math.max(0, ...mine.filter((r) => r.kind === 'never').map((r) => r.seq ?? 0)) + 1 : null;
        made += 1;
        const at = now();
        const row: StoredConstituent = {
          id: `demo-constituent-${made}`, product_id: product, kind, seq, body: v, created_by: by,
          created_at: at, updated_at: at, removed_at: null, removed_by: null,
        };
        rows.set(row.id, row);
        log(row, 'added', null, v);
        return saved(row);
      });
    },
    edit(id, text) {
      return settled(() => {
        const was = live(id);
        if (!was) return { ok: false, message: GONE };
        const v = textOf(text, was.kind);
        if (v === null) return refused('text');
        if (v === was.body) return saved(was);
        const row = { ...was, body: v, updated_at: now() };
        rows.set(id, row);
        log(row, 'edited', was.body, v);
        return saved(row);
      });
    },
    remove(id) {
      return settled(() => {
        const was = live(id);
        if (!was) return { ok: false, message: GONE };
        const at = now();
        const row = { ...was, removed_at: at, removed_by: by, updated_at: at };
        rows.set(id, row);
        log(row, 'removed', was.body, null);
        return saved(row);
      });
    },
    constituents: () => [...rows.values()].map(constituentOf),
    history: () => [...events].reverse(),
  };
}
