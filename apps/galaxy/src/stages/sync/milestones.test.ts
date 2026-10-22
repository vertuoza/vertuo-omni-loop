import { describe, expect, it } from 'vitest';
import { syncConfig, type RepoSnapshot, type ServerBorn, type SnapshotPull } from './core';
import { milestonesOfRepo } from './milestones';
import { parsePr, parsePrd } from 'omni-loop/kit/lib/ids.ts';

// The milestones a repository shows (PRD 2370, s1): a snapshot in, each PRD's milestones out, for a PRD of
// one lane (the repository itself). Pure: no GitHub, no database. Each test says what the repository holds.

const CONFIG = syncConfig('kit: 1\nrepo:\n  slug: acme/widgets\n  defaultBranch: trunk\nbranches:\n  feature: feature/{topic}\npaths:\n  delivery: loop/delivery\nlabels:\n  prd: product\n', 'acme/widgets');

const pull = (number: number, head: string, more: Partial<SnapshotPull> = {}): SnapshotPull => ({
  number: parsePr(number), head, base: 'trunk', state: 'open', draft: false, merged_at: null, created_at: '2026-09-20T00:00:00Z', ready_at: null, ...more,
});
const merged = (number: number, head: string, at: string, more: Partial<SnapshotPull> = {}) => pull(number, head, { state: 'closed', merged_at: at, ...more });
const slice = (number: number, at: string, base = 'feature/dark-mode') => merged(number, `feat/dark-mode--s${number}`, at, { base });

const snapshot = (more: Partial<RepoSnapshot> = {}): RepoSnapshot => ({
  repository: 'Acme/Widgets', config: CONFIG, inbox: [], shipped: [], issues: [], pulls: [], featureLink: 'Closes #{prd}', ...more,
});

