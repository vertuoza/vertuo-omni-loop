import { describe, it, expect } from 'vitest';
import { item } from '../ask/test/test-item';
import { byId, cited, entriesOf, lanes, matches, orbits, servedBy, serving, systems, type KnowledgeEntry, type KnowledgeGraph } from './knowledge';

const entry = (id: string, kind: KnowledgeEntry['kind'], domain: string | null, over: Partial<KnowledgeEntry> = {}): KnowledgeEntry => ({
  id, kind, domain, domains: domain ? [domain] : [], statement: `${id} holds.`, why: null, status: 'law', serves: null,
  enforced: false, enforcedBy: null, prd: null, file: `.omni-loop/knowledge/${domain ?? 'cross-domain'}.md`, ...over,
});

// Deliberately out of id order, as registers written by hand often are: P-PRODUCT-10 before P-PRODUCT-2.
const GRAPH: KnowledgeGraph = {
  version: 1,
  repo: 'acme/widgets',
  domains: [
    { name: 'product', code: 'PRODUCT', scope: 'product', counts: { principles: 3, rules: 2, invariants: 1, laws: 5, proposed: 1 } },
    { name: 'advisor', code: 'ADVISOR', scope: 'domain', counts: { principles: 0, rules: 0, invariants: 0, laws: 0, proposed: 0 } },
    { name: 'quote', code: 'QUOTE', scope: 'domain', counts: { principles: 1, rules: 1, invariants: 0, laws: 1, proposed: 1 } },
  ],
  entries: [
    entry('P-PRODUCT-10', 'principle', 'product', { statement: 'The outbox gate stays red until a person answers.' }),
    entry('P-PRODUCT-2', 'principle', 'product', { why: 'An unconfirmed signal never counts against the claimant.' }),
    entry('P-PRODUCT-1', 'principle', 'product', { status: 'proposed' }),
    entry('BR-PRODUCT-2', 'rule', 'product', { serves: 'P-PRODUCT-2', statement: 'A stale claim is taken back, as BR-PRODUCT-10 says.' }),
    entry('BR-PRODUCT-10', 'rule', 'product', { serves: 'P-PRODUCT-2' }),
    entry('N-PRODUCT-1', 'invariant', 'product', { serves: 'P-PRODUCT-10' }),
    entry('P-QUOTE-1', 'principle', 'quote', { status: 'proposed' }),
    entry('BR-QUOTE-1', 'rule', 'quote', { serves: 'P-QUOTE-1' }),
    entry('X-ADVISOR-QUOTE-1', 'rule', null, { domains: ['advisor', 'quote'], serves: 'P-QUOTE-1' }),
    entry('X-ADVISOR-QUOTE-2', 'invariant', null, { domains: ['advisor', 'quote'] }),
  ],
  links: [
    { from: 'BR-PRODUCT-2', to: 'P-PRODUCT-2', kind: 'serves' },
    { from: 'BR-PRODUCT-2', to: 'BR-PRODUCT-10', kind: 'cites' },
    { from: 'BR-PRODUCT-10', to: 'P-PRODUCT-2', kind: 'serves' },
    { from: 'N-PRODUCT-1', to: 'P-PRODUCT-10', kind: 'serves' },
    { from: 'BR-QUOTE-1', to: 'P-QUOTE-1', kind: 'serves' },
    { from: 'X-ADVISOR-QUOTE-1', to: 'P-QUOTE-1', kind: 'serves' },
  ],
  loose: ['X-ADVISOR-QUOTE-2'],
  unserved: ['P-PRODUCT-1'],
};

const ids = (entries: KnowledgeEntry[]) => entries.map((e) => e.id);

describe('byId — id order, numbers read as numbers', () => {
  it('puts P-PRODUCT-2 before P-PRODUCT-10, and N2 before N10', () => {
    expect(['P-PRODUCT-10', 'P-PRODUCT-2', 'P-PRODUCT-1'].sort(byId)).toEqual(['P-PRODUCT-1', 'P-PRODUCT-2', 'P-PRODUCT-10']);
    expect(['N10', 'N2', 'N1'].sort(byId)).toEqual(['N1', 'N2', 'N10']);
  });
});

