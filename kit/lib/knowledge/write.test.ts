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
import {
  applyKnowledgeWrites,
  decidedLine,
  lawWorthNote,
  writeKnowledge,
  type ChangedFile,
  type LawWorth,
  type Taken,
  type WriteResult,
} from './write.ts';
import { assertDefined } from '../../test/assert.ts';
import { parseIssue, parsePr, parsePrd } from '../ids.ts';

/** Law issue numbers, by candidate id, as the writer takes them. */
const issueNumbers = (numbers?: Record<string, number>) =>
  numbers && Object.fromEntries(Object.entries(numbers).map(([id, n]) => [id, parseIssue(n)]));

/** The fixture's parsed item: every fixture here parses, so a miss is a broken fixture. */
function itemOf(text: string) {
  const parsed = parseOutboxItem(text);
  if (!parsed.ok) throw new Error('fixture outbox item does not parse');
  return parsed.item;
}

const markers = makeMarkers('omni-outbox');
const K = '.omni-loop/knowledge';
const LEDGER = '.omni-loop/delivery/shipped/0028-outbox-check/outbox/settled.md';

function itemText({ id, rank = 'medium', raised = '2026-09-25' }: { id: string; rank?: string | undefined; raised?: string | undefined }): string {
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
  settledHeader(parsePrd(28), { ctx: { config: { paths: { delivery: '.omni-loop/delivery' } } } }),
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

const MERGE = { by: 'grace', at: '2026-09-26T09:30:00Z', pr: parsePr(29), url: 'https://github.com/acme/widgets/pull/29' };
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
  const candidates = harvestCandidates({ ctx: repo.ctx, prd: parsePrd(28) });
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
    const principles = files[`${K}/product/principles.md`];
    assertDefined(principles, 'the product principles');
    expect(principles.startsWith(FILES[`${K}/product/principles.md`])).toBe(true);
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
    const ledger = byPath(result)[LEDGER];
    assertDefined(ledger, 'ledger');
    const entries = Object.fromEntries(parseSettledEntries(ledger, ctx.markers).map((entry) => [entry.id, entry]));
    const entry = (id: string) => {
      const found = entries[id];
      assertDefined(found, `the ledger entry ${id}`);
      return found;
    };
    expect(entry('s1-01-two-snapshots').became).toEqual(['ADR-0002']);
    expect(entry('s1-02-intro-cap').became).toEqual(['BR-PRODUCT-1', 'P-PRODUCT-2']);
    expect(entry('s1-03-one-run').became).toEqual(['N-BILLING-1']);
    expect(entry('s1-04-already').became).toEqual(['ADR-0001']);
    expect(entry('s1-05-local').fields['Stays here']).toBe('a local choice, nothing lasting');
    expect(entry('s1-06-reworked').became).toEqual(['BR-BILLING-1']);
    expect(entry('s1-07-refused').became).toEqual([]);
    expect(entry('s1-07-refused').fields['Stays here']).toBeUndefined();
    const [header] = ledgerText.split('<!-- omni-outbox-settled');
    assertDefined(header, "the ledger's header");
    expect(ledger.startsWith(header)).toBe(true);
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
    const [first] = harvestCandidates({ ctx: repo.ctx, prd: parsePrd(28) }).filter((c) => c.id === 's1-01-two-snapshots');
    assertDefined(first, 'the candidate s1-01-two-snapshots');
    const result = writeKnowledge({
      ctx: repo.ctx,
      classified: [{ candidate: first, reply: REPLIES['s1-01-two-snapshots'] ?? null }],
      merge: MERGE,
      date: DATE,
    });
    const ledger = byPath(result)[LEDGER];
    assertDefined(ledger, 'ledger');
    const blocks = ledger.split('<!-- omni-outbox-settled: s1-01-two-snapshots -->');
    expect(blocks[1]).not.toContain('Became:');
    expect(blocks[2]).toContain('- Wave: 1\n- Became: ADR-0002\n');
    const found = Object.entries(byPath(result)).find(([path]) => path.includes('/adr/0002-'));
    assertDefined(found, 'the decision record written');
    const record = found[1];
    expect(record).toContain('**Status:** accepted');
    expect(record).toContain('**Decided:** @ada via feature pull request #12, 2026-09-22');
  });

  it('records a reworked drift with the answer that asked for the change', () => {
    const repo = makeRepo({ files: FILES });
    const [candidate] = harvestCandidates({ ctx: repo.ctx, prd: parsePrd(28) }).filter((c) => c.id === 's1-06-reworked');
    const reply: ClassificationReply = { kind: 'adr', title: 'Invoices read the head', statement: 'Invoices are read from the head.', reason: 'how it is built' };
    assertDefined(candidate, 'candidate');
    const { writes } = writeKnowledge({ ctx: repo.ctx, classified: [{ candidate: candidate, reply }], merge: MERGE, date: DATE });
    const recordWrite = writes.find((write) => write.path.includes('/adr/'));
    assertDefined(recordWrite, 'the decision record written');
    const record = recordWrite.text;
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

describe('writeKnowledge — Enforced by, from the paths the feature pull request changed (PRD 1171)', () => {
  const CHANGED: ChangedFile[] = [
    { path: 'kit/lib/foo.test.ts', status: 'added' },
    { path: 'kit/lib/bar.test.ts', status: 'modified' },
    { path: 'kit/lib/moved.test.ts', status: 'renamed' },
    { path: 'kit/lib/gone.test.ts', status: 'modified' },
    { path: 'kit/lib/old.test.ts', status: 'removed' },
  ];
  const TREE = {
    ...FILES,
    'kit/lib/foo.test.ts': 'test\n',
    'kit/lib/bar.test.ts': 'test\n',
    'kit/lib/moved.test.ts': 'test\n',
    'kit/lib/other.test.ts': 'test\n',
  };

  function run(replies: Record<string, ClassificationReply>, changed: ChangedFile[] = CHANGED) {
    const repo = makeRepo({ files: TREE });
    const candidates = harvestCandidates({ ctx: repo.ctx, prd: parsePrd(28) }).filter((c) => c.id in replies);
    const classified = candidates.map((candidate) => ({ candidate, reply: replies[candidate.id] ?? null }));
    const result = writeKnowledge({ ctx: repo.ctx, classified, merge: MERGE, date: DATE, changed });
    return { ...repo, result, files: byPath(result) };
  }
  const INVARIANT: ClassificationReply = { kind: 'invariant', place: 'billing', statement: 'One billing run at a time per account.', reason: 'must always hold' };
  const RULE: ClassificationReply = {
    kind: 'rule',
    place: 'billing',
    statement: 'An invoice is read from the head.',
    serves: 'P-PRODUCT-1',
    reason: 'a billing rule',
  };

  it('writes a kept path: changed by the pull request and still in the tree', () => {
    const { files, result } = run({ 's1-03-one-run': { ...INVARIANT, enforcedBy: ['kit/lib/foo.test.ts'] } });
    expect(files[`${K}/domains/billing/invariants.md`]).toContain('Enforced by: kit/lib/foo.test.ts\n');
    expect(result.placed[0]).toMatchObject({ enforcedBy: ['kit/lib/foo.test.ts'], dropped: [] });
  });

  it('writes two kept paths comma-separated, a renamed one among them', () => {
    const { files } = run({ 's1-06-reworked': { ...RULE, enforcedBy: ['kit/lib/foo.test.ts', 'kit/lib/moved.test.ts'] } });
    expect(files[`${K}/domains/billing/rules.md`]).toContain('Enforced by: kit/lib/foo.test.ts, kit/lib/moved.test.ts\n');
  });

  it('drops a path not changed, a removed path and a path gone from the tree, each with its reason', () => {
    const { files, result } = run({
      's1-06-reworked': {
        ...RULE,
        enforcedBy: ['kit/lib/other.test.ts', 'kit/lib/old.test.ts', 'kit/lib/gone.test.ts'],
      },
    });
    expect(files[`${K}/domains/billing/rules.md`]).toContain('Enforced by: unenforced\n');
    expect(result.placed[0]?.dropped).toEqual([
      { path: 'kit/lib/other.test.ts', reason: 'not changed by #29' },
      { path: 'kit/lib/old.test.ts', reason: 'removed by #29' },
      { path: 'kit/lib/gone.test.ts', reason: 'no longer in the tree' },
    ]);
    expect(result.placed[0]?.enforcedBy).toEqual([]);
  });

  it('keeps the paths it can and drops the rest, once each', () => {
    const { files, result } = run({
      's1-03-one-run': { ...INVARIANT, enforcedBy: ['kit/lib/bar.test.ts', 'kit/lib/other.test.ts', 'kit/lib/bar.test.ts'] },
    });
    expect(files[`${K}/domains/billing/invariants.md`]).toContain('Enforced by: kit/lib/bar.test.ts\n');
    expect(result.placed[0]?.dropped).toEqual([{ path: 'kit/lib/other.test.ts', reason: 'not changed by #29' }]);
  });

  it('writes unenforced with no proposal, and with no changed files at all', () => {
    expect(run({ 's1-03-one-run': INVARIANT }).files[`${K}/domains/billing/invariants.md`]).toContain('Enforced by: unenforced\n');
    const none = run({ 's1-03-one-run': { ...INVARIANT, enforcedBy: ['kit/lib/foo.test.ts'] } }, []);
    expect(none.files[`${K}/domains/billing/invariants.md`]).toContain('Enforced by: unenforced\n');
    expect(none.result.placed[0]?.dropped).toEqual([{ path: 'kit/lib/foo.test.ts', reason: 'not changed by #29' }]);
  });

  it('never gives a principle the line, and the result grades clean', () => {
    const { files, result, ctx } = run({
      's1-02-intro-cap': {
        kind: 'rule',
        place: 'product',
        statement: 'An intro is refused past 120 characters.',
        serves: 'new',
        principle: { statement: 'A question reads well to a business person.', why: 'the person answering is not an engineer.' },
        enforcedBy: ['kit/lib/foo.test.ts'],
        reason: 'a provable rule with no principle yet',
      },
    });
    expect(files[`${K}/product/rules.md`]).toContain('Enforced by: kit/lib/foo.test.ts\n');
    expect(files[`${K}/product/rules.md`]).toContain('Proposed: harvest 2026-09-27');
    expect(files[`${K}/product/principles.md`]).not.toContain('Enforced by');
    applyKnowledgeWrites({ ctx, writes: result.writes });
    const graded = [`${K}/product/rules.md`, `${K}/product/principles.md`];
    expect(gradeKnowledge({ ctx, files: graded }).violations).toEqual([]);
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

describe('writeKnowledge — worth a law? The three paths of a rule or an invariant (PRD 1342)', () => {
  const CHANGED: ChangedFile[] = [{ path: 'kit/lib/foo.test.ts', status: 'added' }];
  const TREE = { ...FILES, 'kit/lib/foo.test.ts': 'test\n' };
  const INVARIANT: ClassificationReply = { kind: 'invariant', place: 'billing', statement: 'One billing run at a time per account.', reason: 'must always hold' };
  const RULE: ClassificationReply = {
    kind: 'rule',
    place: 'billing',
    statement: 'An invoice is read from the head.',
    serves: 'P-PRODUCT-1',
    reason: 'a billing rule',
  };

  function run(
    replies: Record<string, ClassificationReply>,
    { worth = {}, lawIssues }: { worth?: Record<string, LawWorth>; lawIssues?: Record<string, number> } = {},
  ) {
    const repo = makeRepo({ files: TREE });
    const candidates = harvestCandidates({ ctx: repo.ctx, prd: parsePrd(28) }).filter((c) => c.id in replies);
    const classified = candidates.map((candidate) => ({ candidate, reply: replies[candidate.id] ?? null, worth: worth[candidate.id] ?? null }));
    const result = writeKnowledge({ ctx: repo.ctx, classified, merge: MERGE, date: DATE, changed: CHANGED, lawIssues: issueNumbers(lawIssues) });
    return { ...repo, result, files: byPath(result) };
  }
  const ledgerOf = (files: Record<string, string>) =>
    Object.fromEntries(parseSettledEntries(files[LEDGER] ?? '', markers).map((entry) => [entry.id, entry]));

  it('a law whose test the pull request changed is written with that test, whatever worthALaw says', () => {
    const { files, result } = run({ 's1-03-one-run': { ...INVARIANT, enforcedBy: ['kit/lib/foo.test.ts'], worthALaw: false } });
    expect(files[`${K}/domains/billing/invariants.md`]).toContain('Enforced by: kit/lib/foo.test.ts\n');
    expect(result.placed[0]).toMatchObject({ kind: 'invariant', landedAs: ['N-BILLING-1'] });
    expect(result.placed[0]?.law).toBeUndefined();
    expect(result.lawIssues).toEqual([]);
  });

  it('a "no" from the classifier stays in the ledger: not worth a law, no register entry', () => {
    const { files, result } = run({ 's1-03-one-run': { ...INVARIANT, worthALaw: false } });
    expect(files[`${K}/domains/billing/invariants.md`]).toBeUndefined();
    expect(result.placed).toEqual([
      expect.objectContaining({
        id: 's1-03-one-run',
        kind: 'stays-here',
        landedAs: [],
        files: [],
        ledgerLine: '- Stays here: not worth a law (classifier)',
        proposed: false,
        law: { worth: false, decidedBy: 'classifier', confidence: null, issue: null },
      }),
    ]);
    expect(ledgerOf(files)['s1-03-one-run']?.fields['Stays here']).toBe('not worth a law (classifier)');
    expect(result.lawIssues).toEqual([]);
  });

  it('a "no" from Jev names Jev and its score, even against the classifier', () => {
    const { result } = run(
      { 's1-03-one-run': { ...INVARIANT, worthALaw: true } },
      { worth: { 's1-03-one-run': { worth: false, decidedBy: 'Jev', confidence: 0.8 } } },
    );
    expect(result.placed[0]?.ledgerLine).toBe('- Stays here: not worth a law (Jev 0.80)');
    expect(result.lawIssues).toEqual([]);
  });

  it('a "yes" whose law issue is not open yet is held back, its ids kept, and names the issue to open', () => {
    const { files, result } = run({
      's1-03-one-run': { ...INVARIANT, worthALaw: true },
      's1-06-reworked': { ...RULE, enforcedBy: ['kit/lib/foo.test.ts'] },
    });
    expect(files[`${K}/domains/billing/invariants.md`]).toBeUndefined();
    expect(result.notPlaced).toEqual([{ id: 's1-03-one-run', reason: 'its law issue opens first' }]);
    expect(ledgerOf(files)['s1-03-one-run']?.became).toEqual([]);
    expect(result.lawIssues).toEqual([
      {
        id: 's1-03-one-run',
        entry: 'N-BILLING-1',
        register: `${K}/domains/billing/invariants.md`,
        statement: 'One billing run at a time per account.',
        source: `${LEDGER}, entry s1-03-one-run, PRD #28`,
        title: 'Law: One billing run at a time per account.',
        body: expect.stringContaining('`N-BILLING-1`') as unknown,
      },
    ]);
    const body = result.lawIssues[0]?.body ?? '';
    expect(body).toContain(`${K}/domains/billing/invariants.md`);
    expect(body).toContain(`${LEDGER}, entry s1-03-one-run, PRD #28`);
    expect(body).toContain('One billing run at a time per account.');
    expect(body).toContain('Where its test would live');
    expect(body).toContain('/omni:enforce');
    // The rule after it keeps the id it gets once the law is written.
    expect(files[`${K}/domains/billing/rules.md`]).toContain('## BR-BILLING-1');
  });

  it('a "yes" with its law issue open is written pending that issue', () => {
    const { files, result, ctx } = run(
      { 's1-03-one-run': { ...INVARIANT, worthALaw: false }, 's1-06-reworked': RULE },
      {
        worth: { 's1-03-one-run': { worth: true, decidedBy: 'Jev', confidence: 0.91 } },
        lawIssues: { 's1-03-one-run': 77 },
      },
    );
    expect(files[`${K}/domains/billing/invariants.md`]).toContain('## N-BILLING-1');
    expect(files[`${K}/domains/billing/invariants.md`]).toContain('Enforced by: pending #77\n');
    expect(result.placed.find((entry) => entry.id === 's1-03-one-run')).toMatchObject({
      kind: 'invariant',
      landedAs: ['N-BILLING-1'],
      enforcedBy: [],
      law: { worth: true, decidedBy: 'Jev', confidence: 0.91, issue: 77 },
    });
    expect(result.lawIssues).toEqual([]);
    // A reply without worthALaw and no decision is written as before: unenforced.
    expect(files[`${K}/domains/billing/rules.md`]).toContain('Enforced by: unenforced\n');
    applyKnowledgeWrites({ ctx, writes: result.writes });
    expect(gradeKnowledge({ ctx, files: [`${K}/domains/billing/invariants.md`, `${K}/domains/billing/rules.md`] }).violations).toEqual([]);
  });

  it('a rule serving new, held back, keeps both its ids and its principle out', () => {
    const intro = REPLIES['s1-02-intro-cap'];
    assertDefined(intro, 'the intro-cap reply');
    const { files, result } = run({ 's1-02-intro-cap': { ...intro, worthALaw: true } as ClassificationReply });
    expect(files[`${K}/product/rules.md`]).toBeUndefined();
    expect(files[`${K}/product/principles.md`]).toBeUndefined();
    expect(result.lawIssues.map((issue) => issue.entry)).toEqual(['BR-PRODUCT-1']);
  });
});

describe('lawWorthNote', () => {
  it('names who decided, and the score when there is one', () => {
    expect(lawWorthNote({ worth: false, decidedBy: 'classifier', confidence: null })).toBe('not worth a law (classifier)');
    expect(lawWorthNote({ worth: false, decidedBy: 'Jev', confidence: 0.6 })).toBe('not worth a law (Jev 0.60)');
  });
});
