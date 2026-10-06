import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { Priority } from '@omni/github';
import type { GithubSummary } from '../dossier/github/summary';
import type { DossierRef } from '../dossier/github/reader';
import { fakeSnapshotStore, type FakeSnapshotStore } from '../dossier/snapshot/store.fake';
import type { SnapshotDeps } from '../dossier/snapshot/snapshot';
import { STAGE_SIGNATURE_HEADER } from '../stages/event/event';
import { parseIssue, parsePr, parsePrd, type PrdNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { parseTouch, receiveTouch, refreshAfterTouch, topicOfBranch, type TouchedDeps } from './touched';

vi.mock('server-only', () => ({}));

// Webhooks say what changed (PRD 902, s3): omni-app forwards a touch, galaxy marks the dossiers it names
// stale and refreshes them under the lease, with one follow-up read for the touches that land meanwhile.

const SECRET = 'stage-secret';
const WS = 'ws-acme';
const REPO = 'Acme/Widgets';
const sign = (body: string, secret = SECRET) => `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

const summary = (prd: PrdNumber, more: Partial<GithubSummary> = {}): GithubSummary => ({
  repo: REPO, prd, folder: `0${prd}-topic`, topic: 'topic',
  issue: { number: parseIssue(prd), url: `https://github.com/${REPO}/issues/${prd}`, state: 'open' },
  phase0: null, feature: null, retro: null, mergedSlices: 0,
  ...more,
});

const pull = (number: number) => ({ number: parsePr(number), url: `https://github.com/${REPO}/pull/${number}`, state: 'open' as const, draft: true });

/** A clock that moves one second each time it is read. */
function clock(start = Date.parse('2026-10-05T09:30:00Z')) {
  let at = start;
  return () => { at += 1000; return at; };
}

type Reads = { priority: Priority; ref: DossierRef }[];

function setup({ topics = new Map<string, PrdNumber>(), workspaces = [WS] } = {}) {
  const store = fakeSnapshotStore();
  const reads: Reads = [];
  const later: (() => Promise<void>)[] = [];
  const log = vi.fn();
  let gate: Promise<void> | null = null;
  const snapshot: SnapshotDeps & { store: FakeSnapshotStore } = {
    store,
    reader: {
      summary: async (ref, { priority }) => {
        reads.push({ ref, priority });
        if (gate) await gate;
        return summary(ref.prd, { mergedSlices: reads.length });
      },
      forget: () => {},
    },
    pausedUntil: () => Promise.resolve(null),
    now: clock(),
    later: (task) => { later.push(task); },
    log,
  };
  const deps: TouchedDeps = {
    secret: SECRET,
    workspacesOf: (repository) => Promise.resolve(repository.toLowerCase() === REPO.toLowerCase() ? workspaces : []),
    prdByTopic: (_workspace, _repository, topic) => Promise.resolve(topics.get(topic) ?? null),
    snapshotsOf: (workspace) => Promise.resolve([...store.rows].filter(([, row]) => row.workspaceId === workspace)
      .map(([dossierId, row]) => ({ dossierId, summary: row.summary }))),
    snapshot,
    log,
  };
  const keep = (id: string, value: GithubSummary, more: { staleSince?: string | null; refreshingUntil?: string | null } = {}) => {
    store.rows.set(id, { workspaceId: WS, summary: value, readAt: '2026-10-05T09:00:00Z', staleSince: null, refreshingUntil: null, ...more });
  };
  const post = (payload: unknown, signature?: string | null) => {
    const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const headers = new Headers();
    if (signature !== null) headers.set(STAGE_SIGNATURE_HEADER, signature ?? sign(body));
    return receiveTouch({ body, headers }, deps);
  };
  const runLater = async () => { for (const task of later.splice(0)) await task(); };
  const hold = () => {
    let open = () => {};
    gate = new Promise((resolve) => { open = resolve; });
    return () => { gate = null; open(); };
  };
  return { store, reads, later, log, deps, keep, post, runLater, hold };
}