describe('systems — one per domain, the product first', () => {
  it('lists the product, then each domain by name, each with how many entries it holds', () => {
    const shuffled: KnowledgeGraph = { ...GRAPH, domains: [item(GRAPH.domains, 2), item(GRAPH.domains, 1), item(GRAPH.domains, 0)] };
    for (const graph of [GRAPH, shuffled]) {
      expect(systems(graph).map(({ name, scope, size }) => `${name} ${scope} ${size}`)).toEqual(['product product 6', 'advisor domain 0', 'quote domain 2']);
    }
  });

  it('lists none for an empty graph', () => {
    expect(systems({ ...GRAPH, domains: [], entries: [], links: [], loose: [], unserved: [] })).toEqual([]);
  });
});

describe('lanes — the cross-domain entries, by pair', () => {
  it('groups the cross-domain entries by their pair, in id order', () => {
    expect(lanes(GRAPH).map(({ pair, entries }) => `${pair.join('--')} ${ids(entries).join(',')}`)).toEqual(['advisor--quote X-ADVISOR-QUOTE-1,X-ADVISOR-QUOTE-2']);
  });
});

describe('orbits — a domain by kind, inner to outer, each in id order', () => {
  it('seats principles, then rules, then invariants, in id order', () => {
    const product = orbits(entriesOf(GRAPH, 'product'));
    expect(product.map(({ kind, entries }) => `${kind}: ${ids(entries).join(' ')}`)).toEqual([
      'principle: P-PRODUCT-1 P-PRODUCT-2 P-PRODUCT-10',
      'rule: BR-PRODUCT-2 BR-PRODUCT-10',
      'invariant: N-PRODUCT-1',
    ]);
  });

  it('keeps an empty orbit, so every system has the same three', () => {
    expect(orbits(entriesOf(GRAPH, 'quote')).map(({ kind, entries }) => `${kind} ${entries.length}`)).toEqual(['principle 1', 'rule 1', 'invariant 0']);
    expect(orbits(entriesOf(GRAPH, 'advisor')).map(({ entries }) => entries.length)).toEqual([0, 0, 0]);
  });

  it('reads the cross-domain entries as no single domain’s', () => {
    expect(ids(entriesOf(GRAPH, 'advisor'))).toEqual([]);
    expect(ids(entriesOf(GRAPH, 'quote'))).toEqual(['P-QUOTE-1', 'BR-QUOTE-1']);
  });
});

describe('served-by, serving and cited — read from the links', () => {
  it('lists what serves a principle, in id order, across domains', () => {
    expect(ids(servedBy(GRAPH, 'P-PRODUCT-2'))).toEqual(['BR-PRODUCT-2', 'BR-PRODUCT-10']);
    expect(ids(servedBy(GRAPH, 'P-QUOTE-1'))).toEqual(['BR-QUOTE-1', 'X-ADVISOR-QUOTE-1']);
    expect(servedBy(GRAPH, 'P-PRODUCT-1')).toEqual([]);
  });

  it('names the principle an entry serves, only through a link', () => {
    expect(serving(GRAPH, 'N-PRODUCT-1')?.id).toBe('P-PRODUCT-10');
    expect(serving(GRAPH, 'X-ADVISOR-QUOTE-2')).toBeNull();
    expect(serving(GRAPH, 'P-PRODUCT-2')).toBeNull();
  });

  it('lists the entries an entry cites', () => {
    expect(ids(cited(GRAPH, 'BR-PRODUCT-2'))).toEqual(['BR-PRODUCT-10']);
    expect(cited(GRAPH, 'BR-PRODUCT-10')).toEqual([]);
  });
});

describe('matches — the filter', () => {
  const find = (query: string) => ids(GRAPH.entries.filter((e) => matches(e, query)));

  it('matches everything when the filter is empty or blank', () => {
    expect(find('')).toHaveLength(GRAPH.entries.length);
    expect(find('   ')).toHaveLength(GRAPH.entries.length);
  });

  it('matches an id, in any case, whole or in part', () => {
    expect(find('n-product-1')).toEqual(['N-PRODUCT-1']);
    // BR-PRODUCT-2 names BR-PRODUCT-10 in its statement, so it matches too.
    expect(find('BR-PRODUCT-10')).toEqual(['BR-PRODUCT-2', 'BR-PRODUCT-10']);
    expect(find('X-ADVISOR')).toEqual(['X-ADVISOR-QUOTE-1', 'X-ADVISOR-QUOTE-2']);
  });

  it('matches words of the statement or the Why:, every word of the filter', () => {
    expect(find('outbox')).toEqual(['P-PRODUCT-10']);
    expect(find('Claimant')).toEqual(['P-PRODUCT-2']);
    expect(find('stale claim')).toEqual(['BR-PRODUCT-2']);
    expect(find('outbox claimant')).toEqual([]);
  });
});
