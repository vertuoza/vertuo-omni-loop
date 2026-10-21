import { describe, expect, it } from 'vitest';
import type { RepositoryGraph } from 'omni-loop/kit/lib/knowledge/graph-schema.ts';
import { joinProductGraph, type ProductSources } from './join';

// joinProductGraph (PRD 1798 s3): every repository of a product, joined with the product's own Legal
// entries, Glossary terms and Never lines, into one graph. A pure function on small graphs: no database.

const SHA = '9086e70'.padEnd(40, 'a');
const AT = '2026-10-13T14:02:00.000Z';

const rule = (id: string, label = `${id} holds.`) => ({ id, kind: 'rule' as const, label, status: 'rule' as const, file: '.omni-loop/knowledge/product/rules.md', origin: 'repository' as const });

/** The front-end: a law serving a Legal entry the product holds, another serving one it retired, a term both repositories use. */
const FRONT: RepositoryGraph = {
  version: 1,
  shape: 'repository',
  nodes: [rule('BR-PRODUCT-3'), rule('BR-PRODUCT-4'), { id: 'test:kit/test/plugin.test.ts', kind: 'test', label: null, status: null, file: 'kit/test/plugin.test.ts', origin: 'repository' }],
  edges: [
    { from: 'BR-PRODUCT-3', to: 'L-INVOICING-1', kind: 'serves' },
    { from: 'BR-PRODUCT-4', to: 'L-INVOICING-2', kind: 'serves' },
    { from: 'BR-PRODUCT-3', to: 'test:kit/test/plugin.test.ts', kind: 'enforced-by' },
    { from: 'BR-PRODUCT-3', to: 'term:credit note', kind: 'uses-term' },
  ],
};

/** The back-end: the same id as the front-end's law, a Legal id the product never held, the same term in another case, a removed term. */
const BACK: RepositoryGraph = {
  version: 1,
  shape: 'repository',
  nodes: [rule('BR-PRODUCT-3'), rule('BR-INVOICE-2')],
  edges: [
    { from: 'BR-INVOICE-2', to: 'L-TAX-7', kind: 'serves' },
    { from: 'BR-INVOICE-2', to: 'term:Credit Note', kind: 'uses-term' },
    { from: 'BR-PRODUCT-3', to: 'term:quote', kind: 'uses-term' },
  ],
};

const SOURCES: ProductSources = {
  links: [
    { repository: 'vertuoza/vertuo-omni-loop', knowledge: 'own', pushed: { commit: SHA, pushedAt: AT, pushedBy: 'pierrederval', graph: FRONT } },
    { repository: 'demo-org/back-end', knowledge: 'own', pushed: { commit: SHA.replace(/a/g, 'b'), pushedAt: AT, pushedBy: null, graph: BACK } },
    { repository: 'demo-org/mobile', knowledge: 'own', pushed: null },
    { repository: 'demo-org/design', knowledge: 'imported', pushed: { commit: SHA, pushedAt: AT, pushedBy: 'ada', graph: FRONT } },
    { repository: 'demo-org/docs', knowledge: 'none', pushed: null },
  ],
  legal: [
    { id: 'L-INVOICING-1', statement: 'An invoice keeps its number. Even after a correction.', retired: false },
    { id: 'L-INVOICING-2', statement: 'A quote expires after 30 days.', retired: true },
  ],
  glossary: [
    { term: 'credit note', meaning: 'A document that cancels part of an invoice.', removed: false },
    { term: 'quote', meaning: 'An offer before an invoice.', removed: true },
  ],
  never: [
    { id: 'never#3', body: 'Never sell the data.', removed: false },
    { id: 'never#1', body: 'Never ship without a test.', removed: true },
  ],
};

const joined = joinProductGraph(SOURCES);
const node = (id: string) => joined.nodes.find((n) => n.id === id);

