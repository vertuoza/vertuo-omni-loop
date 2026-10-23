import type { ListColumn } from '../nav/SortableList';
import type { Query } from '../nav/query';
import type { SectionTab } from '../nav/section-tabs';
import { newestFirst, sortOf, type Sort } from '../nav/sortable-list';
import { knowledgeTabHref, type GlossaryEntry, type KnowledgeTab, type LegalEntry, type Person } from './product-knowledge.contract';

// The Knowledge home's sections (PRD 2240 s3; Repositories, PRD 2419 s1): the seven entries of the sub-menu in their order, their
// addresses under /app/products/<id>/knowledge, the count each list section shows, and the rows and
// columns of the Legal and Glossary lists. Pure: the pages and the sub-menu draw from it.

export const SECTION_KEYS = ['constituents', 'personas', 'legal', 'glossary', 'pitch', 'repositories', 'settings'] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

interface SectionDef {
  label: string;
  /** A list section (a table of items, each with a page) rather than a form. */
  list: boolean;
}

export const SECTIONS: Readonly<Record<SectionKey, SectionDef>> = {
  constituents: { label: 'Constituents', list: true },
  personas: { label: 'Personas', list: true },
  legal: { label: 'Legal', list: true },
  glossary: { label: 'Glossary', list: true },
  pitch: { label: 'Pitch', list: false },
  repositories: { label: 'Repositories', list: false },
  settings: { label: 'Settings', list: false },
};

/** The section a path segment names; null for one the home has none of. */
export const sectionOf = (segment: string): SectionKey | null => SECTION_KEYS.find((key) => key === segment) ?? null;

/** The section Knowledge opens on. */
export const FIRST_SECTION: SectionKey = SECTION_KEYS[0];

export const sectionHref = (product: string, key: SectionKey): string => `${knowledgeTabHref(product)}/${key}`;
export const itemHref = (product: string, key: SectionKey, item: string): string => `${sectionHref(product, key)}/${encodeURIComponent(item)}`;

export const NO_LEGAL = 'No Legal entry yet.';
export const NO_TERMS = 'No term yet.';
export const NONE = '—';

/** Active and retired (or removed) items of a list. */
export type Show = 'active' | 'retired';

/** `?show=retired` asks for the retired items; anything else, the active ones. */
export const showOf = (query: Query): Show => ((Array.isArray(query.show) ? query.show[0] : query.show) === 'retired' ? 'retired' : 'active');

/** The two sections drawn as lists of entries with a page each, by their path segment; null for any other. */
export function listSectionOf(segment: string): 'legal' | 'glossary' | null {
  const key = sectionOf(segment);
  return key === 'legal' || key === 'glossary' ? key : null;
}

const isRetired = (entry: LegalEntry | GlossaryEntry): boolean => ('retiredAt' in entry ? entry.retiredAt : entry.removedAt) !== null;

/** The items a list shows, active ones or retired ones. */
export const shownEntries = <E extends LegalEntry | GlossaryEntry>(entries: readonly E[], show: Show): E[] =>
  entries.filter((e) => isRetired(e) === (show === 'retired'));

export interface Counts {
  legal: number;
  glossary: number;
}

/** How many active items each of the two sections this slice draws holds. */
export const countsOf = (tab: Pick<KnowledgeTab, 'legal' | 'glossary'>): Counts => ({
  legal: shownEntries(tab.legal.entries, 'active').length,
  glossary: shownEntries(tab.glossary.entries, 'active').length,
});

/** The sub-menu's tabs, in order; a count only on a section whose items are read here. */
export function knowledgeSectionTabs(product: string, counts: Counts): SectionTab[] {
  const count: Partial<Record<SectionKey, number>> = counts;
  return SECTION_KEYS.map((key) => {
    const n = count[key];
    return { href: sectionHref(product, key), label: SECTIONS[key].label, ...(n === undefined ? {} : { count: n }) };
  });
}

