import type { ListColumn } from '../../nav/SortableList';
import type { Query } from '../../nav/query';
import { newestFirst, sortOf, type Sort } from '../../nav/sortable-list';
import type { StoredConstituent } from '../../constituents/model';
import type { Person } from '../product-knowledge.contract';
import type { Show } from '../knowledge-sections';

// The Constituents section of the Knowledge home (PRD 2240 s4): the Statement and the Never lines of a
// product as rows of a sortable list, their addresses and what a cell shows. Pure: the pages draw from it.

export type ConstituentKindLabel = 'Statement' | 'Never';

export interface ConstituentRow {
  /** The item's address segment: `statement`, `never-3`. */
  key: string;
  /** The constituent's id in the database. */
  id: string;
  kind: ConstituentKindLabel;
  text: string;
  by: Person;
  createdAt: string;
  updatedAt: string;
  removed: boolean;
  /** When it was removed, or null while it is live. */
  removedAt: string | null;
}

/** The address segment of a constituent: `statement`, or `never-<seq>` (the panel's `#never-<n>` anchor). */
export const keyOf = (row: Pick<StoredConstituent, 'kind' | 'seq'>): string => (row.kind === 'statement' ? 'statement' : `never-${row.seq}`);

/** Every stored constituent as a row, its author named by `logins` (account id to GitHub login). */
export function rowsOf(stored: readonly StoredConstituent[], logins: Readonly<Record<string, string>>): ConstituentRow[] {
  return stored.map((row) => ({
    key: keyOf(row),
    id: row.id,
    kind: row.kind === 'statement' ? 'Statement' : 'Never',
    text: row.body,
    by: row.created_by === null ? null : { user: row.created_by, login: logins[row.created_by] ?? null },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    removed: row.removed_at !== null,
    removedAt: row.removed_at,
  }));
}

/** The rows a list shows: the live lines, or the removed ones. */
export const shownRows = (rows: readonly ConstituentRow[], show: Show): ConstituentRow[] => rows.filter((r) => r.removed === (show === 'retired'));

/** A row by its address segment, or null. */
export const rowOf = (rows: readonly ConstituentRow[], key: string): ConstituentRow | null => rows.find((r) => r.key === key) ?? null;

/** A timestamp as the number a column sorts by; null when it is not one. */
export const timeOf = (at: string): number | null => (Number.isFinite(Date.parse(at)) ? Date.parse(at) : null);
/** A text a column sorts by; null when it is blank, so it sorts last. */
export const textOf = (text: string): string | null => (text.trim() ? text : null);
/** The name a person sorts by: their login, else their account; null for nobody. */
export const nameOf = (person: Person): string | null => person?.login ?? person?.user ?? null;

export const CONSTITUENT_COLUMNS: readonly ListColumn<ConstituentRow>[] = [
  { key: 'kind', label: 'Kind', natural: 'asc', value: (r) => r.kind },
  { key: 'text', label: 'Text', natural: 'asc', value: (r) => textOf(r.text) },
  { key: 'by', label: 'Created by', natural: 'asc', value: (r) => nameOf(r.by) },
  { key: 'created', label: 'Created', natural: 'desc', value: (r) => timeOf(r.createdAt) },
  { key: 'updated', label: 'Updated', natural: 'desc', value: (r) => timeOf(r.updatedAt) },
];

/** The sort the address asks for: newest first by default. */
export const constituentSortOf = (query: Query): Sort<ConstituentRow> =>
  sortOf(query, CONSTITUENT_COLUMNS, 'created', newestFirst<ConstituentRow>((r) => r.createdAt));