const lines = (snap: RepoSnapshot, born: readonly ServerBorn[] = []) =>
  milestonesOfRepo(snap, born).map((m) => `${m.repository}#${m.prd} ${m.lane} ${m.milestone} ${m.pr === null ? '-' : `#${m.pr}`} ${m.reached_at}`).sort();

/** A shipped PRD 42 whose feature PR #9 merged, after two slices and a phase-0. */
const SHIPPED: Partial<RepoSnapshot> = {
  shipped: ['0042-dark-mode'],
  pulls: [
    merged(5, 'docs/phase-0-dark-mode', '2026-09-19T09:00:00Z'),
    merged(9, 'feature/dark-mode', '2026-09-28T10:00:00Z', { created_at: '2026-09-20T08:00:00Z', first_ready_at: '2026-09-26T12:00:00Z' }),
    slice(7, '2026-09-23T00:00:00Z'),
    slice(6, '2026-09-21T00:00:00Z'),
    pull(8, 'feat/dark-mode--s3', { base: 'feature/dark-mode' }),
    slice(11, '2026-09-29T00:00:00Z'),
    merged(12, 'feat/other--s1', '2026-09-20T00:00:00Z', { base: 'feature/other' }),
  ],
};

describe('the milestones a repository shows', () => {
  it('gives a merged PRD of one lane its approval, its feature PR\'s opening, slices, ready and merge, each with its pull request', () => {
    expect(lines(snapshot(SHIPPED))).toEqual([
      'acme/widgets#42 acme/widgets approved - 2026-09-19T09:00:00Z',
      'acme/widgets#42 acme/widgets first-slice #6 2026-09-21T00:00:00Z',
      'acme/widgets#42 acme/widgets last-slice #7 2026-09-23T00:00:00Z',
      'acme/widgets#42 acme/widgets merged #9 2026-09-28T10:00:00Z',
      'acme/widgets#42 acme/widgets opened #9 2026-09-20T08:00:00Z',
      'acme/widgets#42 acme/widgets ready #9 2026-09-26T12:00:00Z',
    ]);
  });

  it('dates ready at the feature PR\'s opening when it was opened ready, and not at all when its events were not read', () => {
    const opened = snapshot({ inbox: ['0042-dark-mode'], pulls: [pull(9, 'feature/dark-mode', { created_at: '2026-09-24T00:00:00Z', first_ready_at: null })] });
    expect(lines(opened)).toEqual([
      'acme/widgets#42 acme/widgets opened #9 2026-09-24T00:00:00Z',
      'acme/widgets#42 acme/widgets ready #9 2026-09-24T00:00:00Z',
    ]);
    const draft = snapshot({ inbox: ['0042-dark-mode'], pulls: [pull(9, 'feature/dark-mode', { draft: true, created_at: '2026-09-24T00:00:00Z' })] });
    expect(lines(draft)).toEqual(['acme/widgets#42 acme/widgets opened #9 2026-09-24T00:00:00Z']);
  });

  it('writes nothing GitHub does not date: no approval without a merged phase-0, no merge before it happens, never the sync\'s time', () => {
    const snap = snapshot({
      inbox: ['0042-dark-mode'],
      pulls: [pull(5, 'docs/phase-0-dark-mode'), pull(9, 'feature/dark-mode', { draft: true, created_at: '2026-09-22T00:00:00Z' })],
    });
    expect(lines(snap)).toEqual(['acme/widgets#42 acme/widgets opened #9 2026-09-22T00:00:00Z']);
    expect(lines(snapshot({ shipped: ['0042-dark-mode'] }))).toEqual([]);
  });

  it('reads the slices merged into the feature branch while its PR is still open, its last slice the latest so far', () => {
    const snap = snapshot({
      inbox: ['0042-dark-mode'],
      pulls: [pull(9, 'feature/dark-mode', { draft: true, created_at: '2026-09-20T08:00:00Z' }), slice(6, '2026-09-21T00:00:00Z'), slice(7, '2026-09-25T00:00:00Z')],
    });
    expect(lines(snap).filter((l) => l.includes('slice'))).toEqual([
      'acme/widgets#42 acme/widgets first-slice #6 2026-09-21T00:00:00Z',
      'acme/widgets#42 acme/widgets last-slice #7 2026-09-25T00:00:00Z',
    ]);
  });

  it('takes the merged feature PR over a closed one, and never counts a closed, unmerged pull request', () => {
    const snap = snapshot({
      shipped: ['0042-dark-mode'],
      pulls: [
        pull(3, 'feature/dark-mode', { state: 'closed', created_at: '2026-09-10T00:00:00Z', first_ready_at: '2026-09-11T00:00:00Z' }),
        merged(9, 'feature/dark-mode', '2026-09-28T10:00:00Z', { created_at: '2026-09-20T08:00:00Z', first_ready_at: null }),
        pull(6, 'feat/dark-mode--s1', { state: 'closed', base: 'feature/dark-mode' }),
      ],
    });
    expect(lines(snap)).toEqual([
      'acme/widgets#42 acme/widgets merged #9 2026-09-28T10:00:00Z',
      'acme/widgets#42 acme/widgets opened #9 2026-09-20T08:00:00Z',
      'acme/widgets#42 acme/widgets ready #9 2026-09-20T08:00:00Z',
    ]);
  });

  it('dates a PRD born on the server at its first approval, never its phase-0, and gives none while it waits', () => {
    const born = [{ prd: parsePrd(42), approved_at: '2026-09-18T15:00:00.000Z' }];
    expect(lines(snapshot(SHIPPED), born)).toContain('acme/widgets#42 acme/widgets approved - 2026-09-18T15:00:00.000Z');
    expect(lines(snapshot(SHIPPED), born).filter((l) => l.includes('approved'))).toHaveLength(1);
    expect(lines(snapshot(SHIPPED), [{ prd: parsePrd(42), approved_at: null }]).some((l) => l.includes('approved'))).toBe(false);
  });

  it('finds the lane of a PRD born on the server whose folder is not on the default branch by the feature PR naming it', () => {
    const born = [{ prd: parsePrd(12), approved_at: '2026-09-18T15:00:00.000Z' }, { prd: parsePrd(13), approved_at: null }];
    const snap = snapshot({
      pulls: [
        pull(20, 'feature/night-mode', { body: 'Closes #12\n\nThe night mode.', created_at: '2026-09-19T00:00:00Z', first_ready_at: '2026-09-25T00:00:00Z' }),
        merged(21, 'feat/night-mode--s1', '2026-09-22T00:00:00Z', { base: 'feature/night-mode', body: 'Part of #12' }),
        pull(22, 'fix/night-glare', { body: 'Closes #12', created_at: '2026-09-17T00:00:00Z' }),
        pull(23, 'feature/day-mode', { body: 'Closes #123', created_at: '2026-09-17T00:00:00Z' }),
        pull(24, 'feature/noon-mode', { body: 'Closes #14', created_at: '2026-09-17T00:00:00Z' }),
      ],
    });
    expect(lines(snap, born)).toEqual([
      'acme/widgets#12 acme/widgets approved - 2026-09-18T15:00:00.000Z',
      'acme/widgets#12 acme/widgets first-slice #21 2026-09-22T00:00:00Z',
      'acme/widgets#12 acme/widgets last-slice #21 2026-09-22T00:00:00Z',
      'acme/widgets#12 acme/widgets opened #20 2026-09-19T00:00:00Z',
      'acme/widgets#12 acme/widgets ready #20 2026-09-25T00:00:00Z',
    ]);
    const unlinked: RepoSnapshot = { repository: snap.repository, config: CONFIG, inbox: [], shipped: [], issues: [], pulls: snap.pulls };
    expect(lines(unlinked, born)).toEqual(['acme/widgets#12 acme/widgets approved - 2026-09-18T15:00:00.000Z']);
  });

  it('gives nothing for a repository without a config', () => {
    expect(milestonesOfRepo(snapshot({ ...SHIPPED, config: null }))).toEqual([]);
  });
});