describe('parseTouch', () => {
  it('reads a touch: a repository, and any of an issue, a pull request and a branch', () => {
    expect(parseTouch({ repository: REPO, issue: 902 })).toEqual({ repository: REPO, issue: 902 });
    expect(parseTouch({ repository: REPO, pr: 12, branch: 'feat/x--s1' })).toEqual({ repository: REPO, pr: 12, branch: 'feat/x--s1' });
  });

  it('refuses anything else', () => {
    for (const bad of [null, {}, { repository: 'widgets' }, { repository: REPO, pr: 0 }, { repository: REPO, issue: 'x' }, { repository: REPO, branch: '' }]) {
      expect(parseTouch(bad)).toBeNull();
    }
  });
});

describe('topicOfBranch', () => {
  it('reads the topic of a feature, slice, phase-0 or retro branch, by the kit\'s shapes', () => {
    expect(topicOfBranch('feat/github-budget')).toBe('github-budget');
    expect(topicOfBranch('feat/github-budget--s3')).toBe('github-budget');
    expect(topicOfBranch('docs/phase-0-github-budget')).toBe('github-budget');
    expect(topicOfBranch('docs/retro-github-budget')).toBe('github-budget');
  });

  it('reads none from any other branch', () => {
    expect(topicOfBranch('main')).toBeNull();
    expect(topicOfBranch('fix/typo')).toBeNull();
    expect(topicOfBranch('feat/a/b')).toBeNull();
  });
});

describe('POST /api/github/touched', () => {
  it('refuses a bad or missing signature, and a missing secret, with 401: nothing is marked', async () => {
    const { post, keep, store, deps } = setup();
    keep('d1', summary(parsePrd(902)));
    expect((await post({ repository: REPO, issue: 902 }, 'sha256=00')).status).toBe(401);
    expect((await post({ repository: REPO, issue: 902 }, null)).status).toBe(401);
    expect((await post({ repository: REPO, issue: 902 }, sign('{}', 'other'))).status).toBe(401);
    const body = JSON.stringify({ repository: REPO, issue: 902 });
    expect((await receiveTouch({ body, headers: new Headers({ [STAGE_SIGNATURE_HEADER]: sign(body) }) }, { ...deps, secret: undefined })).status).toBe(401);
    expect(store.rows.get('d1')?.staleSince).toBeNull();
  });

  it('answers 400 to a signed body that is not a touch', async () => {
    const { post } = setup();
    expect((await post('not json')).status).toBe(400);
    expect((await post({ repository: 'nope' })).status).toBe(400);
  });

  it('answers an unknown repository 202, and logs it', async () => {
    const { post, log, later } = setup();
    const reply = await post({ repository: 'other/repo', issue: 1 });
    expect(reply).toEqual({ status: 202, body: { stale: 0 } });
    expect(log).toHaveBeenCalledWith(expect.stringContaining('other/repo'));
    expect(later).toEqual([]);
  });

  it('answers a touch that matches no dossier 202, and logs it', async () => {
    const { post, keep, log, store } = setup();
    keep('d1', summary(parsePrd(902)));
    expect((await post({ repository: REPO, issue: 5 })).status).toBe(202);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('matched no dossier'));
    expect(store.rows.get('d1')?.staleSince).toBeNull();
  });

  it('marks stale the dossier of the PRD issue it names, and refreshes it after the response', async () => {
    const { post, keep, store, reads, runLater } = setup();
    keep('d1', summary(parsePrd(902)));
    keep('d2', summary(parsePrd(903)));
    const reply = await post({ repository: REPO, issue: 902 });
    expect(reply).toEqual({ status: 200, body: { ok: true, stale: 1 } });
    expect(store.rows.get('d1')?.staleSince).not.toBeNull();
    expect(store.rows.get('d2')?.staleSince).toBeNull();
    expect(reads).toEqual([]);
    await runLater();
    expect(reads.map((r) => [r.ref.id, r.priority])).toEqual([['d1', 'background']]);
    expect(store.rows.get('d1')).toMatchObject({ staleSince: null, refreshingUntil: null });
  });

  it('marks stale the dossier whose snapshot holds the pull request it names', async () => {
    const { post, keep, store } = setup();
    keep('d1', summary(parsePrd(902), { feature: pull(903) }));
    keep('d2', summary(parsePrd(904), { phase0: pull(905) }));
    keep('d3', summary(parsePrd(906), { retro: pull(907) }));
    await post({ repository: REPO, pr: 905 });
    expect([...store.rows].filter(([, row]) => row.staleSince !== null).map(([id]) => id)).toEqual(['d2']);
    await post({ repository: 'acme/widgets', pr: 903 });
    await post({ repository: REPO, pr: 907 });
    expect([...store.rows].filter(([, row]) => row.staleSince !== null).map(([id]) => id)).toEqual(['d1', 'd2', 'd3']);
  });

  it('marks stale the dossier of the PRD its branch\'s topic names, through prd_topics', async () => {
    const { post, keep, store } = setup({ topics: new Map([['github-budget', parsePrd(902)]]) });
    keep('d1', summary(parsePrd(902)));
    keep('d2', summary(parsePrd(903)));
    expect((await post({ repository: REPO, pr: 1081, branch: 'feat/github-budget--s3' })).status).toBe(200);
    expect(store.rows.get('d1')?.staleSince).not.toBeNull();
    expect(store.rows.get('d2')?.staleSince).toBeNull();
  });

  it('leaves another repository\'s snapshot alone, even with the same numbers', async () => {
    const { post, keep, store } = setup();
    keep('d1', { ...summary(parsePrd(902)), repo: 'acme/gadgets' });
    expect((await post({ repository: REPO, issue: 902 })).status).toBe(202);
    expect(store.rows.get('d1')?.staleSince).toBeNull();
  });

  it('keeps the first stale mark of a dossier no refresh holds', async () => {
    const { post, keep, store } = setup();
    keep('d1', summary(parsePrd(902)), { staleSince: '2026-10-05T09:10:00Z' });
    await post({ repository: REPO, issue: 902 });
    expect(store.rows.get('d1')?.staleSince).toBe('2026-10-05T09:10:00Z');
  });
});

