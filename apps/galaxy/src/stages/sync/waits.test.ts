import { describe, expect, it } from 'vitest';
import { syncConfig, type RepoSnapshot, type SnapshotPull, type SnapshotReview } from './core';
import { fakeWaitStore } from './waits.fake';
import { reconcileWaits, recordWaits, waitedPull, waitsOfPulls, type SeenWait, type StoredWait } from './waits';
import { parsePr, parsePrd } from 'omni-loop/kit/lib/ids.ts';

// The waits a repository's pull requests show (PRD 2377, s1): `review` and `merge`, with whose turn it is
// and since when (spec §1), then how they are kept (§2). Pure, and the store on its fake: no GitHub, no
// database.

const CONFIG = syncConfig('kit: 1\nrepo:\n  slug: acme/widgets\n  defaultBranch: trunk\n', 'acme/widgets');
const SYNC = '2026-10-20T12:00:00.000Z';

const pull = (number: number, head: string, more: Partial<SnapshotPull> = {}): SnapshotPull => ({
  number: parsePr(number), head, base: 'trunk', state: 'open', draft: false, merged_at: null, created_at: '2026-10-01T00:00:00Z',
  ready_at: null, labels: [], body: null, requested: [], requested_at: null, reviews: [], lawLocked: [], checksRed: false, ...more,
});
const review = (login: string, state: string, submitted_at: string): SnapshotReview => ({ login, state, submitted_at });

const snapshot = (pulls: SnapshotPull[], more: Partial<RepoSnapshot> = {}): RepoSnapshot => ({
  repository: 'Acme/Widgets', config: CONFIG, inbox: ['0042-dark-mode'], shipped: ['0041-light-mode'], issues: [], pulls, ...more,
});

const owners = new Map([[parsePrd(42), 'olga']]);
const waits = (pulls: SnapshotPull[], more: Partial<RepoSnapshot> = {}) => waitsOfPulls(snapshot(pulls, more), owners).waits;

describe('which pull requests the waits count', () => {
  const counted = (p: SnapshotPull) => waitedPull(CONFIG, snapshot([]), p);

  it('counts a feature PR and a phase-0 PR by their PRD, from the folder\'s topic or the link line', () => {
    expect(counted(pull(9, 'feat/dark-mode'))).toEqual({ prd: 42 });
    expect(counted(pull(9, 'feat/new-thing', { body: 'Ships it.\n\nCloses #77' }))).toEqual({ prd: 77 });
    expect(counted(pull(8, 'docs/phase-0-new-thing', { body: 'Refs #78' }))).toEqual({ prd: 78 });
    expect(counted(pull(8, 'docs/phase-0-light-mode'))).toEqual({ prd: 41 });
  });

  it('counts a bug fix or a visual update by its label, with no PRD', () => {
    expect(counted(pull(5, 'fix/crash', { labels: ['omni:bug'] }))).toEqual({ prd: null });
    expect(counted(pull(6, 'fix/darker', { labels: ['omni:visual'] }))).toEqual({ prd: null });
  });

  it('never counts a sub-PR, a pull request into another branch, a draft, a closed one, or one of no PRD', () => {
    expect(counted(pull(10, 'feat/dark-mode--s1', { base: 'feat/dark-mode' }))).toBeNull();
    expect(counted(pull(11, 'feat/dark-mode', { draft: true }))).toBeNull();
    expect(counted(pull(12, 'feat/dark-mode', { state: 'closed' }))).toBeNull();
    expect(counted(pull(13, 'feat/someone-elses'))).toBeNull();
    expect(counted(pull(14, 'chore/bump', { body: 'Closes #42' }))).toBeNull();
    expect(counted(pull(15, 'feat/new-thing', { body: 'Closes #771' }))).toEqual({ prd: 771 });
  });
});

