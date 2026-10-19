import { joinProductGraph } from '../join';

// The graph page's demo (PRD 1798 s6): shown in development (or OMNI_LOOP_DEMO=1) for the demo product, whose
// Knowledge tab is product-knowledge's. One repository pushed, one never pushed, a Legal entry, a term, a
// Never line, and an edge to a Legal entry the product does not hold.

export const DEMO_PRODUCT = { id: 'demo-product-1', name: 'Widgets' };

export function demoJoinedGraph() {
  return joinProductGraph({
    links: [
      {
        repository: 'demo/billing',
        knowledge: 'own',
        pushed: {
          commit: '9086e70'.padEnd(40, 'a'),
          pushedAt: '2026-12-14T09:30:00.000Z',
          pushedBy: 'anna',
          graph: {
            version: 1,
            shape: 'repository',
            nodes: [{ id: 'BR-BILLING-1', kind: 'rule', label: 'An invoice keeps its number.', status: 'law', file: 'knowledge/rules.md', origin: 'repository' }],
            edges: [
              { from: 'BR-BILLING-1', to: 'L-INVOICING-1', kind: 'serves' },
              { from: 'BR-BILLING-1', to: 'term:credit note', kind: 'uses-term' },
              { from: 'BR-BILLING-1', to: 'L-INVOICING-9', kind: 'serves' },
            ],
          },
        },
      },
      { repository: 'demo/portal', knowledge: 'own', pushed: null },
    ],
    legal: [{ id: 'L-INVOICING-1', statement: 'Invoice numbers follow each other with no gaps.', retired: false }],
    glossary: [{ term: 'credit note', meaning: 'A document that cancels all or part of an invoice.', removed: false }],
    never: [{ id: 'never#1', body: 'Never sell the data.', removed: false }],
  });
}
