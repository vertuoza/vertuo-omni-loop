// PRD #2906, slice s1: the step of a work, read from its facts (the spec's "How each step is read"),
// one row per line of its table, and the verdict: 🔴 on a failed check, a stuck part or a pull
// request closed without merging, 🟡 when You asks something, never 🟢 while a check is red or not
// known, and You never empty. Pure: no git, no disk.
import { describe, expect, it } from 'vitest';
import { parseIssue, parsePrd } from '../../ids.ts';
import { readStatus, statusOf } from './steps.ts';
import type { FixStatusFacts, PrdStatusFacts, StatusFacts, StatusPullRequest } from './steps.ts';

const LINKS = {
  page: 'https://omni.example/app/prd/2906',
  issueUrl: 'https://github.com/acme/widgets/issues/2906',
  pullRequest: 'https://github.com/acme/widgets/pull/2910',
};
const CHECKED = { at: '2026-11-15T10:00:00.000Z', fetch: 'answered' as const };
const GREEN = [{ name: 'test', state: 'success' as const }];

const prd = (over: Partial<PrdStatusFacts> = {}): PrdStatusFacts => ({
  kind: 'prd',
  number: parsePrd(2906),
  title: 'A plain-language status',
  folder: 'inbox',
  approved: false,
  approvalWait: false,
  phase0Open: false,
  plan: false,
  slices: null,
  openQuestions: 0,
  pullRequest: null,
  links: LINKS,
  checked: CHECKED,
  ...over,
});

const FOLDER = '.omni-loop/delivery/bugs/2891-budgets-ignore-raise';
const fix = (kind: 'bug' | 'visual', over: Partial<FixStatusFacts> = {}): FixStatusFacts => ({
  kind,
  number: parseIssue(2891),
  title: 'Budgets ignore an approved raise',
  folder: FOLDER,
  branch: false,
  merged: false,
  pullRequest: null,
  links: { ...LINKS, page: 'https://omni.example/app/bug/2891' },
  checked: CHECKED,
  ...over,
});

const pr = (state: StatusPullRequest['state'], over: Partial<StatusPullRequest> = {}): StatusPullRequest => ({ state, files: ['src/budget.ts'], checks: GREEN, ...over });
const slices = (merged: number, rest: string[] = []) => [...Array.from({ length: merged }, (_, i) => ({ id: `s${String(i + 1)}`, state: 'merged' })), ...rest.map((state, i) => ({ id: `s${String(merged + i + 1)}`, state }))];
const APPROVED = { approved: true, plan: true };
const ALL_MERGED = slices(6);

/** The step a work is at, as `Step <k> of <N> · <name>`. */
function stepOf(facts: StatusFacts): string {
  const status = statusOf(facts);
  const at = status.steps[status.at - 1];
  return `Step ${String(status.at)} of ${String(status.steps.length)} · ${at?.name ?? '?'}`;
}

describe('the step of a PRD, before it is approved', () => {
  it.each([
    ['Shaping the idea', prd({ folder: 'none' }), 'Step 1 of 4 · Shaping the idea'],
    ['Writing it down', prd(), 'Step 2 of 4 · Writing it down'],
    ['Waiting for your approval, while an approval wait runs', prd({ approvalWait: true }), 'Step 3 of 4 · Waiting for your approval'],
    ['Waiting for your approval, while its phase-0 PR is open', prd({ phase0Open: true }), 'Step 3 of 4 · Waiting for your approval'],
    ['Ready to build, approved with no slice started', prd({ ...APPROVED, slices: slices(0, ['runnable', 'blocked']) }), 'Step 4 of 4 · Ready to build'],
    ['Ready to build, approved with no board read', prd(APPROVED), 'Step 4 of 4 · Ready to build'],
  ])('%s', (_, facts, step) => {
    expect(stepOf(facts)).toBe(step);
  });

  it('shows the brainstorm steps, in their order, until it is approved', () => {
    expect(statusOf(prd()).steps.map((step) => step.name)).toEqual(['Shaping the idea', 'Writing it down', 'Waiting for your approval', 'Ready to build']);
  });
});

