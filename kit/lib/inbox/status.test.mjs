import { describe, expect, it } from 'vitest';
import { deriveStatus, findFeaturePr, findSubPrs } from './status.mjs';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-09-23T00:00:00Z').getTime();
const STALL_DAYS = 5;
const prLinks = { feature: 'Closes #{prd}', sub: 'Part of #{prd}' };

function featurePr(overrides = {}) {
  return {
    number: 2000,
    body: 'Closes #1042\n\nSome description of the feature.',
    isDraft: true,
    state: 'OPEN',
    mergedAt: null,
    // Deliberately unrelated to the PRD number or topic — matching must not read this.
    headRefName: 'feat/some-unrelated-branch-name',
    baseRefName: 'main',
    ...overrides,
  };
}

function subPr(overrides = {}) {
  return {
    number: 2001,
    body: 'Part of #1042 · slice s1 of 3 · into `feat/some-unrelated-branch-name`',
    isDraft: false,
    state: 'OPEN',
    mergedAt: null,
    headRefName: 'feat/some-unrelated-branch-name--s1',
    baseRefName: 'feat/some-unrelated-branch-name',
    ...overrides,
  };
}

describe('deriveStatus', () => {
  // Feature: Status is derived, never written — Scenario: A PRD nobody has planned is unplanned
  it('is unplanned when no pull request closes the PRD', () => {
    const status = deriveStatus({
      prd: 1042,
      featurePrs: [],
      lastCommit: null,
      now: NOW,
      stallDays: STALL_DAYS,
      prLinks,
    });
    expect(status).toBe('unplanned');
  });

  it('ignores a pull request that closes a different PRD entirely', () => {
    const prs = [featurePr({ body: 'Closes #9999' })];
    const status = deriveStatus({
      prd: 1042,
      featurePrs: prs,
      lastCommit: null,
      now: NOW,
      stallDays: STALL_DAYS,
      prLinks,
    });
    expect(status).toBe('unplanned');
  });

  // Feature: Status is derived, never written — Scenario: A planned PRD is not mistaken for one in flight
  it('is planned when the feature pull request is a draft and no sub-PR has merged', () => {
    const prs = [featurePr(), subPr({ state: 'OPEN', mergedAt: null })];
    const status = deriveStatus({
      prd: 1042,
      featurePrs: prs,
      lastCommit: new Date(NOW).toISOString(),
      now: NOW,
      stallDays: STALL_DAYS,
      prLinks,
    });
    expect(status).toBe('planned');
  });

  it('is planned, never in-flight, with no sub-PR at all and the feature PR still draft', () => {
    const prs = [featurePr()];
    const status = deriveStatus({
      prd: 1042,
      featurePrs: prs,
      lastCommit: new Date(NOW).toISOString(),
      now: NOW,
      stallDays: STALL_DAYS,
      prLinks,
    });
    expect(status).toBe('planned');
  });

  it('is in-flight once a sub-PR merges, even while the feature PR is still draft', () => {
    const prs = [
      featurePr({ isDraft: true }),
      subPr({ state: 'MERGED', mergedAt: new Date(NOW).toISOString() }),
    ];
    const status = deriveStatus({
      prd: 1042,
      featurePrs: prs,
      lastCommit: new Date(NOW).toISOString(),
      now: NOW,
      stallDays: STALL_DAYS,
      prLinks,
    });
    expect(status).toBe('in-flight');
  });

  it('is in-flight once the feature pull request leaves draft, with no sub-PR merged', () => {
    const prs = [featurePr({ isDraft: false })];
    const status = deriveStatus({
      prd: 1042,
      featurePrs: prs,
      lastCommit: new Date(NOW).toISOString(),
      now: NOW,
      stallDays: STALL_DAYS,
      prLinks,
    });
    expect(status).toBe('in-flight');
  });

  // Feature: Status is derived, never written — Scenario: Work that has stopped is visible without anyone saying so
  it('is stalled when in flight and the branch has not moved for stallDays', () => {
    const prs = [featurePr({ isDraft: false })];
    const lastCommit = new Date(NOW - (STALL_DAYS + 1) * DAY_MS).toISOString();
    const status = deriveStatus({
      prd: 1042,
      featurePrs: prs,
      lastCommit,
      now: NOW,
      stallDays: STALL_DAYS,
      prLinks,
    });
    expect(status).toBe('stalled');
  });

  it('is not stalled a day short of stallDays', () => {
    const prs = [featurePr({ isDraft: false })];
    const lastCommit = new Date(NOW - (STALL_DAYS - 1) * DAY_MS).toISOString();
    const status = deriveStatus({
      prd: 1042,
      featurePrs: prs,
      lastCommit,
      now: NOW,
      stallDays: STALL_DAYS,
      prLinks,
    });
    expect(status).toBe('in-flight');
  });

  // Feature: Status is derived, never written — Scenario: A delivered PRD leaves the backlog
  it('is done once the feature pull request is merged, whatever the branch is doing', () => {
    const prs = [
      featurePr({
        state: 'MERGED',
        isDraft: false,
        mergedAt: new Date(NOW - 30 * DAY_MS).toISOString(),
      }),
    ];
    const lastCommit = new Date(NOW - 30 * DAY_MS).toISOString();
    const status = deriveStatus({
      prd: 1042,
      featurePrs: prs,
      lastCommit,
      now: NOW,
      stallDays: STALL_DAYS,
      prLinks,
    });
    expect(status).toBe('done');
  });

  it('matches the feature pull request by its body, never by its branch name', () => {
    const prs = [
      featurePr({ headRefName: 'totally-unrelated', baseRefName: 'main', isDraft: false }),
    ];
    const status = deriveStatus({
      prd: 1042,
      featurePrs: prs,
      lastCommit: new Date(NOW).toISOString(),
      now: NOW,
      stallDays: STALL_DAYS,
      prLinks,
    });
    expect(status).toBe('in-flight');
  });
});

describe('findFeaturePr', () => {
  it('finds the pull request whose body closes the PRD', () => {
    const prs = [featurePr()];
    expect(findFeaturePr(1042, prs, prLinks)).toBe(prs[0]);
  });

  it('returns null when no pull request closes the PRD', () => {
    expect(findFeaturePr(1042, [], prLinks)).toBeNull();
  });

  // Task 12's own new requirement: the link regex is built from the configured template with a
  // word boundary right after the number, so a longer PRD number never falsely matches.
  it('does not match a Closes # referring to a different, longer PRD number', () => {
    const prs = [featurePr({ body: 'Closes #1234' })];
    expect(findFeaturePr(123, prs, prLinks)).toBeNull();
  });
});

describe('findSubPrs', () => {
  it('finds every pull request that declares itself part of the PRD', () => {
    const prs = [
      featurePr(),
      subPr(),
      subPr({ number: 2002, body: 'Part of #1042 · slice s2 of 3' }),
      subPr({ number: 2003, body: 'Part of #9999 · slice s1 of 1' }),
    ];
    expect(findSubPrs(1042, prs, prLinks)).toHaveLength(2);
  });
});