describe('the review and merge waits of a repository', () => {
  it('a ready pull request with a reviewer asked and no review waits on that reviewer, since it was last made ready', () => {
    expect(waits([pull(9, 'feat/dark-mode', { requested: ['rita', 'acme/core'], ready_at: '2026-10-05T00:00:00Z' })])).toEqual([
      { prd: 42, pr: 9, kind: 'review', turn: ['rita', 'acme/core'], since: '2026-10-05T00:00:00Z' },
    ]);
  });

  it('a review asked again dates it; with neither, its opening; nobody asked is any approver', () => {
    expect(waits([pull(9, 'feat/dark-mode', { ready_at: '2026-10-05T00:00:00Z', requested_at: '2026-10-07T00:00:00Z', requested: ['rita'] })])[0]?.since)
      .toBe('2026-10-07T00:00:00Z');
    expect(waits([pull(9, 'feat/dark-mode')])).toEqual([{ prd: 42, pr: 9, kind: 'review', turn: [], since: '2026-10-01T00:00:00Z' }]);
  });

  it('a pull request whose latest review asked for changes waits on its author: no row, until a review is asked again', () => {
    const changes = [review('rita', 'COMMENTED', '2026-10-06T00:00:00Z'), review('rita', 'CHANGES_REQUESTED', '2026-10-06T01:00:00Z')];
    expect(waits([pull(9, 'feat/dark-mode', { reviews: changes, requested_at: '2026-10-05T00:00:00Z' })])).toEqual([]);
    expect(waits([pull(9, 'feat/dark-mode', { reviews: changes, requested_at: '2026-10-08T00:00:00Z', requested: ['rita'] })])).toEqual([
      { prd: 42, pr: 9, kind: 'review', turn: ['rita'], since: '2026-10-08T00:00:00Z' },
    ]);
  });

  it('an approved pull request whose checks are not red waits on its PRD\'s owner to merge, since the approval', () => {
    const approved = [review('rita', 'APPROVED', '2026-10-06T00:00:00Z'), review('sam', 'COMMENTED', '2026-10-07T00:00:00Z')];
    expect(waits([pull(9, 'feat/dark-mode', { reviews: approved })])).toEqual([
      { prd: 42, pr: 9, kind: 'merge', turn: ['olga'], since: '2026-10-06T00:00:00Z' },
    ]);
    expect(waits([pull(9, 'feat/dark-mode', { reviews: approved, checksRed: true })])).toEqual([]);
  });

  it('merge falls back to whoever approved, then to anyone who can merge', () => {
    const approved = [review('rita', 'APPROVED', '2026-10-06T00:00:00Z'), review('sam', 'APPROVED', '2026-10-07T00:00:00Z')];
    expect(waits([pull(5, 'fix/crash', { labels: ['omni:bug'], reviews: approved })])).toEqual([
      { prd: null, pr: 5, kind: 'merge', turn: ['rita', 'sam'], since: '2026-10-07T00:00:00Z' },
    ]);
    expect(waits([pull(9, 'feat/new-thing', { body: 'Closes #77', reviews: approved })])[0]?.turn).toEqual(['rita', 'sam']);
    expect(waits([pull(5, 'fix/crash', { labels: ['omni:bug'], reviews: [{ login: null, state: 'APPROVED', submitted_at: '2026-10-06T00:00:00Z' }] })])[0]?.turn)
      .toEqual([]);
  });

  it('an approval then a review asked again waits on the review; a dismissed approval approves nothing', () => {
    const approved = [review('rita', 'APPROVED', '2026-10-06T00:00:00Z')];
    expect(waits([pull(9, 'feat/dark-mode', { reviews: approved, requested_at: '2026-10-08T00:00:00Z', requested: ['rita'] })])[0]?.kind).toBe('review');
    expect(waits([pull(9, 'feat/dark-mode', { reviews: [...approved, review('rita', 'DISMISSED', '2026-10-07T00:00:00Z')] })])[0]?.kind).toBe('review');
  });

  it('counts no sub-PR, draft, closed pull request, nor one into another branch', () => {
    expect(waits([
      pull(10, 'feat/dark-mode--s1', { base: 'feat/dark-mode' }),
      pull(11, 'feat/dark-mode', { draft: true }),
      pull(12, 'feat/dark-mode', { state: 'closed', merged_at: '2026-10-09T00:00:00Z' }),
    ])).toEqual([]);
  });

  it('covers every pull request read, but not one whose reviews could not be read, and only review and merge', () => {
    const { covers } = waitsOfPulls(snapshot([pull(9, 'feat/dark-mode', { reviews: null }), pull(12, 'feat/dark-mode', { state: 'closed' })]), owners);
    expect(covers({ pr: parsePr(9), kind: 'review' })).toBe(false);
    expect(covers({ pr: parsePr(12), kind: 'merge' })).toBe(true);
    expect(covers({ pr: parsePr(13), kind: 'review' })).toBe(false);
    expect(covers({ pr: parsePr(12), kind: 'approval' })).toBe(false);
    expect(covers({ pr: null, kind: 'review' })).toBe(false);
  });

  it('nothing without a config', () => {
    expect(waitsOfPulls(snapshot([pull(9, 'feat/dark-mode')], { config: null }), owners).waits).toEqual([]);
  });
});