describe('the step of a PRD, once approved', () => {
  it.each([
    ['Planning, approved with no plan.md', prd({ approved: true }), 'Step 1 of 5 · Planning'],
    ['Building, k merged of n', prd({ ...APPROVED, slices: slices(4, ['in-flight', 'runnable']) }), 'Step 2 of 5 · Building (4 of 6 parts)'],
    ['Checking it all together, every slice merged and the feature PR a draft', prd({ ...APPROVED, slices: ALL_MERGED, pullRequest: pr('draft') }), 'Step 3 of 5 · Checking it all together'],
    ['Questions for you, every slice merged and questions open', prd({ ...APPROVED, slices: ALL_MERGED, openQuestions: 3, pullRequest: pr('draft') }), 'Step 4 of 5 · Questions for you'],
    ['Ready for your review, the feature PR open and not a draft', prd({ ...APPROVED, slices: ALL_MERGED, pullRequest: pr('open') }), 'Step 4 of 5 · Ready for your review'],
    ['Shipped, its folder in shipped', prd({ ...APPROVED, folder: 'shipped', slices: ALL_MERGED }), 'Step 5 of 5 · Shipped'],
  ])('%s', (_, facts, step) => {
    expect(stepOf(facts)).toBe(step);
  });

  it('shows the build steps, Ready for your review fifth unless questions wait', () => {
    expect(statusOf(prd({ approved: true })).steps.map((step) => step.name)).toEqual(['Planning', 'Building', 'Checking it all together', 'Ready for your review', 'Shipped']);
    expect(statusOf(prd({ ...APPROVED, slices: ALL_MERGED, openQuestions: 1 })).steps.map((step) => step.id)).toEqual(['planning', 'building', 'checking', 'questions', 'shipped']);
  });

  it('never reads Ready for your review while a question is open, even on an open feature PR (BR-PRODUCT-5)', () => {
    expect(stepOf(prd({ ...APPROVED, slices: ALL_MERGED, openQuestions: 2, pullRequest: pr('open') }))).toBe('Step 4 of 5 · Questions for you');
  });

  it('reads Shipped once the feature PR is merged, and a shipped folder whether or not it was approved', () => {
    expect(stepOf(prd({ ...APPROVED, slices: ALL_MERGED, pullRequest: pr('merged') }))).toBe('Step 5 of 5 · Shipped');
    expect(stepOf(prd({ folder: 'shipped' }))).toBe('Step 5 of 5 · Shipped');
  });

  it('counts a stuck or in-flight slice as started, not merged', () => {
    expect(stepOf(prd({ ...APPROVED, slices: slices(0, ['stuck', 'runnable']) }))).toBe('Step 2 of 5 · Building (0 of 2 parts)');
    expect(stepOf(prd({ ...APPROVED, slices: slices(0, ['claimed-stale']) }))).toBe('Step 2 of 5 · Building (0 of 1 parts)');
  });
});

describe('the step of a bug fix', () => {
  it.each([
    ['Understanding the bug, no fix branch', fix('bug'), 'Step 1 of 6 · Understanding the bug'],
    ['Trying to reproduce it, the fix branch and no pull request', fix('bug', { branch: true }), 'Step 2 of 6 · Trying to reproduce it'],
    [
      'Reproduced, fixing it, a draft changing tests and the fix folder only',
      fix('bug', { branch: true, pullRequest: pr('draft', { files: ['kit/lib/budget.test.ts', 'e2e/raise.spec.ts', `${FOLDER}/fix.md`] }) }),
      'Step 3 of 6 · Reproduced, fixing it',
    ],
    ['Fix done, checks running, a draft changing more than tests', fix('bug', { branch: true, pullRequest: pr('draft', { files: ['kit/lib/budget.test.ts', 'kit/lib/budget.ts'] }) }), 'Step 4 of 6 · Fix done, checks running'],
    ['Ready for your review, the pull request open', fix('bug', { branch: true, pullRequest: pr('open') }), 'Step 5 of 6 · Ready for your review'],
    ['Merged, its folder on the default branch', fix('bug', { merged: true }), 'Step 6 of 6 · Merged'],
  ])('%s', (_, facts, step) => {
    expect(stepOf(facts)).toBe(step);
  });

  it('reads Merged once its pull request is, and a draft whose files are not known as still fixing', () => {
    expect(stepOf(fix('bug', { branch: true, pullRequest: pr('merged') }))).toBe('Step 6 of 6 · Merged');
    expect(stepOf(fix('bug', { branch: true, pullRequest: pr('draft', { files: null }) }))).toBe('Step 3 of 6 · Reproduced, fixing it');
  });
});

