import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DEMO_PERSONAS } from '../../business/BusinessScreen';
import { PERSONA_COLUMNS, StoredPersona } from '../../business/personas';
import { parseRows } from '../../data/parse-rows';
import { z } from 'zod';
import { knowledgeReader, loginsOf, writeSourceOf, type WriteSource } from '../constituents/authors';
import { personaRowsOf, type PersonaRow, type StoredAuthoredPersona } from './personas-section';

// The Personas section's read (PRD 2240 s4), as the signed-in person: every persona of the product,
// with who made it and when. Personas that cannot be read leave the section saying so.

export interface PersonasData {
  source: WriteSource;
  rows: PersonaRow[];
}

const AuthoredPersona = StoredPersona.extend({ created_by: z.string().nullable(), created_at: z.string() });

const AUTHORED_COLUMNS = `${PERSONA_COLUMNS}, created_by, created_at`;

/** The sample personas, as the demo's product holds them. */
const demoRows = (product: string): PersonaRow[] =>
  DEMO_PERSONAS.map((persona) => ({ persona: { ...persona, product }, by: { user: 'demo-you', login: 'you' }, createdAt: '2026-10-22T09:00:00Z' }));

/** Every persona of the product, parsed; null when they cannot be read. */
async function storedRowsOf(db: Pick<SupabaseClient, 'from'>, product: string): Promise<StoredAuthoredPersona[] | null> {
  const stored = await db.from('personas').select(AUTHORED_COLUMNS).eq('product_id', product).order('ordinal');
  if (stored.error) console.error(`product-knowledge: could not read the personas (${stored.error.message})`);
  const parsed = parseRows(AuthoredPersona, stored.data, 'product-knowledge/personas-load: personas');
  return parsed.ok && !stored.error ? parsed.value : null;
}

/** The product's personas, or null when they cannot be read. */
export async function loadPersonasData(product: string): Promise<PersonasData | null> {
  const reader = await knowledgeReader();
  if (reader.kind !== 'database') return reader.kind === 'demo' ? { source: { kind: 'demo' }, rows: demoRows(product) } : null;
  const [stored, logins] = await Promise.all([storedRowsOf(reader.db, product), loginsOf(reader.db, reader.workspace)]);
  return stored === null ? null : { source: writeSourceOf(reader), rows: personaRowsOf(stored, logins) };
}
