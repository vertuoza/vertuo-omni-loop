// A fix PR answers a change to a law in its own folder, and a knowledge or enforce PR lists the laws
// it touches (PRD 1342, s7): `fixGateResult`, `fixOutboxContext`, `fixLawFailures`, `lawsTouched`.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { flatCtx } from '../../test/flat-layout.ts';
import { parsePrd } from '../ids.ts';
import { memorySource } from '../knowledge/registers.ts';
import { settleItem } from './settle.ts';
import { fixGateResult, fixLawFailures, fixOutboxContext, formatReport, lawsTouched } from './status.ts';

const FIX = 'docs/bugs/0123-crash';
const ISSUE = parsePrd(123);
const REMOVED_TEST = { path: 'kit/lib/proof.test.ts', status: 'D' };
const INVARIANTS = 'docs/knowledge/product/invariants.md';
const RISK = { storedShape: ['^db/'], sharedContract: ['libs/contract/'] };

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

/** A root whose knowledge folder holds one invariants file, `invariants` (empty: no law). */
function fixtureRoot(invariants = '') {
  const root = mkdtempSync(join(tmpdir(), 'status-fix-'));
  roots.push(root);
  mkdirSync(join(root, 'docs/knowledge/product'), { recursive: true });
  writeFileSync(join(root, INVARIANTS), invariants);
  return root;
}

function write(root: string, path: string, text: string) {
  mkdirSync(join(root, path, '..'), { recursive: true });
  writeFileSync(join(root, path), text);
}

function fixAccount(root: string, account: string) {
  const text = ['---', 'prd: 123', 'slice: s1', 'graded: 2026-10-10', '---', '', '## Risky changes', '', `- \`${REMOVED_TEST.path}\``, 'test-removed', account, ''];
  write(root, `${FIX}/outbox/accounts/fix.md`, text.join('\n'));
}

function fixItem(root: string, rank = 'high') {
  const file = `${FIX}/outbox/s1-01-proof.md`;
  const sections = [
    ['The question, in plain words', 'Should the old test go?'],
    ['The decision, in plain words', 'Yes, it tested nothing real.'],
    ['What I had to decide', 'x'],
    ['What I did meanwhile', 'Removed the test.'],
    ['What it costs to change later', 'z'],
    ['What I could not know', '(author) w'],
  ].flatMap(([heading, body]) => [`## ${heading}`, '', body, '']);
  const front = ['---', 'id: s1-01-proof', 'prd: 123', 'slice: s1', `rank: ${rank}`, 'bears-on: none', 'raised: 2026-10-10', 'wave: 1', '---', ''];
  write(root, file, [...front, ...sections].join('\n'));
  return file;
}

const law = (id: string, statement: string, enforcedBy: string) => [`## ${id}`, '', statement, '', `Enforced by: ${enforcedBy}`, ''].join('\n');