describe('the step of a visual update', () => {
  it.each([
    ['Showing you options, no fix branch', fix('visual'), 'Step 1 of 5 · Showing you options'],
    ['Applying your pick, the fix branch and no pull request', fix('visual', { branch: true }), 'Step 2 of 5 · Applying your pick'],
    ['Checks running, a draft', fix('visual', { branch: true, pullRequest: pr('draft') }), 'Step 3 of 5 · Checks running'],
    ['Checks running, open with a check still running', fix('visual', { branch: true, pullRequest: pr('open', { checks: [...GREEN, { name: 'lint', state: 'pending' }] }) }), 'Step 3 of 5 · Checks running'],
    ['Ready for your review, open with its checks green', fix('visual', { branch: true, pullRequest: pr('open') }), 'Step 4 of 5 · Ready for your review'],
    ['Merged, its folder on the default branch', fix('visual', { merged: true }), 'Step 5 of 5 · Merged'],
  ])('%s', (_, facts, step) => {
    expect(stepOf(facts)).toBe(step);
  });
});

describe('the verdict', () => {
  it('is Stuck on a failed check, naming it in the details, at most three', () => {
    const failing = ['test', 'lint', 'typecheck', 'audit'].map((name) => ({ name, state: 'failure' as const }));
    const status = statusOf(fix('bug', { branch: true, pullRequest: pr('draft', { checks: [...GREEN, ...failing] }) }));
    expect(status.verdict).toEqual({ level: 'stuck', line: '🔴 Stuck: 4 of the checks failed.' });
    expect(status.details).toEqual(['test', 'lint', 'typecheck']);
    expect(statusOf(prd({ ...APPROVED, slices: ALL_MERGED, pullRequest: pr('open', { checks: failing.slice(0, 1) }) })).verdict.line).toBe('🔴 Stuck: one of the checks failed.');
  });

  it('is Stuck on a stuck slice', () => {
    expect(statusOf(prd({ ...APPROVED, slices: slices(2, ['stuck', 'in-flight']) })).verdict).toEqual({ level: 'stuck', line: '🔴 Stuck: a part of the build is stuck.' });
    expect(statusOf(prd({ ...APPROVED, slices: slices(0, ['stuck', 'stuck']) })).verdict.line).toBe('🔴 Stuck: 2 parts of the build are stuck.');
  });

  it('is Stopped on a pull request closed without merging, whatever else is red', () => {
    const closed = fix('visual', { branch: true, pullRequest: pr('closed', { checks: [{ name: 'test', state: 'failure' }] }) });
    expect(statusOf(closed).verdict).toEqual({ level: 'stuck', line: '🔴 Stopped: the pull request was closed without merging.' });
  });

  it('is Waiting for you when You asks something', () => {
    expect(statusOf(prd({ approvalWait: true })).verdict).toEqual({ level: 'waiting', line: '🟡 Waiting for you: the PRD is written and waits for your approval.' });
    expect(statusOf(prd({ ...APPROVED, slices: ALL_MERGED, openQuestions: 3, pullRequest: pr('draft') })).verdict.line).toBe('🟡 Waiting for you: the build is done, and 3 questions wait for your answer.');
    expect(statusOf(prd({ ...APPROVED, slices: ALL_MERGED, openQuestions: 1, pullRequest: pr('draft') })).verdict.line).toBe('🟡 Waiting for you: the build is done, and 1 question waits for your answer.');
    expect(statusOf(fix('bug', { pullRequest: pr('open') })).verdict.line).toBe('🟡 Waiting for you: the fix is ready for your review.');
  });

  it('is Waiting, not On track, while a pull request is open and its checks are not known', () => {
    const status = statusOf(fix('bug', { branch: true, pullRequest: pr('draft', { checks: null }) }));
    expect(status.verdict).toEqual({ level: 'waiting', line: '🟡 Waiting: the checks are not known right now (GitHub did not answer).' });
    expect(status.you).toBe('nothing to do right now.');
  });

  it('is On track when no check is involved, and when the checks are known and none failed', () => {
    expect(statusOf(fix('bug', { branch: true })).verdict).toEqual({ level: 'on-track', line: '🟢 On track: the bug is being reproduced with a test that fails.' });
    expect(statusOf(fix('bug', { branch: true, pullRequest: pr('draft', { checks: [{ name: 'test', state: 'pending' }] }) })).verdict.level).toBe('on-track');
    expect(statusOf(fix('bug', { branch: true, pullRequest: pr('draft', { checks: [] }) })).verdict.level).toBe('on-track');
  });

  it('is never On track while a check is red or not known, and You is never empty, on every step', () => {
    const everyStep: StatusFacts[] = [
      prd({ folder: 'none' }), prd(), prd({ approvalWait: true }), prd(APPROVED), prd({ approved: true }),
      prd({ ...APPROVED, slices: slices(4, ['in-flight', 'runnable']) }), prd({ ...APPROVED, slices: ALL_MERGED, pullRequest: pr('draft') }),
      prd({ ...APPROVED, slices: ALL_MERGED, openQuestions: 2, pullRequest: pr('draft') }), prd({ ...APPROVED, slices: ALL_MERGED, pullRequest: pr('open') }),
      prd({ folder: 'shipped' }),
      ...(['bug', 'visual'] as const).flatMap((kind) => [
        fix(kind), fix(kind, { branch: true }), fix(kind, { branch: true, pullRequest: pr('draft') }), fix(kind, { branch: true, pullRequest: pr('open') }), fix(kind, { merged: true }),
      ]),
    ];
    for (const facts of everyStep) {
      expect(statusOf(facts).you).not.toBe('');
      const open = facts.pullRequest ? [facts.pullRequest.state] : ['draft' as const];
      for (const state of open) {
        const red = { ...facts, pullRequest: pr(state, { checks: [{ name: 'test', state: 'failure' }] }) };
        const unknown = { ...facts, pullRequest: pr(state, { checks: null }) };
        if (state === 'merged') continue;
        expect(statusOf(red).verdict.level).toBe('stuck');
        expect(statusOf(unknown).verdict.level).not.toBe('on-track');
        expect(statusOf(red).you).not.toBe('');
      }
    }
  });
});

