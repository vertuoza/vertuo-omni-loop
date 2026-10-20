import 'server-only';
import { DEMO_PERSONAS } from '../../business/BusinessScreen';
import { loginsOf } from '../constituents/authors.repository';
import { knowledgeReader, writeSourceOf, type WriteSource } from '../constituents/knowledge-reader';
import { storedPersonasOf } from './personas.repository';
import { personaRowsOf, type PersonaRow } from './personas-section';

// The Personas section's read (PRD 2240 s4), as the signed-in person: every persona of the product,
// with who made it and when. Personas that cannot be read leave the section saying so.

export interface PersonasData {
  source: WriteSource;
  rows: PersonaRow[];
}

/** The sample personas, as the demo's product holds them. */
const demoRows = (product: string): PersonaRow[] =>
  DEMO_PERSONAS.map((persona) => ({ persona: { ...persona, product }, by: { user: 'demo-you', login: 'you' }, createdAt: '2026-10-22T09:00:00Z' }));

/** The product's personas, or null when they cannot be read. */
export async function loadPersonasData(product: string): Promise<PersonasData | null> {
  const reader = await knowledgeReader();
  if (reader.kind !== 'database') return reader.kind === 'demo' ? { source: { kind: 'demo' }, rows: demoRows(product) } : null;
  const [stored, logins] = await Promise.all([storedPersonasOf(reader.db, product), loginsOf(reader.db, reader.workspace)]);
  return stored === null ? null : { source: writeSourceOf(reader), rows: personaRowsOf(stored, logins) };
}
