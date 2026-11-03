import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sortRows } from '../nav/sortable-list';
import {
  DOMAIN_COLUMNS, FIRST_SECTION, activeDomains, domainFilterOf, domainHref, retiredAmong, termsNaming, termsOfDomain, SECTION_KEYS, backHref, countsOf, dayOf, domainOf, domainSortOf, excerpt, glossarySortOf, itemHref, knowledgeSectionTabs,
  legalEntryOf, legalSortOf, listSectionOf, sectionHref, sectionOf, segmentOf, showHref, showOf, shownEntries, termOf, whoOf,
} from './knowledge-sections';
import { demoKnowledgeTab } from './KnowledgeTab';
import type { KnowledgeTab } from './product-knowledge.contract';

const TAB = demoKnowledgeTab('demo-product-1') as KnowledgeTab;
const LEGAL = TAB.legal.entries[0] as (typeof TAB.legal.entries)[number];
const DOMAIN = TAB.domains.entries[0] as (typeof TAB.domains.entries)[number];
const entry = (id: string, over: Partial<typeof LEGAL> = {}) => ({ ...LEGAL, entry: id, id, ...over });
const domain = (key: string, over: Partial<typeof DOMAIN> = {}) => ({ ...DOMAIN, entry: `d-${key}`, key, ...over });

describe('a save', () => {
  it('refreshes the page in place and never reloads it, so the address and its sort stay', () => {
    const source = readFileSync(new URL('./KnowledgeTabPage.tsx', import.meta.url), 'utf8');
    expect(source).toContain('router.refresh()');
    expect(source).not.toContain('location.reload');
  });
});

describe('the sections', () => {
  it('are eight, in the sub-menu\'s order, Domains after Glossary, Knowledge opening on the first', () => {
    expect(SECTION_KEYS).toEqual(['constituents', 'personas', 'legal', 'glossary', 'domains', 'pitch', 'repositories', 'settings']);
    expect(FIRST_SECTION).toBe('constituents');
  });

  it('have an address each under the product\'s Knowledge, and a section from a segment', () => {
    expect(sectionHref('p 1', 'legal')).toBe('/app/products/p%201/knowledge/legal');
    expect(itemHref('p', 'legal', 'L-GDPR-1')).toBe('/app/products/p/knowledge/legal/L-GDPR-1');
    expect(itemHref('p', 'domains', 'invoicing')).toBe('/app/products/p/knowledge/domains/invoicing');
    expect(sectionOf('glossary')).toBe('glossary');
    expect(sectionOf('domains')).toBe('domains');
    expect(sectionOf('graph')).toBeNull();
  });

  it('draw Legal, Glossary and Domains as lists of entries with a page each, and nothing else', () => {
    expect(listSectionOf('legal')).toBe('legal');
    expect(listSectionOf('glossary')).toBe('glossary');
    expect(listSectionOf('domains')).toBe('domains');
    expect(listSectionOf('pitch')).toBeNull();
    expect(listSectionOf('nope')).toBeNull();
  });

  it('give a count only to the sections whose items are read, and none at 0 once drawn', () => {
    const tabs = knowledgeSectionTabs('p', { legal: 3, glossary: 0, domains: 6 });
    expect(tabs.map((t) => t.label)).toEqual(['Constituents', 'Personas', 'Legal', 'Glossary', 'Domains', 'Pitch', 'Repositories', 'Settings']);
    expect(tabs.map((t) => t.count)).toEqual([undefined, undefined, 3, 0, 6, undefined, undefined, undefined]);
    expect(tabs[4]?.href).toBe('/app/products/p/knowledge/domains');
    expect(tabs[6]?.href).toBe('/app/products/p/knowledge/repositories');
    expect(tabs[0]?.href).toBe('/app/products/p/knowledge/constituents');
  });

  it('count active items only', () => {
    const tab = {
      ...TAB,
      legal: { ...TAB.legal, entries: [LEGAL, entry('x', { retiredAt: '2026-12-01' })] },
      domains: { ...TAB.domains, entries: [DOMAIN, domain('stock-v1', { retiredAt: '2026-12-01' })] },
    };
    expect(countsOf(tab)).toEqual({ legal: 1, glossary: 1, domains: 1 });
    expect(shownEntries(tab.legal.entries, 'retired').map((e) => e.id)).toEqual(['x']);
    expect(shownEntries(tab.domains.entries, 'retired').map((e) => e.key)).toEqual(['stock-v1']);
  });
});