describe('the answer', () => {
  it('carries the kind, the steps, where it is, You, Next, the details and when it was checked', () => {
    expect(statusOf(fix('bug', { branch: true, pullRequest: pr('draft', { files: ['kit/lib/budget.test.ts'] }) }))).toEqual({
      verdict: { level: 'on-track', line: '🟢 On track: the bug is reproduced, and the fix is being written.' },
      kind: 'bug',
      steps: [
        { id: 'understanding', name: 'Understanding the bug', short: 'Understood' },
        { id: 'reproducing', name: 'Trying to reproduce it', short: 'Reproduced' },
        { id: 'fixing', name: 'Reproduced, fixing it', short: 'Fixed' },
        { id: 'fix-checks', name: 'Fix done, checks running', short: 'Checked' },
        { id: 'fix-review', name: 'Ready for your review', short: 'Your review' },
        { id: 'fix-merged', name: 'Merged', short: 'Merged' },
      ],
      at: 3,
      you: 'nothing to do right now.',
      next: ['once the fix is written, the automatic checks run on it'],
      details: [],
      checkedAt: '2026-11-15T10:00:00.000Z',
    });
  });

  it('keeps the technical words marked for the block, and prints them plain in the answer', () => {
    const facts = fix('bug', { branch: true, pullRequest: pr('draft') });
    expect(readStatus(facts).verdict.line).toBe('🟢 On track: the fix is done, and the automatic [[checks]] run on it.');
    expect(statusOf(facts).verdict.line).toBe('🟢 On track: the fix is done, and the automatic checks run on it.');
  });

  it('asks for the answers where they are given: the page, else the pull request', () => {
    const waiting = { ...APPROVED, slices: ALL_MERGED, openQuestions: 3, pullRequest: pr('draft') };
    expect(statusOf(prd(waiting)).you).toBe('answer the 3 questions on its page (link below).');
    expect(statusOf(prd({ ...waiting, openQuestions: 1, links: { ...LINKS, page: null } })).you).toBe('answer the question on its pull request (link below).');
  });

  it('names the person as the one who merges on every review (N-PRODUCT-15)', () => {
    for (const facts of [prd({ ...APPROVED, slices: ALL_MERGED, pullRequest: pr('open') }), fix('bug', { pullRequest: pr('open') }), fix('visual', { pullRequest: pr('open') })]) {
      expect(statusOf(facts).you).toBe('review the change (link below) and, if it is right, merge.');
    }
  });
});
