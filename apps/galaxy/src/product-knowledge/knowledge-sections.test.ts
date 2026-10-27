import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sortRows } from '../nav/sortable-list';
import {
  FIRST_SECTION, SECTION_KEYS, backHref, countsOf, dayOf, excerpt, glossarySortOf, itemHref, knowledgeSectionTabs, legalEntryOf, legalSortOf, sectionHref,
  sectionOf, segmentOf, showHref, showOf, shownEntries, termOf, whoOf,
} from './knowledge-sections';
import { demoKnowledgeTab } from './KnowledgeTab';
import type { KnowledgeTab } from './product-knowledge.contract';

const TAB = demoKnowledgeTab('demo-product-1') as KnowledgeTab;
const LEGAL = TAB.legal.entries[0] as (typeof TAB.legal.entries)[number];
const entry = (id: string, over: Partial<typeof LEGAL> = {}) => ({ ...LEGAL, entry: id, id, ...over });

describe('a save', () => {
  it('refreshes the page in place and never reloads it, so the address and its sort stay', () => {
    const source = readFileSync(new URL('./KnowledgeTabPage.tsx', import.meta.url), 'utf8');
    expect(source).toContain('router.refresh()');
    expect(source).not.toContain('location.reload');
  });
});

describe('the sections', () => {
  it('are seven, in the sub-menu\'s order, Knowledge opening on the first', () => {
    expect(SECTION_KEYS).toEqual(['constituents', 'personas', 'legal', 'glossary', 'pitch', 'repositories', 'settings']);
    expect(FIRST_SECTION).toBe('constituents');
  });

  it('have an address each under the product\'s Knowledge, and a section from a segment', () => {
    expect(sectionHref('p 1', 'legal')).toBe('/app/products/p%201/knowledge/legal');
    expect(itemHref('p', 'legal', 'L-GDPR-1')).toBe('/app/products/p/knowledge/legal/L-GDPR-1');
    expect(sectionOf('glossary')).toBe('glossary');
    expect(sectionOf('graph')).toBeNull();
  });

  it('give a count only to the sections whose items are read, and none at 0 once drawn', () => {
    const tabs = knowledgeSectionTabs('p', { legal: 3, glossary: 0 });
    expect(tabs.map((t) => t.label)).toEqual(['Constituents', 'Personas', 'Legal', 'Glossary', 'Pitch', 'Repositories', 'Settings']);
    expect(tabs.map((t) => t.count)).toEqual([undefined, undefined, 3, 0, undefined, undefined, undefined]);
    expect(tabs[5]?.href).toBe('/app/products/p/knowledge/repositories');
    expect(tabs[0]?.href).toBe('/app/products/p/knowledge/constituents');
  });

  it('count active items only', () => {
    const tab = { ...TAB, legal: { ...TAB.legal, entries: [LEGAL, entry('x', { retiredAt: '2026-12-01' })] } };
    expect(countsOf(tab)).toEqual({ legal: 1, glossary: 1 });
    expect(shownEntries(tab.legal.entries, 'retired').map((e) => e.id)).toEqual(['x']);
  });
});

describe('the filters and the way back', () => {
  it('read ?show=retired, anything else is the active items', () => {
    expect(showOf({ show: 'retired' })).toBe('retired');
    expect(showOf({ show: 'other' })).toBe('active');
    expect(showOf({})).toBe('active');
  });

  it('keep the sort in every link', () => {
    expect(showHref('/l', { sort: 'code', dir: 'desc' }, 'retired')).toBe('/l?sort=code&dir=desc&show=retired');
    expect(showHref('/l', { sort: 'code', show: 'retired' }, 'active')).toBe('/l?sort=code');
    expect(showHref('/l', {}, 'active')).toBe('/l');
    expect(backHref('/l', { sort: 'by', show: 'retired' })).toBe('/l?sort=by&show=retired');
  });
});

describe('the cells', () => {
  it('cut a text to one line ending in an ellipsis, and leave a short one', () => {
    expect(excerpt('short')).toBe('short');
    expect(excerpt('a\n  b')).toBe('a b');
    expect(excerpt('x'.repeat(100), 10)).toBe(`${'x'.repeat(9)}…`);
  });

  it('read a person as @login, a missing or departed one as a dash, and a time as its day', () => {
    expect(whoOf({ user: 'u', login: 'anna' })).toBe('@anna');
    expect(whoOf({ user: 'u', login: null })).toBe('@a member');
    expect(whoOf(null)).toBe('—');
    expect(dayOf('2026-11-02T09:00:00Z')).toBe('2026-11-02');
    expect(dayOf(null)).toBe('—');
  });

  it('find an entry by its code or id, and decode a segment', () => {
    expect(legalEntryOf(TAB, 'L-INVOICING-1')).toBe(LEGAL);
    expect(legalEntryOf(TAB, 'nope')).toBeNull();
    expect(termOf(TAB, 'demo-term-1')?.term).toBe('Credit note');
    expect(segmentOf('a%20b')).toBe('a b');
    expect(segmentOf('%E0%A4%A')).toBe('%E0%A4%A');
  });
});

describe('the sort', () => {
  const rows = [
    entry('A', { createdAt: '2026-01-01T00:00:00Z', statement: 'b' }),
    entry('B', { createdAt: '2026-03-01T00:00:00Z', statement: 'a' }),
    entry('C', { createdAt: '2026-02-01T00:00:00Z', statement: 'c', createdBy: null }),
  ];
  const ids = (query: Record<string, string>) => sortRows(rows, legalSortOf(query)).map((r) => r.id);

  it('is newest first by default', () => {
    expect(ids({})).toEqual(['B', 'C', 'A']);
  });

  it('sorts every column both ways, an unknown column falling back to the default', () => {
    expect(ids({ sort: 'statement' })).toEqual(['B', 'A', 'C']);
    expect(ids({ sort: 'statement', dir: 'desc' })).toEqual(['C', 'A', 'B']);
    expect(ids({ sort: 'created', dir: 'asc' })).toEqual(['A', 'C', 'B']);
    expect(ids({ sort: 'nope' })).toEqual(['B', 'C', 'A']);
  });

  it('sorts an entry with no author last, whichever the direction, ties newest first', () => {
    expect(ids({ sort: 'by' })).toEqual(['B', 'A', 'C']);
    expect(ids({ sort: 'by', dir: 'desc' })).toEqual(['B', 'A', 'C']);
  });

  it('sorts the glossary by its own columns', () => {
    const terms = [TAB.glossary.entries[0], { ...(TAB.glossary.entries[0] as (typeof TAB.glossary.entries)[number]), entry: 'z', term: 'Apple' }] as (typeof TAB.glossary.entries);
    expect(sortRows(terms, glossarySortOf({ sort: 'term' })).map((t) => t.term)).toEqual(['Apple', 'Credit note']);
  });
});
