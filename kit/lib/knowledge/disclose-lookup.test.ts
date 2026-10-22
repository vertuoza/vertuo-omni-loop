// PRD 2346, s3: the lookup — a file's domain and layers, and each entry applying, global or hidden.
import { describe, expect, it } from 'vitest';
import { ConfigSchema } from '../config.ts';
import { knowledgeMap, lookup, lookupLine, placeOf, type LookupSources } from './disclose-lookup.ts';
import type { KnowledgeEntry } from './registers.ts';

const config = (extra: Record<string, unknown> = {}) => ConfigSchema.parse({ kit: 1, ...extra });

const MAPPED = config({
  layers: { db: ['^supabase/migrations/'], cli: ['^kit/bin/'] },
  flow: {
    areas: {
      ask: { paths: ['^kit/lib/ask/', '^apps/web/src/ask/'], knowledge: 'ask' },
      quote: { paths: ['^apps/quote/'], knowledge: 'quote' },
      tooling: { paths: ['^tools/'] },
    },
  },
});

/** One entry, with only what the lookup reads set. */
function entry(id: string, fields: Partial<KnowledgeEntry> = {}): KnowledgeEntry {
  return {
    id,
    kind: 'rule',
    scope: 'product',
    domain: 'product',
    codes: ['PRODUCT'],
    file: '.omni-loop/knowledge/product/rules.md',
    statement: `${id} holds. More words.`,
    why: null,
    decided: null,
    merged: null,
    source: null,
    serves: null,
    enforcedBy: null,
    enforced: false,
    pending: null,
    stated: null,
    proposed: null,
    locked: null,
    governs: null,
    layers: null,
    proposedLaw: null,
    pointsTo: null,
    kindLine: null,
    keptId: null,
    fieldCounts: {},
    problems: [],
    ...fields,
  };
}

const LOCK = { by: 'law-keeper', on: '2026-10-14' };
const inAsk = { scope: 'domain' as const, domain: 'ask', codes: ['ASK'], file: '.omni-loop/knowledge/domains/ask/rules.md' };
const inQuote = { scope: 'domain' as const, domain: 'quote', codes: ['QUOTE'], file: '.omni-loop/knowledge/domains/quote/rules.md' };

const SOURCES: LookupSources = {
  entries: [
    entry('P-PRODUCT-1', { kind: 'principle' }),
    entry('BR-PRODUCT-12', { ...inAsk, locked: LOCK, keptId: 'moved from product', layers: ['db'] }),
    entry('BR-ASK-1', inAsk),
    entry('BR-QUOTE-1', { ...inQuote, locked: LOCK }),
    entry('BR-QUOTE-2', inQuote),
    entry('BR-PRODUCT-3', { locked: LOCK, governs: ['^kit/plugin/skills/pr/'] }),
    entry('N-PRODUCT-15', { kind: 'invariant', locked: LOCK }),
    entry('BR-PRODUCT-90'),
    entry('BR-PRODUCT-91', { layers: ['database'] }),
    entry('BR-PRODUCT-92', { layers: ['job'] }),
    entry('DC-PRODUCT-1', { kind: 'contract' }),
  ],
  records: [
    { number: '0001', file: '.omni-loop/knowledge/adr/0001-a.md', title: 'ADR-0001 — Migrations only add', prd: null, layers: ['db'] },
    { number: '0002', file: '.omni-loop/knowledge/adr/0002-b.md', title: 'ADR-0002 — The ask API answers with a code', prd: null, domain: 'ask', layers: ['api'] },
    { number: '0003', file: '.omni-loop/knowledge/adr/0003-c.md', title: 'ADR-0003 — Untagged', prd: null },
    { number: '0004', file: '.omni-loop/knowledge/adr/0004-d.md', title: null, prd: null, layers: ['cli'] },
  ],
  legal: [{ id: 'L-GDPR-2', statement: 'Credentials are never logged in clear. Ever.', source: 'GDPR art. 32', owner: 'dpo' }],
  thesis: null,
};

const ids = (list: readonly { id: string }[]) => list.map(({ id }) => id);

describe('placeOf — a file’s domain and layers', () => {
  const map = knowledgeMap(MAPPED);

  it('reads the domain of the first area that matches, and every layer that matches', () => {
    expect(placeOf(map, 'apps/web/src/ask/ask.service.ts')).toEqual({ domain: 'ask', layers: [] });
    expect(placeOf(map, 'supabase/migrations/1_x.sql')).toEqual({ domain: null, layers: ['db'] });
    expect(placeOf(map, 'kit/bin/omni.ts')).toEqual({ domain: null, layers: ['cli'] });
  });

  it('gives no domain to a file of an area that names no knowledge folder, or of no area', () => {
    expect(placeOf(map, 'tools/x.ts')).toEqual({ domain: null, layers: [] });
    expect(placeOf(map, 'README.md')).toEqual({ domain: null, layers: [] });
  });

  it('says whether the repository maps anything', () => {
    expect(map.mapped).toBe(true);
    expect(knowledgeMap(config()).mapped).toBe(false);
    expect(knowledgeMap(config({ flow: { areas: { tooling: { paths: ['^tools/'] } } } })).mapped).toBe(false);
    expect(knowledgeMap(config({ layers: { db: ['^db/'] } })).mapped).toBe(true);
  });
});