describe('fixGateResult — a fix PR answers a change to a law in its own folder', () => {
  it('is green, with nothing to answer, when the range fires no law rule', () => {
    const root = fixtureRoot();
    const changes = [{ path: 'src/a.ts', status: 'M' }, { path: 'libs/contract/x.ts', status: 'M' }, { path: 'db/m.sql', status: 'A' }];
    const result = fixGateResult({ ctx: flatCtx(root, { risk: RISK }), fix: { folder: FIX, number: ISSUE }, changes });
    expect(result).toMatchObject({ ok: true, items: [], unreworked: [], unaccounted: [], outbox: `${FIX}/outbox` });
  });

  it('is red on a removed test with no outbox in the fix folder, naming where it goes', () => {
    const result = fixGateResult({ ctx: flatCtx(fixtureRoot()), fix: { folder: FIX, number: ISSUE }, changes: [REMOVED_TEST] });
    expect(result.ok).toBe(false);
    expect(result.unaccounted).toEqual([{ ...REMOVED_TEST, rule: 'test-removed' }]);
    expect(fixLawFailures(result)).toEqual([
      `kit/lib/proof.test.ts (test-removed): a change to a law needs an item ranked high in ${FIX}/outbox/ and an account naming it in ${FIX}/outbox/accounts/.`,
    ]);
  });

  it('is red with no fix folder at all, saying the change has nowhere to be answered', () => {
    const result = fixGateResult({ ctx: flatCtx(fixtureRoot()), fix: null, changes: [REMOVED_TEST] });
    expect(result).toMatchObject({ ok: false, outbox: null, items: [] });
    expect(fixLawFailures(result)).toEqual([
      "kit/lib/proof.test.ts (test-removed): a change to a law needs an outbox in the fix's folder, and this range has no fix folder.",
    ]);
  });

  it('stays red while the high item is open, and is green once a person answered it', () => {
    const root = fixtureRoot();
    const file = fixItem(root);
    fixAccount(root, 'item s1-01-proof');
    const ctx = flatCtx(root);
    const open = fixGateResult({ ctx, fix: { folder: FIX, number: ISSUE }, changes: [REMOVED_TEST] });
    expect(open).toMatchObject({ ok: false, unaccounted: [], items: [{ file, id: 's1-01-proof', rank: 'high' }] });
    expect(fixLawFailures(open)).toEqual([]);

    const settled = settleItem({
      ctx: fixOutboxContext(ctx, FIX, ISSUE),
      file,
      answer: { text: 'Yes, remove it.', approvedBy: 'pierrederval', approvedAt: '2026-10-10', channel: { kind: 'feature-pull-request', number: 40 }, statedVerdict: 'agreed' },
    });
    expect(settled).toMatchObject({ ok: true, settledFile: `${FIX}/outbox/settled.md` });
    expect(fixGateResult({ ctx, fix: { folder: FIX, number: ISSUE }, changes: [REMOVED_TEST] })).toMatchObject({ ok: true, items: [], unaccounted: [] });
  });

  it('refuses a medium item, as a feature PR does', () => {
    const root = fixtureRoot();
    fixItem(root, 'medium');
    fixAccount(root, 'item s1-01-proof');
    const result = fixGateResult({ ctx: flatCtx(root), fix: { folder: FIX, number: ISSUE }, changes: [REMOVED_TEST] });
    expect(result.unaccounted).toEqual([{ ...REMOVED_TEST, rule: 'test-removed', refused: expect.stringContaining('ranked medium') }]);
    expect(fixLawFailures(result)).toEqual([expect.stringMatching(/^kit\/lib\/proof\.test\.ts \(test-removed\): .*ranked medium/)]);
  });

  it('is waved through by the override label', () => {
    const result = fixGateResult({ ctx: flatCtx(fixtureRoot()), fix: { folder: FIX, number: ISSUE }, changes: [REMOVED_TEST], labels: ['omni:outbox-go'] });
    expect(result).toMatchObject({ ok: true, overridden: true });
  });

  it('grades law-demoted against the base knowledge folder, and not without it', () => {
    const ctx = flatCtx(fixtureRoot());
    const base = memorySource({ [INVARIANTS]: law('N1', 'An invariant.', 'kit/lib/proof.test.ts') });
    const changes = [{ path: INVARIANTS, status: 'M' }];
    expect(fixGateResult({ ctx, fix: { folder: FIX, number: ISSUE }, changes, base }).unaccounted.map((change) => change.rule)).toEqual(['law-text', 'law-demoted']);
    expect(fixGateResult({ ctx, fix: { folder: FIX, number: ISSUE }, changes }).unaccounted.map((change) => change.rule)).toEqual(['law-text']);
  });

  it('reads only the fix folder\'s outbox, never a PRD\'s', () => {
    const root = fixtureRoot();
    write(root, 'docs/outbox/123/s1-01-other.md', 'not an item of the fix');
    const ctx = fixOutboxContext(flatCtx(root), FIX, ISSUE);
    expect(ctx.layout.outboxDir(parsePrd(9))).toBe(`${FIX}/outbox`);
    expect(ctx.layout.outboxDirs()).toEqual([]);
    fixItem(root);
    expect(ctx.layout.outboxDirs()).toEqual([{ prd: ISSUE, dir: `${FIX}/outbox`, shipped: false }]);
  });

  it('reports the fix by its subject, not as a PRD', () => {
    const result = fixGateResult({ ctx: flatCtx(fixtureRoot()), fix: { folder: FIX, number: ISSUE }, changes: [REMOVED_TEST] });
    const report = formatReport(ISSUE, result, { subject: `fix ${FIX}` });
    expect(report).toContain(`outbox-status — fix ${FIX}: no open item.`);
    expect(report).not.toContain('PRD #123');
    expect(formatReport(ISSUE, result)).toContain('outbox-status — PRD #123: no open item.');
  });
});