describe('touches during a refresh (acceptance 7)', () => {
  it('lead to exactly one follow-up read once the refresh ends', async () => {
    const { post, keep, store, reads, later, hold } = setup();
    keep('d1', summary(parsePrd(902)));
    await post({ repository: REPO, issue: 902 });
    const first = later.splice(0);
    expect(first).toHaveLength(1);

    const open = hold();
    const running = first[0]?.();
    await vi.waitFor(() => { expect(reads).toHaveLength(1); });

    // Three touches land while the first read runs: each is marked, and each refresh finds the lease held.
    for (let i = 0; i < 3; i += 1) await post({ repository: REPO, issue: 902 });
    await Promise.all(later.splice(0).map((task) => task()));
    expect(reads).toHaveLength(1);

    open();
    await running;
    expect(reads).toHaveLength(2);
    expect(store.rows.get('d1')).toMatchObject({ staleSince: null, refreshingUntil: null });
    expect(store.rows.get('d1')?.summary.mergedSlices).toBe(2);
  });

  it('a burst with no refresh running costs one read, and no follow-up', async () => {
    const { post, keep, reads, runLater } = setup();
    keep('d1', summary(parsePrd(902)));
    for (let i = 0; i < 5; i += 1) await post({ repository: REPO, issue: 902 });
    await runLater();
    expect(reads).toHaveLength(1);
  });

  it('a refresh that fails keeps the snapshot and leaves it stale, with no follow-up', async () => {
    const { keep, store, deps } = setup();
    keep('d1', summary(parsePrd(902), { mergedSlices: 7 }), { staleSince: '2026-10-05T09:10:00Z' });
    const reads: string[] = [];
    const snapshot = { ...deps.snapshot, reader: { summary: () => { reads.push('read'); return Promise.resolve(null); }, forget: () => {} } };
    await refreshAfterTouch({ id: 'd1', workspace_id: WS, home_repo: REPO, prd: parsePrd(902) }, snapshot);
    expect(reads).toHaveLength(1);
    expect(store.rows.get('d1')).toMatchObject({ staleSince: '2026-10-05T09:10:00Z' });
    expect(store.rows.get('d1')?.summary.mergedSlices).toBe(7);
  });

  it('a refresh after the dossier was already read again does nothing', async () => {
    const { keep, reads, deps } = setup();
    keep('d1', summary(parsePrd(902)));
    await refreshAfterTouch({ id: 'd1', workspace_id: WS, home_repo: REPO, prd: parsePrd(902) }, deps.snapshot);
    expect(reads).toEqual([]);
  });
});
