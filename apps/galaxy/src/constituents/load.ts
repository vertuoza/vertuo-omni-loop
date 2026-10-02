import {
  CONSTITUENT_COLUMNS, constituentOf, EVENT_COLUMNS, eventOf,
  type Constituent, type ConstituentEvent, type StoredConstituent, type StoredConstituentEvent,
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
    return {
      ok: true,
      constituents: ((rows.data ?? []) as StoredConstituent[]).map(constituentOf), // ts-allow: the select names CONSTITUENT_COLUMNS, the columns of StoredConstituent
      events: ((history.data ?? []) as StoredConstituentEvent[]).map(eventOf), // ts-allow: the select names EVENT_COLUMNS, the columns of StoredConstituentEvent
    };
  } catch (err) {
    return { ok: false, reason: `Supabase: could not read the constituents (${err instanceof Error ? err.message : String(err)})` };
  }
}
