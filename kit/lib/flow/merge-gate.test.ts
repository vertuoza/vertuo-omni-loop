import { describe, expect, it } from 'vitest';
import { parseConfig } from '../config.ts';
import { checkState, mergeGate, personApproved, type SubPr } from './merge-gate.ts';
import { resolveFlow } from './resolve.ts';

const KERNEL = `flow:
  rules:
    subPr: { requireChecks: [phpunit] }
  areas:
    kernel:
      paths: ['^src/kernel/']
      rules:
        subPr: { merge: rebase, requireChecks: [phpunit, phpstan-max], approval: person }
`;

const flowOf = (yaml: string) => resolveFlow(parseConfig(`kit: 1\n${yaml}`));

const pr = (over: Partial<SubPr> = {}): SubPr => ({
  number: 12,
  state: 'OPEN',
  base: 'feat/bus',
  head: 'feat/bus--s1',
  checks: [
    { name: 'phpunit', state: 'pass' },
    { name: 'phpstan-max', state: 'pass' },
  ],
  approvedBy: ['ada'],
  files: ['src/kernel/Bus/Dispatcher.php'],
  ...over,
});

const gate = (yaml: string, sub: SubPr, more: Partial<Parameters<typeof mergeGate>[0]> = {}) =>
  mergeGate({ flow: flowOf(yaml), pr: sub, territory: ['src/kernel/Bus/'], defaultBranch: 'main', open: [], ...more });

describe('mergeGate', () => {
  it("is today's squash with no flow", () => {
    const verdict = gate('', pr({ checks: [], approvedBy: [], files: ['src/Invoice.php'] }), { territory: ['src/Invoice.php'] });
    expect(verdict).toEqual({
      ok: true,
      method: 'squash',
      command: ['gh', 'pr', 'merge', '12', '--squash', '--delete-branch'],
      areas: ['default'],
      reasons: [],
      reported: [],
    });
  });

  it('refuses a kernel sub-PR no person approved, naming kernel: approval person (spec acceptance 8)', () => {
    const verdict = gate(KERNEL, pr({ approvedBy: [] }));
    expect(verdict.ok).toBe(false);
    expect(verdict.command).toBeNull();
    expect(verdict.reasons).toEqual(['kernel: approval person — no person has approved #12']);
  });

  it('merges a kernel sub-PR with rebase once approved and green (spec acceptance 8)', () => {
    const verdict = gate(KERNEL, pr());
    expect(verdict).toMatchObject({ ok: true, method: 'rebase', areas: ['kernel'] });
    expect(verdict.command).toEqual(['gh', 'pr', 'merge', '12', '--rebase', '--delete-branch']);
  });

  it('names --repo in the command when the sub-PR lives in another repository', () => {
    expect(gate('', pr(), { repo: 'acme/back' }).command).toEqual(['gh', 'pr', 'merge', '12', '--squash', '--delete-branch', '--repo', 'acme/back']);
  });

  it.each([
    [[{ name: 'phpunit', state: 'pass' as const }], 'kernel: requireChecks phpstan-max — phpstan-max has not run on #12'],
    [[{ name: 'phpunit', state: 'pending' as const }, { name: 'phpstan-max', state: 'pass' as const }], 'default: requireChecks phpunit — phpunit is pending on #12'],
    [[{ name: 'phpunit', state: 'pass' as const }, { name: 'phpstan-max', state: 'fail' as const }], 'kernel: requireChecks phpstan-max — phpstan-max failed on #12'],
  ])('refuses a required check that is not green: %j', (checks, reason) => {
    const verdict = gate(KERNEL, pr({ checks, files: ['src/kernel/Bus/Dispatcher.php', 'src/Invoice.php'] }), {
      territory: ['src/kernel/Bus/', 'src/Invoice.php'],
    });
    expect(verdict.ok).toBe(false);
    expect(verdict.reasons).toEqual([reason]);
  });

  it('reports a diff outside the territory by default, and merges', () => {
    const verdict = gate('', pr({ files: ['src/kernel/Bus/Dispatcher.php', 'README.md'] }));
    expect(verdict).toMatchObject({ ok: true, reported: ['README.md is outside the slice\'s territory'] });
  });

  it('refuses a diff outside the territory under territory: block', () => {
    const yaml = 'flow:\n  rules:\n    subPr: { territory: block }\n';
    const verdict = gate(yaml, pr({ files: ['src/kernel/Bus/Dispatcher.php', 'README.md'] }));
    expect(verdict.ok).toBe(false);
    expect(verdict.reasons).toEqual(["default: territory block — README.md is outside the slice's territory"]);
  });

  it('refuses under territory: block when the slice is not known, and reports it otherwise', () => {
    const yaml = 'flow:\n  rules:\n    subPr: { territory: block }\n';
    expect(gate(yaml, pr(), { territory: null }).reasons).toEqual([
      "default: territory block — #12's head feat/bus--s1 is no slice of a plan here, so its territory is not known",
    ]);
    expect(gate('', pr(), { territory: null })).toMatchObject({
      ok: true,
      reported: ["#12's head feat/bus--s1 is no slice of a plan here: its diff was not compared with a territory"],
    });
  });

  it('meets the areas of the diff as well as of the territory', () => {
    const verdict = gate(KERNEL, pr({ approvedBy: [], files: ['src/Invoice.php', 'src/kernel/Bus/Dispatcher.php'] }), { territory: ['src/Invoice.php'] });
    expect(verdict.areas).toEqual(['default', 'kernel']);
    expect(verdict.reasons).toContain('kernel: approval person — no person has approved #12');
  });

  it('refuses past maxOpen, counting the open sub-PRs of the area', () => {
    const yaml = "flow:\n  areas:\n    kernel:\n      paths: ['^src/kernel/']\n      rules:\n        subPr: { maxOpen: 1 }\n";
    const open = [
      { number: 12, territory: ['src/kernel/Bus/'] },
      { number: 13, territory: ['src/kernel/Log/'] },
      { number: 14, territory: ['src/Invoice.php'] },
    ];
    expect(gate(yaml, pr(), { open }).reasons).toEqual(['kernel: maxOpen 1 — 2 of its sub-PRs are open: #12, #13']);
    expect(gate(yaml, pr(), { open: open.filter(({ number }) => number !== 13) }).ok).toBe(true);
  });

  it('refuses two merge methods on one slice', () => {
    const yaml = "flow:\n  areas:\n    kernel:\n      paths: ['^src/kernel/']\n      rules:\n        subPr: { merge: rebase }\n    web:\n      paths: ['^web/']\n      rules:\n        subPr: { merge: merge }\n";
    const verdict = gate(yaml, pr({ files: ['src/kernel/a', 'web/b'] }), { territory: ['src/kernel/', 'web/'] });
    expect(verdict.ok).toBe(false);
    expect(verdict.reasons).toEqual(['kernel, web: merge — two merge methods on one slice (kernel rebase, web merge): split the slice']);
  });

  it('never merges into the default branch, nor a sub-PR that is not open', () => {
    expect(gate('', pr({ base: 'main' })).reasons).toEqual(['#12 targets main, the default branch: a person merges there']);
    expect(gate('', pr({ state: 'MERGED' })).reasons).toEqual(['#12 is not open (MERGED)']);
  });
});

