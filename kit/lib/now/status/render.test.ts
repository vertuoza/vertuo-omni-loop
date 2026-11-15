// PRD #2906, slice s1: the block of a work's status, as `omni now --status` prints it — its lines in
// the spec's order, Next at most two items, Details (RAW…) only on a failed check and at most three
// lines, the work's Omni page else its GitHub issue, and the freshness line. Pure: no git, no disk.
import { describe, expect, it } from 'vitest';
import { parseIssue, parsePrd } from '../../ids.ts';
import { renderStatus, statusBlock } from './render.ts';
import { readStatus } from './steps.ts';
import type { FixStatusFacts, PrdStatusFacts, StatusChecked, StatusPullRequest } from './steps.ts';

const NOW = Date.parse('2026-11-15T10:00:00.000Z');
const JUST_NOW: StatusChecked = { at: '2026-11-15T10:00:00.000Z', fetch: 'answered' };
const PR_URL = 'https://github.com/acme/widgets/pull/2892';
const FOLDER = '.omni-loop/delivery/bugs/2891-budgets-ignore-raise';

const pr = (state: StatusPullRequest['state'], over: Partial<StatusPullRequest> = {}): StatusPullRequest => ({
  state,
  files: ['kit/lib/budget.test.ts', 'kit/lib/budget.ts'],
  checks: [{ name: 'test', state: 'pending' }],
  ...over,
});

const bug = (over: Partial<FixStatusFacts> = {}): FixStatusFacts => ({
  kind: 'bug',
  number: parseIssue(2891),
  title: 'Budgets ignore an approved raise',
  folder: FOLDER,
  branch: true,
  merged: false,
  pullRequest: pr('draft'),
  links: { page: 'https://www.omni-loop.xyz/app/bug/2891', issue: 'https://github.com/acme/widgets/issues/2891', pullRequest: PR_URL },
  checked: JUST_NOW,
  ...over,
});

const prd = (over: Partial<PrdStatusFacts> = {}): PrdStatusFacts => ({
  kind: 'prd',
  number: parsePrd(2906),
  title: 'A plain-language status',
  folder: 'inbox',
  approved: true,
  approvalWait: false,
  phase0Open: false,
  plan: true,
  slices: ['merged', 'merged'].map((state, i) => ({ id: `s${String(i + 1)}`, state })),
  openQuestions: 3,
  pullRequest: pr('draft', { checks: [] }),
  links: { page: 'https://www.omni-loop.xyz/app/prd/2906', issue: 'https://github.com/acme/widgets/issues/2906', pullRequest: 'https://github.com/acme/widgets/pull/2907' },
  checked: JUST_NOW,
  ...over,
});

describe('the block', () => {
  it('lays its lines out in the spec order: verdict, work, step, You, Next, links, freshness', () => {
    expect(statusBlock(bug(), NOW)).toEqual([
      '🟢 On track: the fix is done, and the automatic checks (the tests GitHub runs on every change) run on it.',
      '',
      'Bug fix #2891 · Budgets ignore an approved raise',
      'Step 4 of 6',
      '  ✓ Understood  ✓ Reproduced  ✓ Fixed  ▶ Fix done, checks running  ○ Your review  ○ Merged',
      '',
      'You: nothing to do right now.',
      'Next: once the checks pass, I mark it ready; then it is yours to review and merge (accept the change into the product).',
      '',
      'Bug page:     https://www.omni-loop.xyz/app/bug/2891',
      `Pull request: ${PR_URL}  (where the change is reviewed, then merged by you)`,
      'Checked just now.',
    ]);
  });

  it('reads a PRD whose questions wait: Waiting for you, how many, and where to answer them', () => {
    expect(statusBlock(prd(), NOW).slice(0, 8)).toEqual([
      '🟡 Waiting for you: the build is done, and 3 questions wait for your answer.',
      '',
      'PRD (the written plan of a feature) #2906 · A plain-language status',
      'Step 4 of 5',
      '  ✓ Planned  ✓ Built  ✓ Checked  ▶ Questions for you  ○ Shipped',
      '',
      'You: answer the 3 questions on its page (link below).',
      'Next: once you answer, your answers are taken into the build; then it comes to you for review.',
    ]);
  });

  it('holds at most two Next items', () => {
    const status = { ...readStatus(bug()), next: ['first', 'second', 'third'] };
    expect(renderStatus(status, bug(), NOW)).toContain('Next: first; second.');
  });

  it('shows Details (RAW…) only on a failed check, one line each, at most three, before the freshness line', () => {
    const failing = ['test', 'lint', 'typecheck', 'audit'].map((name) => ({ name, state: 'failure' as const }));
    const block = statusBlock(bug({ pullRequest: pr('draft', { checks: failing }) }), NOW);
    expect(block[0]).toBe('🔴 Stuck: 4 of the checks (the tests GitHub runs on every change) failed.');
    expect(block.slice(-4)).toEqual([
      "Details (RAW, the check's real name, for developers): test · failed",
      "Details (RAW, the check's real name, for developers): lint · failed",
      "Details (RAW, the check's real name, for developers): typecheck · failed",
      'Checked just now.',
    ]);
    expect(statusBlock(bug(), NOW).some((line) => line.startsWith('Details'))).toBe(false);
  });

  it("links the work's Omni page, else its GitHub issue", () => {
    expect(statusBlock(prd(), NOW)).toContain('PRD page:     https://www.omni-loop.xyz/app/prd/2906');
    const noPage = statusBlock(bug({ links: { page: null, issue: 'https://github.com/acme/widgets/issues/2891', pullRequest: PR_URL } }), NOW);
    expect(noPage).toContain('GitHub issue: https://github.com/acme/widgets/issues/2891');
    expect(noPage.some((line) => line.startsWith('Bug page'))).toBe(false);
  });

  it('explains the pull request on its link only when no line above did', () => {
    expect(statusBlock(bug({ pullRequest: pr('open') }), NOW)).toContain(`Pull request: ${PR_URL}  (where the change is reviewed, then merged by you)`);
    const above = statusBlock(bug({ pullRequest: null }), NOW);
    expect(above).toContain('Next: once it is reproduced, I fix it, and the fix gets its pull request (where the change is reviewed, then merged by you).');
    expect(above).toContain(`Pull request: ${PR_URL}`);
  });

  it('leaves the links out when the work has none', () => {
    const block = statusBlock(bug({ branch: false, pullRequest: null, links: { page: null, issue: null, pullRequest: null } }), NOW);
    expect(block.slice(-3)).toEqual(['Next: once it is understood, I reproduce it with a test that fails.', '', 'Checked just now.']);
  });

  it('says how fresh the facts are', () => {
    const at = '2026-11-15T09:53:00.000Z';
    const line = (checked: StatusChecked): string => statusBlock(bug({ checked }), NOW).at(-1) ?? '';
    expect(line(JUST_NOW)).toBe('Checked just now.');
    expect(line({ at, fetch: 'no-answer' })).toBe('Checked 7 min ago (GitHub did not answer).');
    expect(line({ at: null, fetch: 'no-answer' })).toBe('Not checked yet (GitHub did not answer).');
    expect(line({ at, fetch: 'not-asked' })).toBe('Checked 7 min ago.');
    expect(line({ at: '2026-11-15T09:59:40.000Z', fetch: 'not-asked' })).toBe('Checked just now.');
    expect(line({ at: '2026-11-15T09:59:40.000Z', fetch: 'no-answer' })).toBe('Checked 1 min ago (GitHub did not answer).');
    expect(line({ at: null, fetch: 'not-asked' })).toBe('Not checked with GitHub yet.');
  });
});