describe('keeping the waits (spec §2)', () => {
  const seen = (more: Partial<SeenWait> = {}): SeenWait => ({ prd: parsePrd(42), pr: parsePr(9), kind: 'review', turn: ['rita'], since: '2026-10-05T00:00:00Z', ...more });
  const stored = (more: Partial<StoredWait> = {}): StoredWait => ({ id: 'w1', ...seen(), seen_at: '2026-10-19T12:00:00.000Z', ...more });
  const all = () => true;

  it('opens a wait first seen, refreshes one still seen without moving its since, ends one no longer seen', () => {
    expect(reconcileWaits([], [seen()], all, SYNC)).toEqual({ opened: [{ ...seen(), seen_at: SYNC }], refreshed: [], ended: [] });
    expect(reconcileWaits([stored()], [seen({ turn: ['rita', 'sam'], since: '2026-10-09T00:00:00Z' })], all, SYNC))
      .toEqual({ opened: [], refreshed: [{ ...stored(), turn: ['rita', 'sam'], seen_at: SYNC }], ended: [] });
    expect(reconcileWaits([stored()], [], all, SYNC)).toEqual({ opened: [], refreshed: [], ended: ['w1'] });
  });

  it('a wait of another kind, or another PRD, is another wait', () => {
    expect(reconcileWaits([stored()], [seen({ kind: 'merge' })], all, SYNC)).toEqual({
      opened: [{ ...seen({ kind: 'merge' }), seen_at: SYNC }], refreshed: [], ended: ['w1'],
    });
  });

  it('ends nothing it does not cover', () => {
    expect(reconcileWaits([stored()], [], () => false, SYNC)).toEqual({ opened: [], refreshed: [], ended: [] });
  });
});

describe('the waits store, on its fake', () => {
  const WS = 'w-acme';
  const ready = pull(9, 'feat/dark-mode', { requested: ['rita'], ready_at: '2026-10-05T00:00:00Z' });
  const record = (store: ReturnType<typeof fakeWaitStore>, pulls: SnapshotPull[], at: string) =>
    recordWaits(store, WS, snapshot(pulls), at);

  it('keeps since across runs, and moves turn and seen_at', async () => {
    const store = fakeWaitStore();
    await record(store, [ready], '2026-10-06T00:00:00.000Z');
    await record(store, [{ ...ready, requested: ['rita', 'sam'], ready_at: '2026-10-06T00:00:00Z' }], SYNC);
    expect(store.rows).toEqual([expect.objectContaining({
      repo: 'acme/widgets', prd: 42, pr: 9, kind: 'review', turn: ['rita', 'sam'], since: '2026-10-05T00:00:00Z', seen_at: SYNC, ended_at: null,
    })]);
  });

  it('ends a wait no longer seen, keeps it, and opens a new row for one seen again', async () => {
    const store = fakeWaitStore();
    await record(store, [ready], '2026-10-06T00:00:00.000Z');
    await record(store, [{ ...ready, reviews: [review('rita', 'CHANGES_REQUESTED', '2026-10-07T00:00:00Z')] }], '2026-10-07T12:00:00.000Z');
    await record(store, [{ ...ready, reviews: [review('rita', 'CHANGES_REQUESTED', '2026-10-07T00:00:00Z')], requested_at: '2026-10-08T00:00:00Z' }], SYNC);
    expect(store.rows.map((r) => [r.kind, r.since, r.ended_at])).toEqual([
      ['review', '2026-10-05T00:00:00Z', '2026-10-07T12:00:00.000Z'],
      ['review', '2026-10-08T00:00:00Z', null],
    ]);
  });

  it('ends a merged pull request\'s wait, never deletes it', async () => {
    const store = fakeWaitStore();
    await record(store, [ready], '2026-10-06T00:00:00.000Z');
    await record(store, [{ ...ready, state: 'closed', merged_at: '2026-10-09T00:00:00Z', reviews: null }], SYNC);
    expect(store.rows.map((r) => [r.pr, r.ended_at])).toEqual([[9, SYNC]]);
  });

  it('ends nothing on a failed read: a pull request whose reviews were not read, or one the run did not list', async () => {
    const store = fakeWaitStore();
    await record(store, [ready, pull(5, 'fix/crash', { labels: ['omni:bug'] })], '2026-10-06T00:00:00.000Z');
    await record(store, [{ ...ready, reviews: null, lawLocked: null, checksRed: null }], SYNC);
    expect(store.rows.map((r) => [r.pr, r.seen_at, r.ended_at])).toEqual([
      [9, '2026-10-06T00:00:00.000Z', null],
      [5, '2026-10-06T00:00:00.000Z', null],
    ]);
  });

  it('reads the owners only of the PRDs a merge waits on, and none when no merge waits', async () => {
    const store = fakeWaitStore({ 42: 'olga' });
    await record(store, [pull(7, 'feat/dark-mode', { reviews: [review('rita', 'APPROVED', '2026-10-06T00:00:00Z')] }), pull(5, 'fix/crash', { labels: ['omni:bug'] })], SYNC);
    expect(store.ownerReads).toEqual([[42]]);
    expect(store.rows.map((r) => [r.pr, r.kind, r.turn])).toEqual([[7, 'merge', ['olga']], [5, 'review', []]]);
    await record(store, [ready], SYNC);
    expect(store.ownerReads).toEqual([[42]]);
  });

  it('keeps the other repositories\' and workspaces\' waits apart', async () => {
    const store = fakeWaitStore();
    await recordWaits(store, 'w-globex', snapshot([ready], { repository: 'globex/core' }), SYNC);
    await record(store, [], SYNC);
    expect(store.rows.map((r) => [r.workspace_id, r.repo, r.ended_at])).toEqual([['w-globex', 'globex/core', null]]);
  });
});
