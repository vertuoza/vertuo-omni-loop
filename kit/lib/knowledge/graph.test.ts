// @ts-nocheck
// PRD #149, slice s1: the knowledge graph, built from what `readKnowledge` returns, on a fixture
// knowledge folder with a product folder, two domains and one cross-domain file.
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.ts';
import { buildGraph, graphOfTexts, GRAPH_VERSION, prdOf, readGraph } from './graph.ts';
import { readKnowledge } from './registers.ts';

const K = '.omni-loop/knowledge';

/** One register entry: its heading, its statement, then its field lines. */
const entry = (id, statement, fields = {}) =>
  `## ${id}\n\n${statement}\n\n${Object.entries(fields).map(([key, value]) => `${key}: ${value}`).join('\n')}\n\n`;
const register = (title, ...entries) => `# ${title}\n\n${entries.join('')}`;

const FILES = {
  [`${K}/README.md`]: '# Knowledge\n\nNever parsed for entries: P-PRODUCT-2 is only named here.\n',
  [`${K}/product/principles.md`]: register(
    'Product principles',
    entry('P-PRODUCT-1', 'Every change is reviewed by a person.', {
      Why: 'Nobody merges alone; BR-QUOTE-1 shows it on quotes.',
      Source: '.omni-loop/delivery/shipped/0003-kit/outbox/settled.md, entry s1-01-review, PRD #3',
    }),
    entry('P-PRODUCT-2', 'Quotes stay readable.', {
      Why: 'Unlike P-PRODUCT-7, which was dropped.',
      Source: 'PRD #12',
      Proposed: 'invade 2026-09-25',
    }),
  ),
  [`${K}/product/rules.md`]: register(
    'Product rules',
    entry('BR-PRODUCT-1', 'A pull request needs one approval: BR-PRODUCT-1 holds while N-PRODUCT-1 does.', {
      Serves: 'P-PRODUCT-1',
      Source: '.omni-loop/delivery/shipped/0003-kit/outbox/settled.md, entry s1-02-approval, PRD #3',
      'Enforced by': 'unenforced',
      Stated: '2026-09-25',
    }),
  ),
  [`${K}/product/invariants.md`]: register(
    'Product invariants',
    entry('N-PRODUCT-1', 'The ledger only grows.', {
      Source: 'README.md',
      'Enforced by': '`kit/lib/ledger.test.mjs`',
      Stated: '2026-09-25',
      Proposed: 'harvest 2026-09-26',
    }),
  ),
  [`${K}/domains/advisor/README.md`]: '# Advisor\n\nGlossary term: Advisor\n',
  [`${K}/domains/advisor/principles.md`]: register(
    'Advisor principles',
    entry('P-ADVISOR-1', 'An advisor answers in plain words.', { Why: 'People read the answers.', Source: 'PRD #7' }),
  ),
  [`${K}/domains/advisor/rules.md`]: register(
    'Advisor rules',
    entry('BR-ADVISOR-1', 'An answer names no code.', {
      Serves: 'P-ADVISOR-1',
      Source: 'PRD #7',
      'Enforced by': 'unenforced',
      Stated: '2026-09-25',
    }),
  ),
  [`${K}/domains/quote/principles.md`]: register(
    'Quote principles',
    entry('P-QUOTE-1', 'A quote is never lost.', { Why: 'A lost quote is a lost customer.', Source: 'PRD #9', Proposed: 'invade 2026-09-25' }),
  ),
  [`${K}/domains/quote/rules.md`]: register(
    'Quote rules',
    entry('BR-QUOTE-1', 'A sent quote is kept.', {
      Serves: 'P-QUOTE-1',
      Source: 'PRD #9',
      'Enforced by': 'unenforced',
      Stated: '2026-09-25',
      Proposed: 'invade 2026-09-25',
    }),
    entry('BR-QUOTE-2', 'A draft expires after thirty days.', {
      Serves: 'P-QUOTE-9',
      Source: 'PRD #9',
      'Enforced by': 'unenforced',
      Stated: '2026-09-25',
    }),
  ),
  [`${K}/domains/quote/invariants.md`]: register(
    'Quote invariants',
    entry('N-QUOTE-1', 'A quote has one owner.', {
      Serves: 'P-PRODUCT-1',
      Source: 'PRD #9',
      'Enforced by': '`apps/quote/owner.test.ts`',
      Stated: '2026-09-25',
    }),
  ),
  [`${K}/cross-domain/advisor--quote.md`]: register(
    'Advisor and quote',
    entry('X-ADVISOR-QUOTE-1', 'An advisor never edits a sent quote.', {
      Kind: 'rule',
      Serves: 'P-QUOTE-1',
      Source: 'PRD #9',
      'Enforced by': '`apps/quote/advisor.test.ts`',
      Stated: '2026-09-25',
    }),
  ),
};