/** `path` with the query as given, `show` set (removed for the active items): the sort is kept. */
export function showHref(path: string, query: Query, show: Show): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (key === 'show' || value === undefined) continue;
    for (const v of Array.isArray(value) ? value : [value]) params.append(key, v);
  }
  if (show === 'retired') params.set('show', 'retired');
  const text = params.toString();
  return text === '' ? path : `${path}?${text}`;
}

/** An item's list, as the address says to come back to: the path and the whole query. */
export const backHref = (path: string, query: Query): string => showHref(path, query, showOf(query));

// ── Cells ──

/** One line of a text, ending in "…" when it is cut. */
export function excerpt(text: string, most = 80): string {
  const line = text.replace(/\s+/g, ' ').trim();
  return line.length > most ? `${line.slice(0, most - 1).trimEnd()}…` : line;
}

/** A person as a cell shows them; a missing author or one who left, a dash. */
export const whoOf = (person: Person): string => (person ? `@${person.login ?? 'a member'}` : NONE);

/** A timestamp as a day (UTC), or a dash. */
export const dayOf = (at: string | null): string => (at && at.length >= 10 ? at.slice(0, 10) : NONE);

const dateOf = (at: string): number | null => {
  const t = Date.parse(at);
  return Number.isNaN(t) ? null : t;
};

const word = (text: string): string | null => (text.trim() === '' ? null : text);
const author = (person: Person): string | null => (person ? (person.login ?? person.user) : null);

// ── Columns ──

type Column<R> = ListColumn<R>;

export const LEGAL_COLUMNS: readonly Column<LegalEntry>[] = [
  { key: 'code', label: 'Code', natural: 'asc', value: (e) => word(e.id) },
  { key: 'statement', label: 'Statement', natural: 'asc', value: (e) => word(e.statement) },
  { key: 'source', label: 'Source law', natural: 'asc', value: (e) => word(e.source) },
  { key: 'owner', label: 'Owner', natural: 'asc', value: (e) => author(e.owner) },
  { key: 'by', label: 'Created by', natural: 'asc', value: (e) => author(e.createdBy) },
  { key: 'created', label: 'Created', natural: 'desc', value: (e) => dateOf(e.createdAt) },
];

export const GLOSSARY_COLUMNS: readonly Column<GlossaryEntry>[] = [
  { key: 'term', label: 'Term', natural: 'asc', value: (e) => word(e.term) },
  { key: 'meaning', label: 'Meaning', natural: 'asc', value: (e) => word(e.meaning) },
  { key: 'by', label: 'Created by', natural: 'asc', value: (e) => author(e.createdBy) },
  { key: 'created', label: 'Created', natural: 'desc', value: (e) => dateOf(e.createdAt) },
];

/** The default order of both lists: newest first. */
const DEFAULT_COLUMN = 'created';

export const legalSortOf = (query: Query): Sort<LegalEntry> =>
  sortOf(query, LEGAL_COLUMNS, DEFAULT_COLUMN, newestFirst<LegalEntry>((e) => e.createdAt));

export const glossarySortOf = (query: Query): Sort<GlossaryEntry> =>
  sortOf(query, GLOSSARY_COLUMNS, DEFAULT_COLUMN, newestFirst<GlossaryEntry>((e) => e.createdAt));

// ── Items ──

/** A Legal entry by its code (`L-GDPR-1`), or null. */
export const legalEntryOf = (tab: Pick<KnowledgeTab, 'legal'>, code: string): LegalEntry | null => tab.legal.entries.find((e) => e.id === code) ?? null;

/** A glossary entry by its id, or null. */
export const termOf = (tab: Pick<KnowledgeTab, 'glossary'>, entry: string): GlossaryEntry | null => tab.glossary.entries.find((e) => e.entry === entry) ?? null;

/** A path segment as written in the address; a malformed one is left as it is. */
export function segmentOf(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
