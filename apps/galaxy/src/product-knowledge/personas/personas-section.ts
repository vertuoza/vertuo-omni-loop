import type { ListColumn } from '../../nav/SortableList';
import type { Query } from '../../nav/query';
import { newestFirst, sortOf, type Sort } from '../../nav/sortable-list';
import { personaOf, tradeLabel, type Persona, type StoredPersona } from '../../business/personas';
import type { Person } from '../product-knowledge.contract';
import { nameOf, textOf, timeOf } from '../constituents/constituents-section';

// The Personas section of the Knowledge home (PRD 2240 s4): a product's personas as rows of a sortable
// list. Pure: the pages draw from it. A persona with no author (the account left) reads "—" and sorts last.

/** A public.personas row with who made it and when, as the section reads it. */
export type StoredAuthoredPersona = StoredPersona & { created_by: string | null; created_at: string };

export interface PersonaRow {
  persona: Persona;
  by: Person;
  createdAt: string;
}

/** Every stored persona as a row, its author named by `logins` (account id to GitHub login). */
export function personaRowsOf(stored: readonly StoredAuthoredPersona[], logins: Readonly<Record<string, string>>): PersonaRow[] {
  return stored.map((row) => ({
    persona: personaOf(row),
    by: row.created_by === null ? null : { user: row.created_by, login: logins[row.created_by] ?? null },
    createdAt: row.created_at,
  }));
}

/** A persona's row by its id, or null. */
export const personaRowOf = (rows: readonly PersonaRow[], id: string): PersonaRow | null => rows.find((r) => r.persona.id === id) ?? null;

export const PERSONA_LIST_COLUMNS: readonly ListColumn<PersonaRow>[] = [
  { key: 'name', label: 'Name', natural: 'asc', value: (r) => textOf(r.persona.name) },
  { key: 'stance', label: 'Stance', natural: 'asc', value: (r) => r.persona.stance },
  { key: 'trade', label: 'Trade', natural: 'asc', value: (r) => textOf(tradeLabel(r.persona.trade)) },
  { key: 'by', label: 'Created by', natural: 'asc', value: (r) => nameOf(r.by) },
  { key: 'created', label: 'Created', natural: 'desc', value: (r) => timeOf(r.createdAt) },
];

/** The sort the address asks for: newest first by default. */
export const personaSortOf = (query: Query): Sort<PersonaRow> =>
  sortOf(query, PERSONA_LIST_COLUMNS, 'created', newestFirst<PersonaRow>((r) => r.createdAt));
