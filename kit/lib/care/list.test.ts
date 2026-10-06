// PRD 1118, slice s1: the pull requests a mega care run looks after, in merge order.
import { describe, expect, it } from 'vitest';
import { parseIssue, parsePr } from '../ids.ts';
import { FIX_PLAN_MARKER, foundEntry, fixPlanRows, linksPrd, mergeOrder } from './list.ts';
import type { CareListEntry, TargetStep } from './list.ts';

const pr = (n: number, state = 'OPEN') => ({ number: parsePr(n), state, url: `https://github.com/x/y/pull/${n}` });
const step = (name: string, over: Partial<TargetStep> = {}): TargetStep => ({
  name,
  slug: `acme/${name}`,
  planLanding: 1,
  wave: 1,
  landing: null,
  found: pr(40),
  ...over,
});
const PLAN: CareListEntry = { repo: 'acme/plan', number: parsePr(7), kind: 'plan', target: null, state: 'open', url: null };
const brief = (entries: CareListEntry[]) => entries.map((e) => `${e.kind} ${e.repo}#${e.number ?? '-'} ${e.state}`);

describe('mergeOrder', () => {
  it('puts target PRs by earliest wave, then in the order of ## Repositories, and the plan PR last', () => {
    const targets = [step('web', { wave: 2, found: pr(3) }), step('api', { wave: 2, found: pr(4) }), step('jobs', { wave: 1, found: pr(5) })];
    const entries = mergeOrder({ repositories: ['web', 'api', 'jobs'], targets, bugs: [], plan: PLAN });
    expect(brief(entries)).toEqual(['target acme/jobs#5 open', 'target acme/web#3 open', 'target acme/api#4 open', 'plan acme/plan#7 open']);
    expect(entries[0]).toMatchObject({ target: 'jobs', url: 'https://github.com/x/y/pull/5' });
  });

  it("puts landings by the plan's landing order first, each with its place in its target's chain", () => {
    const targets = [
      step('api', { planLanding: 2, landing: { landing: 2, count: 2, name: 'code' }, found: pr(12) }),
      step('web', { planLanding: 1, landing: { landing: 1, count: 1, name: 'expand' }, found: pr(21) }),
      step('api', { planLanding: 1, landing: { landing: 1, count: 2, name: 'expand' }, found: pr(11) }),
    ];
    const entries = mergeOrder({ repositories: ['api', 'web'], targets, bugs: [], plan: PLAN });
    expect(brief(entries)).toEqual(['landing acme/api#11 open', 'landing acme/web#21 open', 'landing acme/api#12 open', 'plan acme/plan#7 open']);
    expect(entries[2]).toMatchObject({ landing: { landing: 2, count: 2, name: 'code' } });
  });

  it('puts the linked bug fixes after the targets, in their own order, and before the plan PR', () => {
    const bug: CareListEntry[] = [
      { repo: 'acme/api', number: parsePr(50), kind: 'bug-fix', target: 'api', state: 'open', url: null, bug: parseIssue(30) },
      { repo: 'acme/plan', number: parsePr(51), kind: 'bug-record', target: null, state: 'open', url: null, bug: parseIssue(30) },
    ];
    expect(brief(mergeOrder({ repositories: ['api'], targets: [step('api')], bugs: [bug], plan: PLAN }))).toEqual([
      'target acme/api#40 open',
      'bug-fix acme/api#50 open',
      'bug-record acme/plan#51 open',
      'plan acme/plan#7 open',
    ]);
  });

  it('lists an unreadable repository as unreadable, and leaves out a target with no PR yet', () => {
    const targets = [step('api', { found: 'unreadable' }), step('web', { found: null })];
    expect(brief(mergeOrder({ repositories: ['api', 'web'], targets, bugs: [], plan: PLAN }))).toEqual(['target acme/api#- unreadable', 'plan acme/plan#7 open']);
  });

  it('puts a target named in no ## Repositories row after those that are', () => {
    const targets = [step('extra', { found: pr(9) }), step('api', { found: pr(4) })];
    expect(brief(mergeOrder({ repositories: ['api'], targets, bugs: [], plan: PLAN }))[0]).toBe('target acme/api#4 open');
  });
});

describe('foundEntry', () => {
  it('reads a found PR, an unreadable one and none', () => {
    const base = { repo: 'acme/api', kind: 'bug-fix' as const, target: 'api' };
    expect(foundEntry(base, pr(4, 'MERGED'))).toEqual({ ...base, number: 4, state: 'merged', url: 'https://github.com/x/y/pull/4' });
    expect(foundEntry(base, 'unreadable')).toEqual({ ...base, number: null, state: 'unreadable', url: null });
    expect(foundEntry(base, null)).toBeNull();
  });
});

describe('linksPrd', () => {
  it("reads a bug's For PRD line", () => {
    expect(linksPrd('Total wrong.\n\nFor PRD #1200\n', 1200)).toBe(true);
    expect(linksPrd('For PRD #12000', 1200)).toBe(false);
    expect(linksPrd('For PRD #120', 1200)).toBe(false);
    expect(linksPrd(null, 1200)).toBe(false);
  });
});

describe('fixPlanRows', () => {
  it("reads the fix plan's rows in order, each PR once, by reference or by link", () => {
    const body = [
      FIX_PLAN_MARKER,
      '| order | repository | what changes | pull request |',
      '| --- | --- | --- | --- |',
      '| 1 | backend | restore the total | acme/backend#41 |',
      '| 2 | frontend | read it | https://github.com/acme/frontend/pull/7 |',
      '| 3 | jobs | later | — |',
      '| 4 | backend | again | acme/backend#41 |',
    ].join('\n');
    expect(fixPlanRows(body)).toEqual([
      { slug: 'acme/backend', pr: 41 },
      { slug: 'acme/frontend', pr: 7 },
    ]);
  });

  it('reads nothing from a comment without the marker', () => {
    expect(fixPlanRows('| 1 | backend | x | acme/backend#41 |')).toEqual([]);
  });
});