describe('checkState', () => {
  it.each([
    [[{ __typename: 'CheckRun', name: 'a', status: 'COMPLETED', conclusion: 'SUCCESS' }], 'pass'],
    [[{ __typename: 'CheckRun', name: 'a', status: 'COMPLETED', conclusion: 'SKIPPED' }], 'pass'],
    [[{ __typename: 'CheckRun', name: 'a', status: 'IN_PROGRESS', conclusion: '' }], 'pending'],
    [[{ __typename: 'CheckRun', name: 'a', status: 'COMPLETED', conclusion: 'FAILURE' }], 'fail'],
    [[{ __typename: 'StatusContext', context: 'a', state: 'SUCCESS' }], 'pass'],
    [[{ __typename: 'StatusContext', context: 'a', state: 'PENDING' }], 'pending'],
    [[{ __typename: 'StatusContext', context: 'a', state: 'ERROR' }], 'fail'],
  ])('reads %j as %s', (rollup, state) => {
    expect(checkState(rollup)).toEqual([{ name: 'a', state }]);
  });

  it('keeps the worst of two runs with one name', () => {
    expect(checkState([
      { __typename: 'CheckRun', name: 'a', status: 'COMPLETED', conclusion: 'SUCCESS' },
      { __typename: 'CheckRun', name: 'a', status: 'COMPLETED', conclusion: 'FAILURE' },
    ])).toEqual([{ name: 'a', state: 'fail' }]);
  });
});

describe('personApproved', () => {
  it('keeps each person whose last deciding review approves, never a bot', () => {
    expect(personApproved([
      { author: { login: 'ada' }, state: 'APPROVED' },
      { author: { login: 'ada' }, state: 'COMMENTED' },
      { author: { login: 'bob' }, state: 'APPROVED' },
      { author: { login: 'bob' }, state: 'CHANGES_REQUESTED' },
      { author: { login: 'omni[bot]' }, state: 'APPROVED' },
      { author: null, state: 'APPROVED' },
    ])).toEqual(['ada']);
  });
});
