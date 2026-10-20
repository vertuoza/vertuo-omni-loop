import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Constituents } from '../../business/constituents-panel';
import { loadConstituentsPanel } from '../../business/constituents-load';
import { DEMO_CONSTITUENTS } from '../../business/BusinessScreen';
import { CONSTITUENT_COLUMNS, StoredConstituent } from '../../constituents/model';
import { parseRows } from '../../data/parse-rows';
import { knowledgeReader, loginsOf, writeSourceOf, type KnowledgeReader, type WriteSource } from './authors';
import { rowsOf, type ConstituentRow } from './constituents-section';

// The Constituents section's read (PRD 2240 s4), as the signed-in person, so row-level security decides
// what it returns: every line of the product, removed ones included (the Retired filter and the history
// name them), the panel's own read (the history, whether the person owns the workspace, the people the
// history names) and who created each line. A line that cannot be read leaves the section saying so.

export interface ConstituentsData {
  source: WriteSource;
  rows: ConstituentRow[];
  /** What ConstituentsPanel draws from: the lines, their history, the person's role and account. */
  read: Constituents;
}

/** Every line of the product, parsed; null when they cannot be read. */
async function storedRowsOf(db: Pick<SupabaseClient, 'from'>, product: string): Promise<StoredConstituent[] | null> {
  const stored = await db.from('constituents').select(CONSTITUENT_COLUMNS).eq('product_id', product);
  if (stored.error) console.error(`product-knowledge: could not read the constituents (${stored.error.message})`);
  const parsed = parseRows(StoredConstituent, stored.data, 'product-knowledge/constituents-load: constituents');
  return parsed.ok && !stored.error ? parsed.value : null;
}

/** The product's constituents as a member reads them, or null when they cannot be read. */
async function loadAsMember(reader: Extract<KnowledgeReader, { kind: 'database' }>, product: string): Promise<ConstituentsData | null> {
  const [panel, stored, logins] = await Promise.all([
    loadConstituentsPanel(reader.db, reader.workspace, [product]),
    storedRowsOf(reader.db, product),
    loginsOf(reader.db, reader.workspace),
  ]);
  if (stored === null || panel.constituents === null) return null;
  return { source: writeSourceOf(reader), rows: rowsOf(stored, logins), read: { ...panel, me: reader.me } };
}

/** The product's constituents, or null when they cannot be read. */
export async function loadConstituentsData(product: string): Promise<ConstituentsData | null> {
  const reader = await knowledgeReader();
  if (reader.kind === 'demo') return { source: { kind: 'demo' }, rows: [], read: DEMO_CONSTITUENTS };
  return reader.kind === 'database' ? loadAsMember(reader, product) : null;
}