function fixtureGraph() {
  const { ctx } = makeRepo({ files: FILES });
  return readGraph({ ctx });
}

describe('the knowledge graph — PRD #149, acceptance criterion 1', () => {
  it('is one document: version 1, the repository, the domains, the entries and the links', () => {
    const graph = fixtureGraph();
    expect(GRAPH_VERSION).toBe(1);
    expect(Object.keys(graph)).toEqual(['version', 'repo', 'domains', 'entries', 'links', 'loose', 'unserved']);
    expect(graph.version).toBe(1);
    expect(graph.repo).toBe('acme/widgets');
  });

  it('holds every entry once, in the order the registers are read, with its kind, domain, status and PRD', () => {
    const graph = fixtureGraph();
    expect(graph.entries.map(({ id, kind, domain, status, prd }) => `${id} ${kind} ${domain} ${status} ${prd}`)).toEqual([
      'P-PRODUCT-1 principle product law 3',
      'P-PRODUCT-2 principle product proposed 12',
      'BR-PRODUCT-1 rule product law 3',
      'N-PRODUCT-1 invariant product proposed null',
      'P-ADVISOR-1 principle advisor law 7',
      'BR-ADVISOR-1 rule advisor law 7',
      'P-QUOTE-1 principle quote proposed 9',
      'BR-QUOTE-1 rule quote proposed 9',
      'BR-QUOTE-2 rule quote law 9',
      'N-QUOTE-1 invariant quote law 9',
      'X-ADVISOR-QUOTE-1 rule null law 9',
    ]);
  });

  it('carries each entry whole: statement, why, serves as written, enforcement and file', () => {
    const graph = fixtureGraph();
    const byId = Object.fromEntries(graph.entries.map((one) => [one.id, one]));
    expect(byId['P-PRODUCT-1']).toEqual({
      id: 'P-PRODUCT-1',
      kind: 'principle',
      domain: 'product',
      domains: ['product'],
      statement: 'Every change is reviewed by a person.',
      why: 'Nobody merges alone; BR-QUOTE-1 shows it on quotes.',
      status: 'law',
      serves: null,
      enforced: false,
      enforcedBy: null,
      prd: 3,
      file: `${K}/product/principles.md`,
    });
    expect(byId['BR-QUOTE-2']).toMatchObject({ serves: 'P-QUOTE-9', enforced: false, enforcedBy: 'unenforced', why: null });
    expect(byId['N-PRODUCT-1']).toMatchObject({ enforced: true, enforcedBy: '`kit/lib/ledger.test.mjs`', file: `${K}/product/invariants.md` });
  });

  it('gives a cross-domain entry its pair as its domains, and no single domain', () => {
    const graph = fixtureGraph();
    expect(graph.entries.find((one) => one.id === 'X-ADVISOR-QUOTE-1')).toMatchObject({
      kind: 'rule',
      domain: null,
      domains: ['advisor', 'quote'],
      file: `${K}/cross-domain/advisor--quote.md`,
    });
  });

  it('counts each domain: product first, then each folder under domains/, cross-domain entries in none', () => {
    const graph = fixtureGraph();
    expect(graph.domains).toEqual([
      { name: 'product', code: 'PRODUCT', scope: 'product', counts: { principles: 2, rules: 1, invariants: 1, laws: 2, proposed: 2 } },
      { name: 'advisor', code: 'ADVISOR', scope: 'domain', counts: { principles: 1, rules: 1, invariants: 0, laws: 2, proposed: 0 } },
      { name: 'quote', code: 'QUOTE', scope: 'domain', counts: { principles: 1, rules: 2, invariants: 1, laws: 2, proposed: 2 } },
    ]);
  });

  it('links a Serves: naming an existing principle once, and a Serves: naming nothing not at all', () => {
    const graph = fixtureGraph();
    expect(graph.links.filter((link) => link.kind === 'serves')).toEqual([
      { from: 'BR-PRODUCT-1', to: 'P-PRODUCT-1', kind: 'serves' },
      { from: 'BR-ADVISOR-1', to: 'P-ADVISOR-1', kind: 'serves' },
      { from: 'BR-QUOTE-1', to: 'P-QUOTE-1', kind: 'serves' },
      { from: 'N-QUOTE-1', to: 'P-PRODUCT-1', kind: 'serves' },
      { from: 'X-ADVISOR-QUOTE-1', to: 'P-QUOTE-1', kind: 'serves' },
    ]);
  });

  it('links an id cited in a statement or a Why: to that entry once; a self-citation and an id nothing claims are no link', () => {
    const graph = fixtureGraph();
    expect(graph.links.filter((link) => link.kind === 'cites')).toEqual([
      { from: 'P-PRODUCT-1', to: 'BR-QUOTE-1', kind: 'cites' },
      { from: 'BR-PRODUCT-1', to: 'N-PRODUCT-1', kind: 'cites' },
    ]);
  });

  it('lists the loose entries — no Serves:, or one naming no principle — and the principles nothing serves', () => {
    const graph = fixtureGraph();
    expect(graph.loose).toEqual(['N-PRODUCT-1', 'BR-QUOTE-2']);
    expect(graph.unserved).toEqual(['P-PRODUCT-2']);
  });

  it('never links a Serves: that names a rule, and counts that entry loose', () => {
    const files = {
      [`${K}/product/rules.md`]: register(
        'Product rules',
        entry('BR-PRODUCT-1', 'One.', { Serves: 'BR-PRODUCT-2' }),
        entry('BR-PRODUCT-2', 'Two.', { Serves: 'P-PRODUCT-1' }),
      ),
    };
    const { ctx } = makeRepo({ files });
    const graph = readGraph({ ctx });
    expect(graph.links).toEqual([]);
    expect(graph.loose).toEqual(['BR-PRODUCT-1', 'BR-PRODUCT-2']);
  });

  it('is an empty graph, never an error, when the knowledge folder is absent', () => {
    const { ctx } = makeRepo();
    expect(readGraph({ ctx })).toEqual({ version: 1, repo: 'acme/widgets', domains: [], entries: [], links: [], loose: [], unserved: [] });
  });

  it('is built from what readKnowledge returns, and carries a null repository as null', () => {
    const { ctx } = makeRepo({ files: FILES });
    expect(buildGraph(readKnowledge({ ctx }), { repo: null })).toEqual({ ...readGraph({ ctx }), repo: null });
  });
});

