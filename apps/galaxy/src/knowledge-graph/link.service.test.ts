import { describe, expect, it } from 'vitest';
import type { RepositoryGraph } from 'vertuo-omni-plan/kit/lib/knowledge/graph-schema.ts';
import type { LinkGraphAnswer, LinkGraphBundle, LinkGraphRepository } from './link.repository';
import { linkGraphService } from './link.service';
import type { ProductGraphRepository } from './product-graph.repository';
import { productGraphService } from './product-graph.service';

// The agent link's neighbourhood (PRD 1798 s4): the rows the link reads, joined and walked by s3's own
// reader (./product-graph.service.ts, ./join.ts, ./walk.ts), so the MCP tool and the read route cannot
// differ. No test calls Supabase.

const HASH = 'a'.repeat(64);
const SHA = 'b'.repeat(40);

const FRONT: RepositoryGraph = {
  version: 1,
  shape: 'repository',
  nodes: [
    { id: 'BR-PRODUCT-3', kind: 'rule', label: 'A quote shows its total.', status: 'law', file: 'rules.md', origin: 'repository' },
    { id: 'BR-PRODUCT-4', kind: 'rule', label: 'A credit note cancels a quote.', status: 'rule', file: 'rules.md', origin: 'repository' },
  ],
  edges: [
    { from: 'BR-PRODUCT-3', to: 'L-INVOICING-1', kind: 'serves' },
    { from: 'BR-PRODUCT-4', to: 'L-INVOICING-9', kind: 'serves' },
    { from: 'BR-PRODUCT-4', to: 'term:credit note', kind: 'uses-term' },
  ],
};

const BUNDLE: LinkGraphBundle = {
  product: { id: 'p-omni', key: 'omni-loop', name: 'Omni Loop' },
  links: [{ repository: 'acme/docs', knowledge: 'imported' }, { repository: 'acme/widgets', knowledge: 'own' }, { repository: 'acme/back', knowledge: 'own' }],
  legal: [
    { code: 'INVOICING', number: 1, statement: 'An invoice keeps its number.', retired_at: null },
    { code: 'INVOICING', number: 9, statement: 'Gone.', retired_at: '2026-10-01T00:00:00+00:00' },
  ],
  glossary: [{ term: 'Credit note', meaning: 'A document that cancels an invoice.', removed_at: null }],
  never: [{ seq: 3, body: 'Never sell the data.', removed_at: null }],
  graphs: [{ repository: 'acme/widgets', sha: SHA, graph: FRONT, pushed_at: '2026-10-13T14:02:00+00:00', pushed_by_login: 'pierrederval' }],
};

/** s3's repository answering the same rows, as a member of the product's workspace reads them. */
const asMember: ProductGraphRepository = {
  productByKey: (key) => Promise.resolve(key === 'omni-loop' ? BUNDLE.product : null),
  productById: () => Promise.resolve(null),
  links: () => Promise.resolve(BUNDLE.links),
  legal: () => Promise.resolve(BUNDLE.legal),
  glossary: () => Promise.resolve(BUNDLE.glossary),
  never: () => Promise.resolve(BUNDLE.never),
  latestGraph: (name) => Promise.resolve(name === 'acme/widgets' ? { sha: SHA, graph: FRONT, pushed_at: '2026-10-13T14:02:00+00:00', pushed_by_login: 'pierrederval' } : null),
};

function reading(answer: LinkGraphAnswer) {
  const asked: Array<{ hash: string; repo: string | null }> = [];
  const repository: LinkGraphRepository = { read: (hash, repo) => { asked.push({ hash, repo }); return Promise.resolve(answer); } };
  return { asked, service: linkGraphService(repository) };
}

describe('linkGraphService', () => {
  it('answers the very neighbourhood s3\'s reader answers a member, at every depth and from any kind of node', async () => {
    const { asked, service } = reading({ ok: true, bundle: BUNDLE });
    for (const id of ['L-INVOICING-1', 'widgets/BR-PRODUCT-4', 'term:Credit Note', 'never#3']) {
      for (const depth of [1, 2, 3]) {
        const member = await productGraphService(asMember).neighbourhood({ key: 'omni-loop' }, { id, depth });
        expect(member.kind).toBe('ok');
        expect(await service.neighbourhood(HASH, { repo: 'acme/widgets', id, depth })).toEqual(member);
      }
    }
    expect(asked[0]).toEqual({ hash: HASH, repo: 'acme/widgets' });
  });

  it('a node the joined graph does not hold is no node, naming the product', async () => {
    const { service } = reading({ ok: true, bundle: BUNDLE });
    expect(await service.neighbourhood(HASH, { repo: null, id: 'widgets/BR-PRODUCT-99', depth: 1 })).toEqual({ kind: 'no-node', product: 'omni-loop' });
    const keyless = reading({ ok: true, bundle: { ...BUNDLE, product: { ...BUNDLE.product, key: null } } });
    expect(await keyless.service.neighbourhood(HASH, { repo: null, id: 'nothing', depth: 1 })).toEqual({ kind: 'no-node', product: 'Omni Loop' });
  });

  it('passes the database\'s refusal on as it came', async () => {
    const { service } = reading({ ok: false, code: '28000', reason: 'This link does not work: make a new one on Settings › Business.' });
    expect(await service.neighbourhood(HASH, { repo: null, id: 'L-INVOICING-1', depth: 1 }))
      .toEqual({ kind: 'refused', code: '28000', reason: 'This link does not work: make a new one on Settings › Business.' });
  });
});
