// PRD 1797, slice s1: the neighbourhood of one entry, built from what `readKnowledge` returns and
// the decision records, on a knowledge folder held in memory. One fixture per edge, each edge absent
// when its source line is.
import { describe, expect, it } from 'vitest';
import type { DecisionRecord } from '../playbook/decisions.ts';
import { PrdNumberSchema } from '../ids.ts';
import {
  buildNeighbourhood,
  neighbourhoodText,
  NEIGHBOURHOOD_SHAPE,
  NEIGHBOURHOOD_VERSION,
  productLine,
  productWithoutCache,
  type Neighbourhood,
  type NeighbourhoodProduct,
} from './neighbourhood.ts';
import { memorySource, readKnowledge, type KnowledgeEntry } from './registers.ts';

const K = '.omni-loop/knowledge';
const OFFLINE: NeighbourhoodProduct = { state: 'offline', key: null, cachedOn: null };
const NONE: NeighbourhoodProduct = { state: 'none', key: null, cachedOn: null };

/** One register entry: its heading, its statement, then its field lines. */
const entry = (id: string, statement: string, fields: Record<string, string> = {}) =>
  `## ${id}\n\n${statement}\n\n${Object.entries(fields).map(([key, value]) => `${key}: ${value}`).join('\n')}\n\n`;
const register = (title: string, ...entries: string[]) => `# ${title}\n\n${entries.join('')}`;

const FILES = {
  [`${K}/product/principles.md`]: register(
    'Principles',
    entry('P-PRODUCT-1', 'Every change is reviewed by a person. Nobody merges alone.', { Why: 'Trust.', Source: 'settled.md, PRD #3' }),
    entry('P-PRODUCT-2', 'Quotes stay readable.', { Why: 'People read them.', Source: 'README.md' }),
  ),
  [`${K}/product/rules.md`]: register(
    'Rules',
    entry('BR-PRODUCT-1', 'A pull request needs one approval while N-PRODUCT-1 holds. It names BR-PRODUCT-1 itself.', {
      Serves: 'P-PRODUCT-1',
      Source: 'settled.md, entry s1-02, PRD #3',
      'Enforced by': '`kit/a.test.ts`, kit/b.test.ts',
      Governs: '^kit/a/, ^kit/b\\.ts$',
      Locked: '@pierrederval, 2026-10-13',
      Stated: '2026-09-25',
    }),
    entry('BR-PRODUCT-2', 'A draft is never merged.', {
      Serves: 'P-PRODUCT-1',
      Source: 'README.md',
      'Enforced by': 'pending #12',
      Locked: '@pierrederval, 2026-10-13',
      Stated: '2026-09-25',
    }),
    entry('BR-PRODUCT-3', 'A quote shows its total.', { Serves: 'P-PRODUCT-2', Source: 'PRD #4', 'Enforced by': 'unenforced', Stated: '2026-09-25' }),
  ),
  [`${K}/product/invariants.md`]: register(
    'Invariants',
    entry('N-PRODUCT-1', 'The ledger only grows.', { Source: 'README.md', 'Enforced by': 'unenforced', Stated: '2026-09-25', Proposed: 'harvest 2026-09-26' }),
  ),
  [`${K}/product/contracts.md`]: register(
    'Contracts',
    entry('DC-PRODUCT-1', 'A quote moves from draft to sent, never back.', { 'Points to': '`kit/lib/quote.ts`, kit/lib/quote-schema.ts', Source: 'README.md', Stated: '2026-10-15' }),
  ),
};

const prd = (n: number) => PrdNumberSchema.parse(n);
const RECORDS: DecisionRecord[] = [
  { number: '0001', file: `${K}/adr/0001-first.md`, title: 'ADR-0001 — The first record', prd: prd(3) },
  { number: '0002', file: `${K}/adr/0002-second.md`, title: 'ADR-0002 — Another PRD', prd: prd(4) },
  { number: '0003', file: `${K}/adr/0003-third.md`, title: null, prd: prd(3) },
  { number: '0004', file: `${K}/adr/0004-fourth.md`, title: 'No prefix', prd: null },
];

const entriesOf = (texts: Record<string, string>): KnowledgeEntry[] =>
  readKnowledge({ ctx: { root: '', layout: { knowledgeRoot: K } }, source: memorySource(texts) }).entries;

const ENTRIES = entriesOf(FILES);

function around(id: string, { records = RECORDS, entries = ENTRIES, product = OFFLINE } = {}): Neighbourhood {
  return buildNeighbourhood({ entries, records, repo: 'acme/widgets', product }, { start: [id] });
}