describe('graphOfTexts — the graph of a knowledge folder held in memory', () => {
  it('is the graph readGraph builds off disk, from the same files', () => {
    const { ctx } = makeRepo({ files: FILES });
    expect(graphOfTexts({ texts: FILES, knowledgeRoot: K, repo: 'acme/widgets' })).toEqual(readGraph({ ctx }));
  });

  it('reads the folder where the repository\'s config puts it, and ignores every file outside it', () => {
    const moved = Object.fromEntries(Object.entries(FILES).map(([path, text]) => [path.replace(K, 'docs/kb'), text]));
    const graph = graphOfTexts({ texts: { ...moved, 'README.md': '## P-PRODUCT-9\n\nNot knowledge.\n' }, knowledgeRoot: 'docs/kb', repo: 'acme/tools' });
    expect(graph.repo).toBe('acme/tools');
    expect(graph.entries).toHaveLength(11);
    expect(graph.entries.map((one) => one.file)).toContain('docs/kb/product/principles.md');
    expect(graph.entries.map((one) => one.id)).not.toContain('P-PRODUCT-9');
  });

  it('is an empty graph, never an error, when no file sits in the folder', () => {
    expect(graphOfTexts({ texts: {}, knowledgeRoot: K, repo: null })).toEqual({ version: 1, repo: null, domains: [], entries: [], links: [], loose: [], unserved: [] });
  });
});

describe('prdOf — the PRD a Source: line names', () => {
  it('reads the number after "PRD #", and null when the line names none', () => {
    expect(prdOf('.omni-loop/delivery/shipped/0007-x/outbox/settled.md, entry s3-03-y, PRD #7')).toBe(7);
    expect(prdOf('PRD #149')).toBe(149);
    expect(prdOf('README.md')).toBeNull();
    expect(prdOf('PR #9')).toBeNull();
    expect(prdOf(null)).toBeNull();
  });
});
