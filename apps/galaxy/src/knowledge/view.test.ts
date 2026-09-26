import { describe, it, expect } from 'vitest';
import type { KnowledgeGraph } from '../data/knowledge';
import { entry, GRAPH } from './fixture';
import { BETWEEN, entryHref, indexOf, select, tabEntries, tabs, type IndexRow } from './view';

const rows = (list: IndexRow[]) => list.map((row) => `${row.role}${row.foreign ? '*' : ''} ${row.entry.id}`);

describe('tabs — one per domain, then Between domains', () => {
  it('lists the product first, then each domain by name, each with its entry count, then the cross-domain entries', () => {
    expect(tabs(GRAPH)).toEqual([
      { key: 'product', label: 'product', count: 8 },
      { key: 'billing', label: 'billing', count: 2 },
      { key: BETWEEN, label: 'Between domains', count: 1 },
    ]);
  });

  it('has no Between domains tab when no entry is cross-domain', () => {
    const graph: KnowledgeGraph = { ...GRAPH, entries: GRAPH.entries.filter((e) => e.domain !== null) };
    expect(tabs(graph).map((t) => t.key)).toEqual(['product', 'billing']);
  });

  it('holds each tab’s entries: a domain’s own, or every cross-domain one', () => {
    expect(tabEntries(GRAPH, 'billing').map((e) => e.id)).toEqual(['P-BILLING-1', 'BR-BILLING-1']);
    expect(tabEntries(GRAPH, BETWEEN).map((e) => e.id)).toEqual(['X-BILLING-PRODUCT-1']);
    expect(tabEntries(GRAPH, 'nowhere')).toEqual([]);
  });
});

describe('select — what the address opens', () => {
  it('opens the product with its first principle selected by default', () => {
    expect(select(GRAPH, {})).toEqual({ domain: 'product', entry: 'P-PRODUCT-1' });
    expect(select(GRAPH, { domain: 'nowhere', entry: 'NOPE-1' })).toEqual({ domain: 'product', entry: 'P-PRODUCT-1' });
  });

  it('opens the entry the address names, in its own tab whatever the domain says', () => {
    expect(select(GRAPH, { domain: 'product', entry: 'BR-PRODUCT-2' })).toEqual({ domain: 'product', entry: 'BR-PRODUCT-2' });
    expect(select(GRAPH, { domain: 'product', entry: 'BR-BILLING-1' })).toEqual({ domain: 'billing', entry: 'BR-BILLING-1' });
    expect(select(GRAPH, { entry: 'X-BILLING-PRODUCT-1' })).toEqual({ domain: BETWEEN, entry: 'X-BILLING-PRODUCT-1' });
  });

  it('opens a tab on its first principle, or its first entry when it has none', () => {
    expect(select(GRAPH, { domain: 'billing' })).toEqual({ domain: 'billing', entry: 'P-BILLING-1' });
    expect(select(GRAPH, { domain: BETWEEN })).toEqual({ domain: BETWEEN, entry: 'X-BILLING-PRODUCT-1' });
  });

  it('selects nothing in an empty tab, and opens nothing in an empty graph', () => {
    const graph: KnowledgeGraph = { ...GRAPH, domains: [...GRAPH.domains, { name: 'advisor', code: 'ADVISOR', scope: 'domain', counts: { principles: 0, rules: 0, invariants: 0, laws: 0, proposed: 0 } }] };
    expect(select(graph, { domain: 'advisor' })).toEqual({ domain: 'advisor', entry: null });
    expect(select({ ...GRAPH, domains: [], entries: [], links: [], loose: [], unserved: [] }, {})).toBeNull();
  });
});

describe('entryHref — the address of one entry', () => {
  it('names the domain and the entry', () => {
    expect(entryHref({ domain: 'product', entry: 'BR-PRODUCT-3' })).toBe('/knowledge?domain=product&entry=BR-PRODUCT-3');
    expect(entryHref({ domain: 'billing', entry: null })).toBe('/knowledge?domain=billing');
  });
});

describe('indexOf — the index, grouped by principle', () => {
  it('lists each served principle followed by its rules then its invariants, then the loose entries, then the unserved principles', () => {
    const index = indexOf(GRAPH, tabEntries(GRAPH, 'product'));
    expect(rows(index.grouped)).toEqual([
      'principle P-PRODUCT-1', 'member BR-PRODUCT-1', 'member N-PRODUCT-1',
      'principle P-PRODUCT-2', 'member BR-PRODUCT-2',
    ]);
    expect(rows(index.loose)).toEqual(['loose BR-PRODUCT-3', 'loose N-PRODUCT-2']);
    expect(rows(index.unserved)).toEqual(['unserved P-PRODUCT-3']);
  });

  it('lists every entry of the tab exactly once', () => {
    for (const tab of tabs(GRAPH)) {
      const index = indexOf(GRAPH, tabEntries(GRAPH, tab.key));
      const listed = [...index.grouped, ...index.loose, ...index.unserved].filter((row) => !row.foreign).map((row) => row.entry.id);
      expect(listed.sort(), tab.key).toEqual(tabEntries(GRAPH, tab.key).map((e) => e.id).sort());
    }
  });

  it('heads a group with a principle of another domain when an entry here serves it, marked as foreign', () => {
    expect(rows(indexOf(GRAPH, tabEntries(GRAPH, 'billing')).grouped)).toEqual([
      'principle P-BILLING-1',
      'principle* P-PRODUCT-2', 'member BR-BILLING-1',
    ]);
    expect(rows(indexOf(GRAPH, tabEntries(GRAPH, BETWEEN)).grouped)).toEqual(['principle* P-BILLING-1', 'member X-BILLING-PRODUCT-1']);
  });

  it('leaves only the entries the filter matches, by id or by words', () => {
    const product = tabEntries(GRAPH, 'product');
    const index = indexOf(GRAPH, product, 'outbox');
    expect(rows(index.grouped)).toEqual(['principle P-PRODUCT-2', 'member BR-PRODUCT-2']);
    expect(index.loose).toEqual([]);
    expect(index.unserved).toEqual([]);
    expect(rows(indexOf(GRAPH, product, 'n-product').loose)).toEqual(['loose N-PRODUCT-2']);
    expect(rows(indexOf(GRAPH, product, 'claim').grouped)).toEqual(['principle P-PRODUCT-1', 'member BR-PRODUCT-1', 'member N-PRODUCT-1']);
  });

  it('leaves out a principle the filter does not match, even when a rule under it matches', () => {
    expect(rows(indexOf(GRAPH, tabEntries(GRAPH, 'product'), 'draft').grouped)).toEqual(['member BR-PRODUCT-1']);
  });

  it('lists nothing for an empty tab', () => {
    expect(indexOf(GRAPH, [])).toEqual({ grouped: [], loose: [], unserved: [] });
  });

  it('orders members by kind, then by id with numbers read as numbers', () => {
    const graph: KnowledgeGraph = {
      ...GRAPH,
      entries: [...GRAPH.entries, entry('BR-PRODUCT-10', 'rule', 'product', { serves: 'P-PRODUCT-1' })],
      links: [...GRAPH.links, { from: 'BR-PRODUCT-10', to: 'P-PRODUCT-1', kind: 'serves' }],
    };
    expect(rows(indexOf(graph, tabEntries(graph, 'product')).grouped).slice(0, 4)).toEqual([
      'principle P-PRODUCT-1', 'member BR-PRODUCT-1', 'member BR-PRODUCT-10', 'member N-PRODUCT-1',
    ]);
  });
});