describe('lookup — applies, global, hidden', () => {
  const map = knowledgeMap(MAPPED);

  it('applies an entry by its domain, saying so, and an ADR of that domain', () => {
    const found = lookup(SOURCES, map, ['apps/web/src/ask/ask.service.ts']);
    expect(found.applies.map(({ id, kind, why }) => ({ id, kind, why }))).toEqual([
      { id: 'BR-PRODUCT-12', kind: 'law', why: ['domain ask'] },
      { id: 'BR-ASK-1', kind: 'rule', why: ['domain ask'] },
      { id: 'ADR-0002', kind: 'adr', why: ['domain ask'] },
    ]);
  });

  it('applies by layer — an alias read as its layer — and by Governs:, and never a rule of another domain naming no layer', () => {
    const migration = lookup(SOURCES, map, ['supabase/migrations/1_x.sql']);
    expect(migration.applies.map(({ id, why }) => [id, why])).toEqual([
      ['BR-PRODUCT-12', ['layer db']],
      ['BR-PRODUCT-91', ['layer db']],
      ['ADR-0001', ['layer db']],
    ]);
    expect(ids(migration.applies)).not.toContain('BR-ASK-1');
    const skill = lookup(SOURCES, map, ['kit/plugin/skills/pr/SKILL.md']);
    expect(skill.applies.map(({ id, why }) => [id, why])).toEqual([['BR-PRODUCT-3', ['governs']]]);
  });

  it('names every reason an entry applies', () => {
    const both = lookup(SOURCES, map, ['apps/web/src/ask/a.ts', 'supabase/migrations/1_x.sql']);
    expect(both.applies.find(({ id }) => id === 'BR-PRODUCT-12')?.why).toEqual(['domain ask', 'layer db']);
  });

  it('keeps what nothing narrows global — laws first, then rules, then every Legal entry — and hides the rest, counting it', () => {
    const found = lookup(SOURCES, map, ['apps/web/src/ask/ask.service.ts']);
    // BR-PRODUCT-92 names a layer the repository maps no path to: no file can reach it, so it stays global.
    expect(found.global.map(({ id, kind }) => [id, kind])).toEqual([
      ['N-PRODUCT-15', 'law'],
      ['BR-PRODUCT-90', 'rule'],
      ['BR-PRODUCT-92', 'rule'],
      ['L-GDPR-2', 'legal'],
    ]);
    // BR-QUOTE-1 and BR-PRODUCT-3 are laws of other areas; BR-QUOTE-2 and BR-PRODUCT-91 rules; ADR-0001 and ADR-0004 records.
    expect(found.hidden).toEqual({ laws: 2, rules: 2, adrs: 2 });
  });

  it('never prints a principle, a contract or an untagged record', () => {
    const found = lookup(SOURCES, map, ['apps/web/src/ask/ask.service.ts', 'supabase/migrations/1_x.sql', 'kit/bin/omni.ts']);
    const printed = ids([...found.applies, ...found.global]);
    expect(printed).not.toContain('P-PRODUCT-1');
    expect(printed).not.toContain('DC-PRODUCT-1');
    expect(printed).not.toContain('ADR-0003');
    expect(printed).toContain('ADR-0004');
  });

  it('with nothing mapped, narrows nothing: every law is listed, a Governs: match applies, and a rule without one is not shown', () => {
    const found = lookup(SOURCES, knowledgeMap(config()), ['kit/plugin/skills/pr/SKILL.md']);
    expect(found.mapped).toBe(false);
    expect(found.applies.map(({ id, why }) => [id, why])).toEqual([['BR-PRODUCT-3', ['governs']]]);
    expect(ids(found.global)).toEqual(['BR-PRODUCT-12', 'BR-QUOTE-1', 'N-PRODUCT-15', 'L-GDPR-2']);
    expect(found.hidden.laws).toBe(0);
  });
});

describe('lookupLine', () => {
  const found = lookup(SOURCES, knowledgeMap(MAPPED), ['apps/web/src/ask/ask.service.ts', 'supabase/migrations/1_x.sql']);
  const line = (id: string) => {
    const one = [...found.applies, ...found.global].find((candidate) => candidate.id === id);
    if (one === undefined) throw new Error(`${id} not found`);
    return lookupLine(one, ['law-keeper']);
  };

  it('says what each entry is and why it applies', () => {
    expect(line('BR-PRODUCT-12')).toBe('law BR-PRODUCT-12 — BR-PRODUCT-12 holds. Changing it needs @law-keeper to approve the pull request. (domain ask, layer db)');
    expect(line('BR-ASK-1')).toBe('rule BR-ASK-1 — BR-ASK-1 holds. (domain ask)');
    expect(line('ADR-0002')).toBe('adr ADR-0002 — The ask API answers with a code (domain ask)');
    expect(line('ADR-0001')).toBe('adr ADR-0001 — Migrations only add (layer db)');
  });

  it('gives a global entry no reason, and a Legal entry its first sentence', () => {
    expect(line('N-PRODUCT-15')).toBe('law N-PRODUCT-15 — N-PRODUCT-15 holds. Changing it needs @law-keeper to approve the pull request.');
    expect(line('L-GDPR-2')).toBe('legal L-GDPR-2 — Credentials are never logged in clear.');
  });

  it('names a record with no title by its file', () => {
    const cli = lookup(SOURCES, knowledgeMap(MAPPED), ['kit/bin/omni.ts']).applies.find(({ id }) => id === 'ADR-0004');
    if (cli === undefined) throw new Error('ADR-0004 not found');
    expect(lookupLine(cli, [])).toBe('adr ADR-0004 — .omni-loop/knowledge/adr/0004-d.md (layer cli)');
  });
});