/** The edges of a neighbourhood of one kind, as `from → to`. */
const edgesOf = (built: Neighbourhood, kind: string) => built.edges.filter((edge) => edge.kind === kind).map(({ from, to }) => `${from} → ${to}`);

describe('buildNeighbourhood — the document', () => {
  it('carries the version, the shape, the repository, the start, the depth and the product', () => {
    const built = around('BR-PRODUCT-1');
    expect(built).toMatchObject({
      version: NEIGHBOURHOOD_VERSION,
      shape: NEIGHBOURHOOD_SHAPE,
      repo: 'acme/widgets',
      start: ['BR-PRODUCT-1'],
      depth: 1,
      product: OFFLINE,
    });
    expect(NEIGHBOURHOOD_VERSION).toBe(1);
    expect(NEIGHBOURHOOD_SHAPE).toBe('neighbourhood');
  });

  it('puts the start first, at hop 0, every other node at hop 1, each once', () => {
    const built = around('BR-PRODUCT-1');
    expect(built.nodes[0]).toEqual({
      id: 'BR-PRODUCT-1',
      kind: 'rule',
      label: 'A pull request needs one approval while N-PRODUCT-1 holds.',
      status: 'law',
      file: `${K}/product/rules.md`,
      origin: 'repository',
      hop: 0,
    });
    expect(built.nodes.slice(1).every(({ hop }) => hop === 1)).toBe(true);
    const ids = built.nodes.map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('reads a status for a rule or an invariant only: law, rule or proposed', () => {
    const status = (id: string) => around(id).nodes[0]?.status;
    expect([status('BR-PRODUCT-1'), status('BR-PRODUCT-3'), status('N-PRODUCT-1'), status('P-PRODUCT-1'), status('DC-PRODUCT-1')]).toEqual([
      'law',
      'rule',
      'proposed',
      null,
      null,
    ]);
  });

  it('leaves out an id that names no entry, and an entry whose kind cannot be read', () => {
    const odd = entriesOf({ [`${K}/cross-domain/advisor--quote.md`]: register('X', entry('X-ADVISOR-QUOTE-1', 'No kind.', { Source: 'README.md' })) });
    expect(around('BR-PRODUCT-9').nodes).toEqual([]);
    expect(around('X-ADVISOR-QUOTE-1', { entries: odd }).nodes).toEqual([]);
  });
});

describe('buildNeighbourhood — one edge at a time', () => {
  it('serves, up from a rule to its principle', () => {
    const built = around('BR-PRODUCT-1');
    expect(edgesOf(built, 'serves')).toEqual(['BR-PRODUCT-1 → P-PRODUCT-1']);
    expect(built.nodes.find(({ id }) => id === 'P-PRODUCT-1')).toEqual({
      id: 'P-PRODUCT-1',
      kind: 'principle',
      label: 'Every change is reviewed by a person.',
      status: null,
      file: `${K}/product/principles.md`,
      origin: 'repository',
      hop: 1,
    });
  });

  it('serves, down from a principle to every entry that serves it, stored in its natural direction', () => {
    expect(edgesOf(around('P-PRODUCT-1'), 'serves')).toEqual(['BR-PRODUCT-1 → P-PRODUCT-1', 'BR-PRODUCT-2 → P-PRODUCT-1']);
  });

  it('serves, absent with no Serves: line, or one naming no principle', () => {
    const loose = entriesOf({ [`${K}/product/rules.md`]: register('Rules', entry('BR-PRODUCT-1', 'Loose.', { Serves: 'P-PRODUCT-9', Source: 'README.md' })) });
    expect(edgesOf(around('N-PRODUCT-1'), 'serves')).toEqual([]);
    expect(edgesOf(around('BR-PRODUCT-1', { entries: loose }), 'serves')).toEqual([]);
  });

  it('enforced-by, one test node per path its line names, backticks stripped', () => {
    const built = around('BR-PRODUCT-1');
    expect(edgesOf(built, 'enforced-by')).toEqual(['BR-PRODUCT-1 → test:kit/a.test.ts', 'BR-PRODUCT-1 → test:kit/b.test.ts']);
    expect(built.nodes.find(({ id }) => id === 'test:kit/a.test.ts')).toEqual({
      id: 'test:kit/a.test.ts',
      kind: 'test',
      label: null,
      status: null,
      file: 'kit/a.test.ts',
      origin: 'repository',
      hop: 1,
    });
  });

  it('enforced-by, absent for pending #<n>, unenforced and no line', () => {
    expect(edgesOf(around('BR-PRODUCT-2'), 'enforced-by')).toEqual([]);
    expect(edgesOf(around('BR-PRODUCT-3'), 'enforced-by')).toEqual([]);
    expect(edgesOf(around('P-PRODUCT-1'), 'enforced-by')).toEqual([]);
  });

  it('governs, one path node per pattern, its file null', () => {
    const built = around('BR-PRODUCT-1');
    expect(edgesOf(built, 'governs')).toEqual(['BR-PRODUCT-1 → path:^kit/a/', 'BR-PRODUCT-1 → path:^kit/b\\.ts$']);
    expect(built.nodes.find(({ id }) => id === 'path:^kit/a/')).toMatchObject({ kind: 'path', label: null, file: null });
    expect(edgesOf(around('BR-PRODUCT-2'), 'governs')).toEqual([]);
  });

  it('points-to, one schema node per file of a contract', () => {
    const built = around('DC-PRODUCT-1');
    expect(edgesOf(built, 'points-to')).toEqual(['DC-PRODUCT-1 → schema:kit/lib/quote.ts', 'DC-PRODUCT-1 → schema:kit/lib/quote-schema.ts']);
    expect(built.nodes[0]).toMatchObject({ kind: 'contract', label: 'A quote moves from draft to sent, never back.' });
    expect(built.nodes.find(({ id }) => id === 'schema:kit/lib/quote.ts')).toMatchObject({ kind: 'schema', label: null, file: 'kit/lib/quote.ts' });
    expect(edgesOf(around('BR-PRODUCT-1'), 'points-to')).toEqual([]);
  });

  it('cites, to an entry the statement or Why: names and from an entry that names the start, never itself', () => {
    expect(edgesOf(around('BR-PRODUCT-1'), 'cites')).toEqual(['BR-PRODUCT-1 → N-PRODUCT-1']);
    expect(edgesOf(around('N-PRODUCT-1'), 'cites')).toEqual(['BR-PRODUCT-1 → N-PRODUCT-1']);
    expect(edgesOf(around('P-PRODUCT-2'), 'cites')).toEqual([]);
  });

  it('sibling, to every other entry serving the same principle', () => {
    expect(edgesOf(around('BR-PRODUCT-1'), 'sibling')).toEqual(['BR-PRODUCT-1 → BR-PRODUCT-2']);
    expect(edgesOf(around('BR-PRODUCT-3'), 'sibling')).toEqual([]);
    expect(edgesOf(around('N-PRODUCT-1'), 'sibling')).toEqual([]);
  });

  it('same-prd, to the records whose header names the PRD of the start’s Source:, labelled with their title', () => {
    const built = around('BR-PRODUCT-1');
    expect(edgesOf(built, 'same-prd')).toEqual(['BR-PRODUCT-1 → ADR-0001', 'BR-PRODUCT-1 → ADR-0003']);
    expect(built.nodes.find(({ id }) => id === 'ADR-0001')).toEqual({
      id: 'ADR-0001',
      kind: 'adr',
      label: 'The first record',
      status: null,
      file: `${K}/adr/0001-first.md`,
      origin: 'repository',
      hop: 1,
    });
    expect(built.nodes.find(({ id }) => id === 'ADR-0003')?.label).toBeNull();
    expect(edgesOf(around('BR-PRODUCT-2'), 'same-prd')).toEqual([]);
    expect(edgesOf(around('BR-PRODUCT-1', { records: [] }), 'same-prd')).toEqual([]);
  });

  it('keeps a node reached by two edges once, and both edges', () => {
    const both = entriesOf({
      [`${K}/product/principles.md`]: register('P', entry('P-PRODUCT-1', 'A principle.', { Why: 'x', Source: 'README.md' })),
      [`${K}/product/rules.md`]: register(
        'Rules',
        entry('BR-PRODUCT-1', 'One.', { Serves: 'P-PRODUCT-1', Source: 'README.md' }),
        entry('BR-PRODUCT-2', 'Two, beside BR-PRODUCT-1.', { Serves: 'P-PRODUCT-1', Source: 'README.md' }),
      ),
    });
    const built = around('BR-PRODUCT-1', { entries: both });
    expect(built.nodes.map(({ id }) => id)).toEqual(['BR-PRODUCT-1', 'P-PRODUCT-1', 'BR-PRODUCT-2']);
    expect(built.edges.map(({ kind }) => kind)).toEqual(['serves', 'cites', 'sibling']);
  });

  it('walks no further than depth 1: a node at hop 1 brings no edge of its own', () => {
    const built = around('BR-PRODUCT-1');
    expect(built.edges.every(({ from, to }) => from === 'BR-PRODUCT-1' || to === 'BR-PRODUCT-1')).toBe(true);
  });
});

describe('the product', () => {
  it('reads none with no Omni page, offline with one and no cache', () => {
    expect(productWithoutCache(null)).toEqual(NONE);
    expect(productWithoutCache('https://omni.example')).toEqual(OFFLINE);
  });

  it('says each state in its own line', () => {
    expect(productLine(NONE)).toBe('product knowledge: none — this repository belongs to no product.');
    expect(productLine(OFFLINE)).toBe("product knowledge: offline — no cached copy of the product's Legal and Glossary; only this repository's links are shown.");
    expect(productLine({ state: 'cached', key: 'omni-loop', cachedOn: '2026-10-16' })).toBe('product knowledge: cached 2026-10-16 (omni-loop).');
  });
});

describe('neighbourhoodText', () => {
  const text = (id: string, options: Parameters<typeof around>[1] = {}) => neighbourhoodText(around(id, options), options.entries ?? ENTRIES).split('\n');

  it('prints the start line, one aligned line per node, then the product line', () => {
    expect(text('BR-PRODUCT-1')).toEqual([
      'BR-PRODUCT-1 · rule · law, locked by @pierrederval — A pull request needs one approval while N-PRODUCT-1 holds.',
      '  up    serves       P-PRODUCT-1         principle  Every change is reviewed by a person.',
      '  down  enforced-by  test:kit/a.test.ts  test',
      '  down  enforced-by  test:kit/b.test.ts  test',
      '  down  governs      path:^kit/a/        path',
      '  down  governs      path:^kit/b\\.ts$    path',
      '  side  cites        N-PRODUCT-1         invariant  The ledger only grows.',
      '  side  sibling      BR-PRODUCT-2        rule       A draft is never merged.',
      '  side  same-prd     ADR-0001            adr        The first record',
      '  side  same-prd     ADR-0003            adr',
      "product knowledge: offline — no cached copy of the product's Legal and Glossary; only this repository's links are shown.",
    ]);
  });

  it('says a pending proof on the start line, and the status of a rule or a proposal', () => {
    expect(text('BR-PRODUCT-2')[0]).toBe('BR-PRODUCT-2 · rule · law, locked by @pierrederval · enforced by: pending #12 — A draft is never merged.');
    expect(text('BR-PRODUCT-3')[0]).toBe('BR-PRODUCT-3 · rule · rule — A quote shows its total.');
    expect(text('N-PRODUCT-1')[0]).toBe('N-PRODUCT-1 · invariant · proposed — The ledger only grows.');
    expect(text('P-PRODUCT-1')[0]).toBe('P-PRODUCT-1 · principle — Every change is reviewed by a person.');
  });

  it('reads a principle’s serving entries as down serves', () => {
    expect(text('P-PRODUCT-1').filter((line) => line.includes('serves'))).toEqual([
      '  down  serves    BR-PRODUCT-1  rule  A pull request needs one approval while N-PRODUCT-1 holds.',
      '  down  serves    BR-PRODUCT-2  rule  A draft is never merged.',
    ]);
  });

  it('prints at most 6 lines per edge kind, then how many more the JSON lists', () => {
    const many = Array.from({ length: 9 }, (_, i): DecisionRecord => ({ number: `000${i + 1}`, file: `${K}/adr/000${i + 1}-r.md`, title: `R${i + 1}`, prd: prd(3) }));
    const built = around('P-PRODUCT-1', { records: many });
    expect(built.edges.filter(({ kind }) => kind === 'same-prd')).toHaveLength(9);
    const lines = neighbourhoodText(built, ENTRIES).split('\n');
    const samePrd = lines.filter((line) => line.includes('same-prd'));
    expect(samePrd).toHaveLength(7);
    expect(samePrd[5]).toBe('  side  same-prd  ADR-0006      adr   R6');
    expect(samePrd[6]).toBe('  side  same-prd  … and 3 more (--json lists them all)');
  });

  it('prints a line for each node once, at the first edge that reaches it', () => {
    const both = entriesOf({
      [`${K}/product/rules.md`]: register(
        'Rules',
        entry('BR-PRODUCT-1', 'One.', { Serves: 'P-PRODUCT-1', Source: 'README.md' }),
        entry('BR-PRODUCT-2', 'Two, beside BR-PRODUCT-1.', { Serves: 'P-PRODUCT-1', Source: 'README.md' }),
      ),
      [`${K}/product/principles.md`]: register('P', entry('P-PRODUCT-1', 'A principle.', { Why: 'x', Source: 'README.md' })),
    });
    expect(text('BR-PRODUCT-1', { entries: both, product: NONE })).toEqual([
      'BR-PRODUCT-1 · rule · rule — One.',
      '  up    serves  P-PRODUCT-1   principle  A principle.',
      '  side  cites   BR-PRODUCT-2  rule       Two, beside BR-PRODUCT-1.',
      'product knowledge: none — this repository belongs to no product.',
    ]);
  });
});