describe('the domains', () => {
  it('find a domain by its key, retired ones too, and none for another', () => {
    const tab = { ...TAB, domains: { ...TAB.domains, entries: [DOMAIN, domain('stock-v1', { retiredAt: '2026-12-01' })] } };
    expect(domainOf(tab, 'invoicing')).toBe(DOMAIN);
    expect(domainOf(tab, 'stock-v1')?.retiredAt).toBe('2026-12-01');
    expect(domainOf(tab, 'Invoicing')).toBeNull();
  });

  it('sort by key, name or meaning, newest first by default', () => {
    const rows = [
      domain('stock', { name: 'Warehouse', createdAt: '2026-01-01T00:00:00Z' }),
      domain('billing', { name: 'Zebra', createdAt: '2026-03-01T00:00:00Z' }),
      domain('planning', { name: 'Agenda', createdAt: '2026-02-01T00:00:00Z' }),
    ];
    const keys = (query: Record<string, string>) => sortRows(rows, domainSortOf(query)).map((r) => r.key);
    expect(keys({})).toEqual(['billing', 'planning', 'stock']);
    expect(keys({ sort: 'key' })).toEqual(['billing', 'planning', 'stock']);
    expect(keys({ sort: 'key', dir: 'desc' })).toEqual(['stock', 'planning', 'billing']);
    expect(keys({ sort: 'name' })).toEqual(['planning', 'stock', 'billing']);
    expect(DOMAIN_COLUMNS.map((c) => c.label)).toEqual(['Key', 'Name', 'Meaning', 'Created by', 'Created']);
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


describe('a term\'s domains (PRD 2583 s2)', () => {
  const TERM = TAB.glossary.entries[0] as (typeof TAB.glossary.entries)[number];
  const terms = [
    { ...TERM, entry: 'a', term: 'Alpha', domains: ['invoicing'] },
    { ...TERM, entry: 'b', term: 'Beta', domains: [] },
    { ...TERM, entry: 'c', term: 'Gamma', domains: ['invoicing', 'planning'] },
    { ...TERM, entry: 'd', term: 'Delta', domains: ['invoicing'], removedAt: '2026-12-01T00:00:00Z' },
  ];
  const tab = { ...TAB, glossary: { ...TAB.glossary, entries: terms }, domains: { ...TAB.domains, entries: [DOMAIN, domain('planning'), domain('old', { retiredAt: '2026-12-01T00:00:00Z' })] } };

  it('reads ?domain=<key> as a filter, none for an empty or absent one, the first of several', () => {
    expect(domainFilterOf({ domain: 'invoicing' })).toBe('invoicing');
    expect(domainFilterOf({ domain: ' invoicing ' })).toBe('invoicing');
    expect(domainFilterOf({ domain: ['planning', 'invoicing'] })).toBe('planning');
    expect(domainFilterOf({ domain: '' })).toBeNull();
    expect(domainFilterOf({})).toBeNull();
  });

  it('keeps the terms that name the domain, every term without a filter, none for a key nothing names', () => {
    expect(termsOfDomain(terms, 'invoicing').map((t) => t.term)).toEqual(['Alpha', 'Gamma', 'Delta']);
    expect(termsOfDomain(terms, 'planning').map((t) => t.term)).toEqual(['Gamma']);
    expect(termsOfDomain(terms, null)).toHaveLength(4);
    expect(termsOfDomain(terms, 'nowhere')).toEqual([]);
  });

  it('puts the filter in an address beside the rest of the query, and takes it out for none', () => {
    expect(domainHref('/g', { sort: 'term', show: 'retired' }, 'planning')).toBe('/g?sort=term&show=retired&domain=planning');
    expect(domainHref('/g', { domain: 'invoicing', sort: 'term' }, 'planning')).toBe('/g?sort=term&domain=planning');
    expect(domainHref('/g', { domain: 'invoicing' }, null)).toBe('/g');
  });

  it('offers the active domains only, and finds which of a term\'s are retired', () => {
    expect(activeDomains(tab).map((d) => d.key)).toEqual(['invoicing', 'planning']);
    expect(retiredAmong(tab, ['invoicing', 'old'])).toEqual(['old']);
  });

  it('lists the live terms that name a domain for its page', () => {
    expect(termsNaming(tab, 'invoicing').map((t) => t.term)).toEqual(['Alpha', 'Gamma']);
  });

  it('sorts the glossary by its Domains column', () => {
    expect(sortRows(terms, glossarySortOf({ sort: 'domains' })).map((t) => t.term)).toEqual(['Alpha', 'Delta', 'Gamma', 'Beta']);
  });
});