describe('joinProductGraph', () => {
  it('prefixes each repository node with its repository’s short name, and carries it', () => {
    expect(node('vertuo-omni-loop/BR-PRODUCT-3')).toEqual({ ...rule('BR-PRODUCT-3'), id: 'vertuo-omni-loop/BR-PRODUCT-3', repo: 'vertuo-omni-loop' });
    expect(node('back-end/BR-PRODUCT-3')?.repo).toBe('back-end');
    expect(node('vertuo-omni-loop/test:kit/test/plugin.test.ts')?.kind).toBe('test');
    expect(node('BR-PRODUCT-3')).toBeUndefined();
    expect(joined.edges).toContainEqual({ from: 'vertuo-omni-loop/BR-PRODUCT-3', to: 'vertuo-omni-loop/test:kit/test/plugin.test.ts', kind: 'enforced-by' });
  });

  it('holds the product’s own active Legal entries, live terms and live Never lines as product nodes', () => {
    expect(node('L-INVOICING-1')).toEqual({ id: 'L-INVOICING-1', kind: 'legal', label: 'An invoice keeps its number.', status: null, file: null, origin: 'product', repo: null });
    expect(node('term:credit note')).toEqual({ id: 'term:credit note', kind: 'term', label: 'A document that cancels part of an invoice.', status: null, file: null, origin: 'product', repo: null });
    expect(node('never#3')).toEqual({ id: 'never#3', kind: 'never', label: 'Never sell the data.', status: null, file: null, origin: 'product', repo: null });
    expect(node('L-INVOICING-2')).toBeUndefined();
    expect(node('term:quote')).toBeUndefined();
    expect(node('never#1')).toBeUndefined();
    expect(joined.edges.some((edge) => edge.from === 'never#3' || edge.to === 'never#3')).toBe(false);
  });

  it('joins a rule serving a Legal entry the product holds, and lists one it retired or never held as unresolved', () => {
    expect(joined.edges).toContainEqual({ from: 'vertuo-omni-loop/BR-PRODUCT-3', to: 'L-INVOICING-1', kind: 'serves' });
    expect(joined.unresolved).toContainEqual({ repo: 'vertuo-omni-loop', node: 'vertuo-omni-loop/BR-PRODUCT-4', id: 'L-INVOICING-2' });
    expect(joined.unresolved).toContainEqual({ repo: 'back-end', node: 'back-end/BR-INVOICE-2', id: 'L-TAX-7' });
    expect(joined.edges.some((edge) => edge.to === 'L-INVOICING-2' || edge.to === 'L-TAX-7')).toBe(false);
  });

  it('meets two repositories using one term on the product’s one term node, compared without case', () => {
    const uses = joined.edges.filter((edge) => edge.kind === 'uses-term' && edge.to === 'term:credit note').map((edge) => edge.from);
    expect(uses).toEqual(['vertuo-omni-loop/BR-PRODUCT-3', 'back-end/BR-INVOICE-2']);
    expect(joined.nodes.filter((n) => n.kind === 'term')).toHaveLength(1);
    expect(joined.unresolved).toContainEqual({ repo: 'back-end', node: 'back-end/BR-PRODUCT-3', id: 'term:quote' });
  });

  it('says what each linked repository’s data is: pushed, never pushed, or not served', () => {
    expect(joined.repositories).toEqual([
      { repo: 'vertuo-omni-loop', commit: SHA, pushedAt: AT, pushedBy: 'pierrederval', graph: 'own' },
      { repo: 'back-end', commit: SHA.replace(/a/g, 'b'), pushedAt: AT, pushedBy: null, graph: 'own' },
      { repo: 'mobile', commit: null, pushedAt: null, pushedBy: null, graph: 'own' },
      { repo: 'design', commit: null, pushedAt: null, pushedBy: null, graph: 'none' },
      { repo: 'docs', commit: null, pushedAt: null, pushedBy: null, graph: 'none' },
    ]);
    expect(joined.nodes.some((n) => n.repo === 'design')).toBe(false);
  });

  it('names two repositories sharing a short name by their whole name, so their ids never collide', () => {
    const twins = joinProductGraph({
      ...SOURCES,
      links: [
        { repository: 'acme/web', knowledge: 'own', pushed: { commit: SHA, pushedAt: AT, pushedBy: null, graph: BACK } },
        { repository: 'other/web', knowledge: 'own', pushed: { commit: SHA, pushedAt: AT, pushedBy: null, graph: BACK } },
      ],
    });
    expect(twins.repositories.map((r) => r.repo)).toEqual(['acme/web', 'other/web']);
    expect(twins.nodes.filter((n) => n.id.endsWith('/BR-INVOICE-2')).map((n) => n.id)).toEqual(['acme/web/BR-INVOICE-2', 'other/web/BR-INVOICE-2']);
  });

  it('is an empty graph for a product with no repository and no knowledge', () => {
    expect(joinProductGraph({ links: [], legal: [], glossary: [], never: [] })).toEqual({ nodes: [], edges: [], unresolved: [], repositories: [] });
  });
});
