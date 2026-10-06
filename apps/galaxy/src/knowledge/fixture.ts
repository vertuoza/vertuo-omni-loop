import type { KnowledgeEntry, KnowledgeGraph } from '../data/knowledge';
import { parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';

// A small knowledge graph for the /knowledge page's tests: the product with two served principles,
// an unserved one, a loose rule and a loose invariant; a billing domain whose rule serves a product
// principle and whose one principle only a cross-domain rule serves; and one cross-domain pair.
// Deliberately out of id order, as registers written by hand often are.

export const entry = (id: string, kind: KnowledgeEntry['kind'], domain: string | null, over: Partial<KnowledgeEntry> = {}): KnowledgeEntry => ({
  id,
  kind,
  domain,
  domains: domain ? [domain] : [],
  statement: `${id} holds.`,
  why: null,
  status: 'proposed',
  serves: null,
  enforced: false,
  enforcedBy: null,
  prd: null,
  file: `.omni-loop/knowledge/${domain === 'product' ? 'product' : domain ? `domains/${domain}` : 'cross-domain'}/${kind}s.md`,
  ...over,
});

export const GRAPH: KnowledgeGraph = {
  version: 1,
  repo: 'acme/widgets',
  domains: [
    { name: 'billing', code: 'BILLING', scope: 'domain', counts: { principles: 1, rules: 1, invariants: 0, laws: 0, proposed: 2 } },
    { name: 'product', code: 'PRODUCT', scope: 'product', counts: { principles: 3, rules: 3, invariants: 2, laws: 2, proposed: 6 } },
  ],
  entries: [
    entry('P-PRODUCT-2', 'principle', 'product', { statement: 'Every question a person must answer waits in the outbox.' }),
    entry('P-PRODUCT-1', 'principle', 'product', {
      statement: 'A slice is claimed before it is built.',
      why: 'Two waves building the same slice waste a day each.',
      status: 'law',
      prd: parsePrd(7),
      file: '.omni-loop/knowledge/product/principles.md',
    }),
    entry('P-PRODUCT-3', 'principle', 'product', { statement: 'A person always has the last word on a merge.' }),
    entry('BR-PRODUCT-1', 'rule', 'product', {
      statement: 'A draft pull request is the claim, and P-PRODUCT-3 still holds over it.',
      status: 'law',
      serves: 'P-PRODUCT-1',
      enforced: true,
      enforcedBy: 'kit/lib/claim.mjs',
      prd: parsePrd(7),
      file: '.omni-loop/knowledge/product/rules.md',
    }),
    entry('BR-PRODUCT-2', 'rule', 'product', { statement: 'The outbox check stays red while a question is open.', serves: 'P-PRODUCT-2' }),
    entry('BR-PRODUCT-3', 'rule', 'product', { statement: 'A stale claim can be taken back.', serves: 'P-PRODUCT-99' }),
    entry('N-PRODUCT-1', 'invariant', 'product', { statement: 'A claim names exactly one slice.', serves: 'P-PRODUCT-1' }),
    entry('N-PRODUCT-2', 'invariant', 'product', { statement: 'An item id is never reused.' }),
    entry('P-BILLING-1', 'principle', 'billing', { statement: 'An invoice is never changed once sent.' }),
    entry('BR-BILLING-1', 'rule', 'billing', { statement: 'A billing question goes to the outbox like any other.', serves: 'P-PRODUCT-2' }),
    entry('X-BILLING-PRODUCT-1', 'rule', null, {
      domains: ['billing', 'product'],
      statement: 'A shipped PRD that bills a customer credits the invoice, never edits it.',
      serves: 'P-BILLING-1',
    }),
  ],
  links: [
    { from: 'BR-PRODUCT-1', to: 'P-PRODUCT-1', kind: 'serves' },
    { from: 'BR-PRODUCT-1', to: 'P-PRODUCT-3', kind: 'cites' },
    { from: 'BR-PRODUCT-2', to: 'P-PRODUCT-2', kind: 'serves' },
    { from: 'N-PRODUCT-1', to: 'P-PRODUCT-1', kind: 'serves' },
    { from: 'BR-BILLING-1', to: 'P-PRODUCT-2', kind: 'serves' },
    { from: 'X-BILLING-PRODUCT-1', to: 'P-BILLING-1', kind: 'serves' },
  ],
  loose: ['BR-PRODUCT-3', 'N-PRODUCT-2'],
  unserved: ['P-PRODUCT-3'],
};

/** Every entry id and statement of the graph: none may reach a visitor who is not crew. */
export const SECRETS: string[] = GRAPH.entries.flatMap((e) => [e.id, e.statement]);
