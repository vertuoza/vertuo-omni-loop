import { parseRows } from '../data/parse-rows';
import {
  CONSTITUENT_COLUMNS, constituentOf, EVENT_COLUMNS, eventOf, StoredConstituent, StoredConstituentEvent,
  type Constituent, type ConstituentEvent,
} from './model';

// The constituents' read for Settings › Business (PRD 871), as the signed-in person, so row-level
// security decides what it returns: every constituent of the given products, removed ones included (the
// history names them), and their whole history. Members and owners read the same; only the controls
// differ. Unreadable, it says so, and the page still opens without the panel.

export type ConstituentsLoad =
  | { ok: true; constituents: Constituent[]; events: ConstituentEvent[] }
  | { ok: false; reason: string };

type Query<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/** The slice of a Supabase client the read needs. */
export type ConstituentsDb = {
  from(table: 'constituents' | 'constituent_events'): {
    select(columns: string): { in(column: 'product_id', values: string[]): Query<unknown> };
  };
};

export async function loadConstituents(db: ConstituentsDb, products: readonly string[]): Promise<ConstituentsLoad> {
  if (products.length === 0) return { ok: true, constituents: [], events: [] };
  const ids = [...products];
  try {
    const [rows, history] = await Promise.all([
      db.from('constituents').select(CONSTITUENT_COLUMNS).in('product_id', ids),
      db.from('constituent_events').select(EVENT_COLUMNS).in('product_id', ids),
    ]);
    const error = rows.error ?? history.error;
    if (error) return { ok: false, reason: `Supabase: could not read the constituents (${error.message})` };
    const constituents = parseRows(StoredConstituent, rows.data, 'constituents/load: constituents');
    if (!constituents.ok) return { ok: false, reason: constituents.error };
    const events = parseRows(StoredConstituentEvent, history.data, 'constituents/load: constituent_events');
    if (!events.ok) return { ok: false, reason: events.error };
    return { ok: true, constituents: constituents.value.map(constituentOf), events: events.value.map(eventOf) };
  } catch (err) {
    return { ok: false, reason: `Supabase: could not read the constituents (${err instanceof Error ? err.message : String(err)})` };
  }
}
