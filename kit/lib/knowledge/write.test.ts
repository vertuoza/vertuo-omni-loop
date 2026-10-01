import { describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.ts';
import { makeMarkers } from '../markers.ts';
import { findOutboxViolations } from '../outbox/check-outbox.ts';
import { parseOutboxItem } from '../outbox/outbox.ts';
import {
  parseSettledEntries,
  renderAdoptedEntry,
  renderSettledEntry,
  settledHeader,
  type AnswerChannel,
  type SettledVerdict,
} from '../outbox/settle.ts';
import { gradeKnowledge } from './check-knowledge.ts';
import { harvestCandidates } from './harvest.ts';
import type { ClassificationReply } from './classify.ts';
import { applyKnowledgeWrites, decidedLine, writeKnowledge, type Taken, type WriteResult } from './write.ts';

/** The fixture's parsed item: every fixture here parses, so a miss is a broken fixture. */
function itemOf(text: string) {
  const { item } = parseOutboxItem(text);
  if (!item) throw new Error('fixture outbox item does not parse');
  return item;
}

const markers = makeMarkers('omni-outbox');
const K = '.omni-loop/knowledge';
const LEDGER = '.omni-loop/delivery/shipped/0028-outbox-check/outbox/settled.md';

function itemText({ id, rank = 'medium', raised = '2026-09-25' }: { id: string; rank?: string; raised?: string }): string {
  return [
    '---',
    `id: ${id}`,
    'prd: 28',
    'slice: s1',
    `rank: ${rank}`,
    'bears-on: none',
    `raised: ${raised}`,
    'wave: 1',
    '---',
    '',
    '## The question, in plain words',
    '',
    `Which way should ${id} go?`,
    '',
    '## The decision, in plain words',
    '',
    `It goes the simple way for ${id}.`,
    '',
    '## The options, in plain words',
    '',
    'A. Read base settings and head delivery as two snapshots, the option built.',
    'B. Read everything from the head.',
    '',
    '## What I had to decide',
    '',
    `Where ${id} reads its settings from.`,
    '',
    '## What I did meanwhile',
    '',
    `${id} reads the base branch.`,
    '',
    '## What it costs to change later',
    '',
    'One constant, and the tests that pin it.',
    '',
    '## What I could not know',
    '',
    '(author) Nothing settles it.',
    '',
  ].join('\n');
}

const parsed = (id: string, rank?: string) => {
  const text = itemText({ id, rank });
  return { text, item: itemOf(text) };
};

function adopted(id: string): string {
  const { text, item } = parsed(id);
  return renderAdoptedEntry({ item, itemText: text, markers });
}

function answered(
  id: string,
  {
    verdict,
    approvedBy = '@ada',
    basis = 'stated',
    reason = 'a human said so',
    channel,
    answer = 'Yes.',
  }: { verdict: SettledVerdict; approvedBy?: string; basis?: string; reason?: string; channel: AnswerChannel; answer?: string },
): string {
  const { text, item } = parsed(id, 'high');
  return renderSettledEntry({
    item,
    itemText: text,
    answer: { text: answer, approvedBy, approvedAt: '2026-09-22T10:00:00Z', channel },
    judgement: { verdict, basis, reason },
    markers,
  });
}

const FEATURE_PR: AnswerChannel = { kind: 'feature-pull-request', number: 12, url: 'https://github.com/acme/widgets/pull/12' };
const MERGE_PR: AnswerChannel = { kind: 'feature-pull-request', number: 29, url: 'https://github.com/acme/widgets/pull/29' };

const ledgerText = [
  settledHeader(28, { ctx: { config: { paths: { delivery: '.omni-loop/delivery' } } } }),
  adopted('s1-01-two-snapshots'),
  answered('s1-02-intro-cap', {
    verdict: 'adopted',
    approvedBy: '@grace',
    basis: 'merged-over-red',
    reason: 'the feature pull request merged while this item was open; merging adopts what was built',
    channel: MERGE_PR,
  }),
  answered('s1-03-one-run', { verdict: 'agreed', channel: { kind: 'prd-issue', number: 28 } }),
  adopted('s1-04-already'),
  adopted('s1-05-local'),
  answered('s1-06-reworked', { verdict: 'drifted', channel: FEATURE_PR, answer: 'No, read the head instead.' }).replace(
    /^- Closed: no .*$/m,
    '- Closed: yes — reworked in #40',
  ),
  adopted('s1-07-refused'),
].join('\n');

const FILES = {
  [`${K}/README.md`]: '# Knowledge\n',
  [`${K}/product/principles.md`]: [
    '# Product principles',
    '',
    '## P-PRODUCT-1',
    '',
    'A person reviews every change before it reaches the default branch.',
    '',
    'Why: nothing merges unseen.',
    'Decided: @ada, 2026-09-01',
    'Source: PRD #3',
    '',
  ].join('\n'),
  [`${K}/product/rules.md`]: '# Product rules\n\nNone yet. This file exists so the folder grades clean.\n',
  [`${K}/product/invariants.md`]: '# Product invariants\n\nNone yet.\n',
  [`${K}/domains/billing/README.md`]: '# Billing\n\nInvoices and credits.\n\nGlossary term: invoice\n',
  [`${K}/domains/billing/principles.md`]: '# Billing principles\n\nNone yet.\n',
  [`${K}/domains/billing/rules.md`]: '# Billing rules\n\nNone yet.\n',
  [`${K}/domains/billing/invariants.md`]: '# Billing invariants\n\nNone yet.\n',
  [`${K}/adr/README.md`]: '# Decisions\n',
  [`${K}/adr/0001-outbox-check-as-app.md`]: '# ADR-0001 — The outbox check runs as an app\n\nBody.\n',
  '.omni-loop/delivery/shipped/0028-outbox-check/spec.md': '# spec\n',
  [LEDGER]: ledgerText,
};

const MERGE = { by: 'grace', at: '2026-09-26T09:30:00Z', pr: 29, url: 'https://github.com/acme/widgets/pull/29' };
const DATE = '2026-09-27';

const REPLIES: Record<string, ClassificationReply | null> = {
  's1-01-two-snapshots': {
    kind: 'adr',
    title: 'The outbox check reads base settings and head delivery as two snapshots',
    statement: 'The check reads its settings from the base branch and the delivery files from the head.',
    reason: 'how the check is built',
  },
  's1-02-intro-cap': {
    kind: 'rule',
    place: 'product',
    statement: 'An intro or a punchline is refused only past 120 characters or when it is not in plain words.',
    serves: 'new',
    principle: { statement: 'A question reads well to a business person.', why: 'the person answering is not an engineer.' },
    reason: 'a provable rule with no principle yet',
  },
  's1-03-one-run': {
    kind: 'invariant',
    place: 'billing',
    statement: 'One billing run at a time per account.',
    reason: 'must always hold',
  },
  's1-04-already': { kind: 'covered', covers: 'ADR-0001', reason: 'the record says it' },
  's1-05-local': { kind: 'stays-here', statement: 'A local naming choice.', reason: 'a local choice,\nnothing lasting' },
  's1-06-reworked': {
    kind: 'rule',
    place: 'billing',
    statement: 'An invoice is read from the head.',
    serves: 'P-PRODUCT-1',
    reason: 'a billing rule',
  },
  's1-07-refused': null,
};

function setup({ taken }: { taken?: Taken } = {}) {
  const repo = makeRepo({ files: FILES });
  const candidates = harvestCandidates({ ctx: repo.ctx, prd: 28 });
  const classified = candidates.map((candidate) =>
    REPLIES[candidate.id] === null
      ? { candidate, reply: null, reason: "the model's reply was refused twice" }
      : { candidate, reply: REPLIES[candidate.id] ?? null },
  );
  const result = writeKnowledge({ ctx: repo.ctx, classified, merge: MERGE, taken, date: DATE });
  return { ...repo, candidates, result };
}

const byPath = (result: WriteResult): Record<string, string> =>
  Object.fromEntries(result.writes.map((write) => [write.path, write.text]));

describe('writeKnowledge', () => {
  it('writes a decision record exactly as the spec shows, past the default branch and the taken numbers', () => {
    const { result } = setup({ taken: { records: ['0002'] } });
    const files = byPath(result);
    expect(files[`${K}/adr/0003-the-outbox-check-reads-base-settings-and-head-delivery-as-two.md`]).toBe(
      [
        '# ADR-0003 — The outbox check reads base settings and head delivery as two snapshots',
        '',
        '**Status:** adopted · **Date:** 2026-09-26 · **PRD:** #28 · **Decided:** nobody — adopted when raised (medium), 2026-09-25 · **Merged:** @grace, 2026-09-26, PR #29',
        '',
        '## Context',
        '',
        'Where s1-01-two-snapshots reads its settings from.',
        '',
        '## Decision',
        '',
        'The check reads its settings from the base branch and the delivery files from the head.',
        '',
        'The option chosen: A. Read base settings and head delivery as two snapshots, the option built.',
        '',
        '## Consequences',
        '',
        'One constant, and the tests that pin it.',
        '',
        '## Source',
        '',
        `\`${LEDGER}\`, entry \`s1-01-two-snapshots\``,
        '',
      ].join('\n'),
    );
  });

  it('writes a rule serving new with its proposed principle, and drops "None yet." with the first entry', () => {
    const { result } = setup({ taken: { ids: ['BR-PRODUCT-1'] } });
    const files = byPath(result);
    expect(files[`${K}/product/rules.md`]).toBe(
      [
        '# Product rules',
        '',
        '## BR-PRODUCT-2',
        '',
        'An intro or a punchline is refused only past 120 characters or when it is not in plain words.',
        '',
        'Serves: P-PRODUCT-2',
        `Source: ${LEDGER}, entry s1-02-intro-cap, PRD #28`,
        'Enforced by: unenforced',
        'Stated: 2026-09-26',
        'Decided: @grace — merged over a red outbox, 2026-09-22',
        'Merged: @grace, 2026-09-26, PR #29',
        'Proposed: harvest 2026-09-27',
        '',
      ].join('\n'),
    );
    expect(files[`${K}/product/principles.md`]).toContain(
      [
        '## P-PRODUCT-2',
        '',
        'A question reads well to a business person.',
        '',
        'Why: the person answering is not an engineer.',
        `Source: ${LEDGER}, entry s1-02-intro-cap, PRD #28`,
        'Merged: @grace, 2026-09-26, PR #29',
        'Proposed: harvest 2026-09-27',
        '',
      ].join('\n'),
    );
    expect(files[`${K}/product/principles.md`]).not.toContain('Decided: @grace');
    expect(files[`${K}/product/principles.md`]!.startsWith(FILES[`${K}/product/principles.md`])).toBe(true);
  });

  it('puts an invariant in its domain, confirmed when a person answered', () => {
    const { result } = setup();
    expect(byPath(result)[`${K}/domains/billing/invariants.md`]).toBe(
      [
        '# Billing invariants',
        '',
        '## N-BILLING-1',
        '',
        'One billing run at a time per account.',
        '',
        `Source: ${LEDGER}, entry s1-03-one-run, PRD #28`,
        'Enforced by: unenforced',
        'Stated: 2026-09-26',
        'Decided: @ada via PRD issue #28, 2026-09-22',
        'Merged: @grace, 2026-09-26, PR #29',
        '',
      ].join('\n'),
    );
  });

  it('writes the ledger lines: Became for placed and covered, Stays here, and nothing for not placed', () => {
    const { result, ctx } = setup();
    const ledger = byPath(result)[LEDGER]!;
    const entries = Object.fromEntries(parseSettledEntries(ledger, ctx.markers).map((entry) => [entry.id, entry]));
    expect(entries['s1-01-two-snapshots']!.became).toEqual(['ADR-0002']);
    expect(entries['s1-02-intro-cap']!.became).toEqual(['BR-PRODUCT-1', 'P-PRODUCT-2']);
    expect(entries['s1-03-one-run']!.became).toEqual(['N-BILLING-1']);
    expect(entries['s1-04-already']!.became).toEqual(['ADR-0001']);
    expect(entries['s1-05-local']!.fields['Stays here']).toBe('a local choice, nothing lasting');
    expect(entries['s1-06-reworked']!.became).toEqual(['BR-BILLING-1']);
    expect(entries['s1-07-refused']!.became).toEqual([]);
    expect(entries['s1-07-refused']!.fields['Stays here']).toBeUndefined();
    expect(ledger.startsWith(ledgerText.split('<!-- omni-outbox-settled')[0]!)).toBe(true);
    expect(result.notPlaced).toEqual([{ id: 's1-07-refused', reason: "the model's reply was refused twice" }]);
    expect(result.placed.map((entry) => [entry.id, entry.landedAs])).toEqual([
      ['s1-01-two-snapshots', ['ADR-0002']],
      ['s1-02-intro-cap', ['BR-PRODUCT-1', 'P-PRODUCT-2']],
      ['s1-03-one-run', ['N-BILLING-1']],
      ['s1-04-already', ['ADR-0001']],
      ['s1-05-local', []],
      ['s1-06-reworked', ['BR-BILLING-1']],
    ]);
  });

  it('adds a ledger line to the latest entry of an id settled twice', () => {
    const repo = makeRepo({
      files: {
        ...FILES,
        [LEDGER]: [ledgerText, answered('s1-01-two-snapshots', { verdict: 'agreed', channel: FEATURE_PR })].join('\n'),
      },
    });
    const candidates = harvestCandidates({ ctx: repo.ctx, prd: 28 }).filter((c) => c.id === 's1-01-two-snapshots');
    const result = writeKnowledge({
      ctx: repo.ctx,
      classified: [{ candidate: candidates[0]!, reply: REPLIES['s1-01-two-snapshots'] ?? null }],
      merge: MERGE,
      date: DATE,
    });
    const ledger = byPath(result)[LEDGER]!;
    const blocks = ledger.split('<!-- omni-outbox-settled: s1-01-two-snapshots -->');
    expect(blocks[1]).not.toContain('Became:');
    expect(blocks[2]).toContain('- Wave: 1\n- Became: ADR-0002\n');
    const record = Object.entries(byPath(result)).find(([path]) => path.includes('/adr/0002-'))![1];
    expect(record).toContain('**Status:** accepted');
    expect(record).toContain('**Decided:** @ada via feature pull request #12, 2026-09-22');
  });

  it('records a reworked drift with the answer that asked for the change', () => {
    const repo = makeRepo({ files: FILES });
    const [candidate] = harvestCandidates({ ctx: repo.ctx, prd: 28 }).filter((c) => c.id === 's1-06-reworked');
    const reply: ClassificationReply = { kind: 'adr', title: 'Invoices read the head', statement: 'Invoices are read from the head.', reason: 'how it is built' };
    const { writes } = writeKnowledge({ ctx: repo.ctx, classified: [{ candidate: candidate!, reply }], merge: MERGE, date: DATE });
    const record = writes.find((write) => write.path.includes('/adr/'))!.text;
    expect(record).toContain('**Status:** accepted');
    expect(record).toContain('Invoices are read from the head.\n\nThe answer, as it was given: No, read the head instead.\n');
    expect(record).not.toContain('The option chosen');
  });

  it('marks provenance by who answered: Proposed and Status', () => {
    const { result } = setup();
    const files = byPath(result);
    expect(files[`${K}/domains/billing/rules.md`]).toContain('Decided: @ada via feature pull request #12, 2026-09-22');
    expect(files[`${K}/domains/billing/rules.md`]).not.toContain('Proposed:');
    expect(files[`${K}/domains/billing/invariants.md`]).not.toContain('Proposed:');
    const placed = Object.fromEntries(result.placed.map((entry) => [entry.id, entry]));
    expect(placed['s1-01-two-snapshots']).toMatchObject({ status: 'adopted', proposed: true });
    expect(placed['s1-03-one-run']).toMatchObject({ proposed: false });
    expect(placed['s1-06-reworked']).toMatchObject({ proposed: false });
  });

  it('gives a tree on which the knowledge and outbox checks are green', () => {
    const { result, ctx } = setup();
    applyKnowledgeWrites({ ctx, writes: result.writes });
    const files = [...new Set(result.writes.map((write) => write.path).filter((path) => /\/(principles|rules|invariants)\.md$/.test(path)))];
    expect(gradeKnowledge({ ctx, files }).violations).toEqual([]);
    expect(findOutboxViolations({ ctx })).toEqual([]);
  });

  it('numbers past the taken ids of an open knowledge branch, per register file', () => {
    const { result } = setup({ taken: { ids: ['BR-PRODUCT-4', 'P-PRODUCT-7', 'N-BILLING-2', 'BR-BILLING-1'], records: ['0005'] } });
    expect(result.placed.flatMap((entry) => entry.landedAs)).toEqual([
      'ADR-0006',
      'BR-PRODUCT-5',
      'P-PRODUCT-8',
      'N-BILLING-3',
      'ADR-0001',
      'BR-BILLING-2',
    ]);
  });

  it('touches no file', () => {
    const { result, read } = setup();
    expect(result.writes.length).toBeGreaterThan(0);
    expect(read(LEDGER)).toBe(ledgerText);
    expect(read(`${K}/product/rules.md`)).toBe(FILES[`${K}/product/rules.md`]);
  });
});

describe('decidedLine', () => {
  it('takes its three forms', () => {
    expect(decidedLine({ verdict: 'agreed', approvedBy: 'ada', approvedAt: '2026-09-22T10:00:00Z', channel: 'PRD issue #28' })).toBe(
      '@ada via PRD issue #28, 2026-09-22',
    );
    expect(decidedLine({ verdict: 'adopted', approvedBy: 'nobody', approvedAt: '2026-09-25' })).toBe(
      'nobody — adopted when raised (medium), 2026-09-25',
    );
    expect(decidedLine({ verdict: 'adopted', approvedBy: '@grace', approvedAt: '2026-09-26T09:30:00Z' })).toBe(
      '@grace — merged over a red outbox, 2026-09-26',
    );
  });
});