describe('lawsTouched — the laws a range touches', () => {
  it('names a law added, a law reworded and a law removed, and leaves an unchanged one out', () => {
    const root = fixtureRoot([law('N1', 'Kept.', 'unenforced'), law('N2', 'Reworded now.', 'unenforced'), law('N4', 'Added.', 'pending #9')].join('\n'));
    const base = memorySource({ [INVARIANTS]: [law('N1', 'Kept.', 'unenforced'), law('N2', 'Reworded.', 'unenforced'), law('N3', 'Gone.', 'unenforced')].join('\n') });
    const laws = lawsTouched([{ path: INVARIANTS, status: 'M' }], { ctx: flatCtx(root), base });
    expect(laws.map((touched) => touched.id)).toEqual(['N2', 'N3', 'N4']);
    expect(laws.find((touched) => touched.id === 'N3')).toEqual({ id: 'N3', statement: 'Gone.', file: INVARIANTS });
  });

  it('names a law whose proof the range changes, and one whose proof the range sets', () => {
    const root = fixtureRoot([law('N1', 'Proven.', 'kit/lib/proof.test.ts'), law('N2', 'Now proven.', 'kit/lib/other.test.ts'), law('N3', 'Untouched.', 'unenforced')].join('\n'));
    const base = memorySource({ [INVARIANTS]: [law('N1', 'Proven.', 'kit/lib/proof.test.ts'), law('N2', 'Now proven.', 'pending #9'), law('N3', 'Untouched.', 'unenforced')].join('\n') });
    const changes = [{ path: 'kit/lib/proof.test.ts', status: 'M' }, { path: INVARIANTS, status: 'M' }];
    expect(lawsTouched(changes, { ctx: flatCtx(root), base }).map((touched) => touched.id)).toEqual(['N1', 'N2']);
  });

  it('without a base, names the laws of a changed register file and of a changed proof', () => {
    const root = fixtureRoot([law('N1', 'Proven.', 'kit/lib/proof.test.ts'), law('N2', 'Other.', 'unenforced')].join('\n'));
    const ctx = flatCtx(root);
    expect(lawsTouched([{ path: 'kit/lib/proof.test.ts', status: 'M' }], { ctx }).map((touched) => touched.id)).toEqual(['N1']);
    expect(lawsTouched([{ path: INVARIANTS, status: 'M' }], { ctx }).map((touched) => touched.id)).toEqual(['N1', 'N2']);
    expect(lawsTouched([{ path: 'src/a.ts', status: 'M' }], { ctx })).toEqual([]);
  });

  it('names nothing when laws.source is not knowledge', () => {
    const root = fixtureRoot(law('N1', 'Proven.', 'kit/lib/proof.test.ts'));
    const ctx = flatCtx(root, { laws: { source: 'none' } });
    expect(lawsTouched([{ path: INVARIANTS, status: 'M' }], { ctx })).toEqual([]);
  });
});
