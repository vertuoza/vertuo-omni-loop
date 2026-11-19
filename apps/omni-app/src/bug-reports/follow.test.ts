// Where an Omni Loop bug stands once its fix leaves the team's hands (PRD 3088 s4): the deliveries, the states and the sweep,
// against an in-memory store and a fake GitHub. No test calls GitHub or the database.
import { describe, expect, it } from 'vitest';
import { OMNI_LOOP_REPOSITORY } from './file.ts';
import {
  BUG_FOLLOW_KIND,
  closedIssues,
  compareVersions,
  followBugEvent,
  sweepBugs,
  toBugEvents,
  toBugJobs,
  versionOf,
  type BugGithub,
  type BugPatch,
  type BugState,
  type BugTeamStore,
  type TeamBug,
} from './follow.ts';

const REPO = OMNI_LOOP_REPOSITORY;
const bug = (issue: number, state: BugState, more: Partial<TeamBug> = {}): TeamBug => ({
  fingerprint: issue.toString(16).padStart(64, '0'),
  repo: REPO,
  issue,
  state,
  fixPr: null,
  fixedIn: null,
  ...more,
});

function memoryStore(bugs: TeamBug[]): BugTeamStore & { bugs: TeamBug[] } {
  const apply = (found: TeamBug, patch: BugPatch) => {
    found.state = patch.state;
    if (patch.fixPr !== undefined) found.fixPr = patch.fixPr;
    if (patch.fixedIn !== undefined) found.fixedIn = patch.fixedIn;
  };
  return {
    bugs,
    byIssue: (repo, issue) => Promise.resolve(bugs.find((one) => one.repo === repo && one.issue === issue) ?? null),
    byFixPr: (repo, pr) => Promise.resolve(bugs.find((one) => one.repo === repo && one.fixPr === pr) ?? null),
    inStates: (states) => Promise.resolve(bugs.filter((one) => states.includes(one.state))),
    move: (from, patch) => {
      const found = bugs.find((one) => one.fingerprint === from.fingerprint);
      if (!found || found.state !== from.state) return Promise.resolve(false);
      apply(found, patch);
      return Promise.resolve(true);
    },
  };
}

type World = {
  issues?: Record<number, { open: boolean; notPlanned?: boolean }>;
  pulls?: Record<number, { merged: boolean; open: boolean; mergeCommit: string | null }>;
  /** tag to the commits it holds */
  tags?: Record<string, string[]>;
  broken?: number[];
};
function fakeGithub(world: World = {}): BugGithub {
  return {
    issue: (_repo, issue) => {
      if (world.broken?.includes(issue)) return Promise.reject(new Error('GitHub is down'));
      const found = world.issues?.[issue] ?? { open: true };
      return Promise.resolve({ open: found.open, notPlanned: found.notPlanned ?? false });
    },
    pull: (_repo, pr) => Promise.resolve(world.pulls?.[pr] ?? { merged: false, open: true, mergeCommit: null }),
    releases: () => Promise.resolve(Object.keys(world.tags ?? {}).reverse()),
    holds: (_repo, sha, tag) => Promise.resolve(world.tags?.[tag]?.includes(sha) ?? false),
  };
}

const delivery = (parts: Record<string, unknown>, repo = REPO) => ({ repository: { full_name: repo }, ...parts });

describe('the events a delivery says about a bug', () => {
  it('reads the issues a merged pull request closes, one event each', () => {
    const merged = delivery({ action: 'closed', pull_request: { number: 40, merged: true, body: 'Fixes #12 and closes #13.\nPart of #3000' } });
    expect(toBugEvents('pull_request', merged)).toEqual([
      { kind: 'merged', issue: 12, pr: 40 },
      { kind: 'merged', issue: 13, pr: 40 },
    ]);
  });

  it('reads a pull request closed unmerged as its fix gone', () => {
    expect(toBugEvents('pull_request', delivery({ action: 'closed', pull_request: { number: 40, merged: false, body: 'Fixes #12' } }))).toEqual([{ kind: 'pr-closed', pr: 40 }]);
    expect(toBugEvents('pull_request', delivery({ action: 'closed', pull_request: { number: 41, merged: false, body: 'Part of #3088' } }))).toEqual([]);
  });

  it('reads an issue closed as not planned, and one reopened, and no other', () => {
    expect(toBugEvents('issues', delivery({ action: 'closed', issue: { number: 12, state_reason: 'not_planned' } }))).toEqual([{ kind: 'not-planned', issue: 12 }]);
    expect(toBugEvents('issues', delivery({ action: 'reopened', issue: { number: 12 } }))).toEqual([{ kind: 'reopened', issue: 12 }]);
    expect(toBugEvents('issues', delivery({ action: 'closed', issue: { number: 12, state_reason: 'completed' } }))).toEqual([]);
    expect(toBugEvents('issues', delivery({ action: 'labeled', issue: { number: 12 } }))).toEqual([]);
  });

  it('reads a published release, never a draft or a prerelease', () => {
    expect(toBugEvents('release', delivery({ action: 'published', release: { tag_name: 'v0.0.680' } }))).toEqual([{ kind: 'released', tag: 'v0.0.680' }]);
    expect(toBugEvents('release', delivery({ action: 'published', release: { tag_name: 'v0.0.680', prerelease: true } }))).toEqual([]);
    expect(toBugEvents('release', delivery({ action: 'created', release: { tag_name: 'v0.0.680' } }))).toEqual([]);
  });

  it('says nothing of another repository, or of a pull request seen as an issue', () => {
    expect(toBugEvents('issues', delivery({ action: 'reopened', issue: { number: 12 } }, 'acme/shop'))).toEqual([]);
    expect(toBugEvents('issues', delivery({ action: 'reopened', issue: { number: 12, pull_request: {} } }))).toEqual([]);
    expect(toBugEvents('issues', { action: 'reopened' })).toEqual([]);
  });

  it('adds one job per event, keyed by the delivery, in its own lane', () => {
    const jobs = toBugJobs('release', delivery({ action: 'published', release: { tag_name: 'v0.0.680' } }), 'd-1');
    expect(jobs).toEqual([
      { kind: BUG_FOLLOW_KIND, key: 'bug-follow:d-1:released:v0.0.680', subject: REPO, payload: { event: { kind: 'released', tag: 'v0.0.680' }, delivery: 'd-1' }, lane: 'bug-follow', maxTries: 4 },
    ]);
    expect(toBugJobs('push', delivery({}), 'd-2')).toEqual([]);
  });

  it('reads closing words only', () => {
    expect(closedIssues('Part of #3088, see #5')).toEqual([]);
    expect(closedIssues(null)).toEqual([]);
    expect(closedIssues('Resolved: #7')).toEqual([7]);
  });
});

describe('versions', () => {
  it('reads v0.0.N as 0.0.N, and no other tag', () => {
    expect(versionOf('v0.0.679')).toBe('0.0.679');
    expect(versionOf('0.0.679')).toBeNull();
    expect(versionOf('v1.2')).toBeNull();
    expect(versionOf('v0.0.679-rc1')).toBeNull();
  });

  it('orders numerically, not as text', () => {
    expect(compareVersions('0.0.99', '0.0.100')).toBeLessThan(0);
    expect(compareVersions('0.1.0', '0.0.900')).toBeGreaterThan(0);
    expect(compareVersions('0.0.5', '0.0.5')).toBe(0);
  });
});

describe('following an event', () => {
  it('turns a bug whose fix merged and closed its issue merged, with its pull request', async () => {
    const store = memoryStore([bug(12, 'pr-opened', { fixPr: 40 })]);
    expect(await followBugEvent({ event: { kind: 'merged', issue: 12, pr: 40 }, store, github: fakeGithub() })).toEqual({ moved: 1 });
    expect(store.bugs[0]).toMatchObject({ state: 'merged', fixPr: 40 });
  });

  it('turns a merged bug fixed in the release whose tag holds the merge commit (AC-5)', async () => {
    const store = memoryStore([bug(12, 'merged', { fixPr: 40 })]);
    const github = fakeGithub({ pulls: { 40: { merged: true, open: false, mergeCommit: 'abc' } }, tags: { 'v0.0.680': ['abc'] } });
    expect(await followBugEvent({ event: { kind: 'released', tag: 'v0.0.680' }, store, github })).toEqual({ moved: 1 });
    expect(store.bugs[0]).toMatchObject({ state: 'fixed', fixedIn: '0.0.680' });
  });

  it('leaves a merged bug whose commit the release does not hold', async () => {
    const store = memoryStore([bug(12, 'merged', { fixPr: 40 })]);
    const github = fakeGithub({ pulls: { 40: { merged: true, open: false, mergeCommit: 'abc' } }, tags: { 'v0.0.679': [] } });
    expect(await followBugEvent({ event: { kind: 'released', tag: 'v0.0.679' }, store, github })).toEqual({ moved: 0 });
    expect(store.bugs[0]?.state).toBe('merged');
  });

  it('ignores a release that is no kit version, and a bug that is not merged', async () => {
    const store = memoryStore([bug(12, 'merged', { fixPr: 40 }), bug(13, 'open')]);
    const github = fakeGithub({ pulls: { 40: { merged: true, open: false, mergeCommit: 'abc' } }, tags: { 'nightly': ['abc'] } });
    expect(await followBugEvent({ event: { kind: 'released', tag: 'nightly' }, store, github })).toEqual({ moved: 0 });
  });

  it('sets a bug aside as wont-fix when its issue closes as not planned, unless it is fixed', async () => {
    const store = memoryStore([bug(12, 'pr-opened', { fixPr: 40 }), bug(13, 'fixed', { fixedIn: '0.0.1' })]);
    await followBugEvent({ event: { kind: 'not-planned', issue: 12 }, store, github: fakeGithub() });
    await followBugEvent({ event: { kind: 'not-planned', issue: 13 }, store, github: fakeGithub() });
    expect(store.bugs.map((one) => one.state)).toEqual(['wont-fix', 'fixed']);
  });

  it('puts a bug back open when its issue is reopened, forgetting the fix', async () => {
    const store = memoryStore([bug(12, 'fixed', { fixPr: 40, fixedIn: '0.0.680' }), bug(13, 'fixing')]);
    await followBugEvent({ event: { kind: 'reopened', issue: 12 }, store, github: fakeGithub() });
    await followBugEvent({ event: { kind: 'reopened', issue: 13 }, store, github: fakeGithub() });
    expect(store.bugs[0]).toMatchObject({ state: 'open', fixPr: null, fixedIn: null });
    expect(store.bugs[1]?.state).toBe('fixing');
  });

  it('puts a bug back open when its fix pull request closes unmerged', async () => {
    const store = memoryStore([bug(12, 'pr-opened', { fixPr: 40 }), bug(13, 'pr-opened', { fixPr: 41 })]);
    await followBugEvent({ event: { kind: 'pr-closed', pr: 40 }, store, github: fakeGithub() });
    expect(store.bugs[0]).toMatchObject({ state: 'open', fixPr: null });
    expect(store.bugs[1]?.state).toBe('pr-opened');
  });

  it('invents no bug: an issue the team never filed moves nothing, and a merge never undoes a final state', async () => {
    const store = memoryStore([bug(12, 'wont-fix')]);
    expect(await followBugEvent({ event: { kind: 'merged', issue: 99, pr: 40 }, store, github: fakeGithub() })).toEqual({ moved: 0 });
    expect(await followBugEvent({ event: { kind: 'merged', issue: 12, pr: 40 }, store, github: fakeGithub() })).toEqual({ moved: 0 });
    expect(store.bugs).toHaveLength(1);
  });

  it('ends in the same state when the same event is followed twice', async () => {
    const store = memoryStore([bug(12, 'pr-opened', { fixPr: 40 })]);
    const event = { kind: 'merged', issue: 12, pr: 40 } as const;
    expect(await followBugEvent({ event, store, github: fakeGithub() })).toEqual({ moved: 1 });
    expect(await followBugEvent({ event, store, github: fakeGithub() })).toEqual({ moved: 1 });
    expect(store.bugs[0]?.state).toBe('merged');
  });
});

describe('the sweep', () => {
  it('reaches merged and then fixed from the issue, the pull request and the first release that holds the merge', async () => {
    const store = memoryStore([bug(12, 'pr-opened', { fixPr: 40 })]);
    const github = fakeGithub({
      issues: { 12: { open: false } },
      pulls: { 40: { merged: true, open: false, mergeCommit: 'abc' } },
      tags: { 'v0.0.679': [], 'v0.0.680': ['abc'], 'v0.0.681': ['abc'] },
    });
    expect(await sweepBugs({ store, github })).toEqual({ read: 1, moved: 2 });
    expect(store.bugs[0]).toMatchObject({ state: 'fixed', fixedIn: '0.0.680', fixPr: 40 });
  });

  it('turns a merged bug fixed when a release was missed', async () => {
    const store = memoryStore([bug(12, 'merged', { fixPr: 40 })]);
    const github = fakeGithub({ issues: { 12: { open: false } }, pulls: { 40: { merged: true, open: false, mergeCommit: 'abc' } }, tags: { 'v0.0.680': ['abc'] } });
    expect(await sweepBugs({ store, github })).toEqual({ read: 1, moved: 1 });
    expect(store.bugs[0]?.state).toBe('fixed');
  });

  it('sets aside a bug whose issue closed as not planned, and reopens one whose issue is open again', async () => {
    const store = memoryStore([bug(12, 'fixing'), bug(13, 'wont-fix')]);
    const github = fakeGithub({ issues: { 12: { open: false, notPlanned: true }, 13: { open: true } } });
    expect(await sweepBugs({ store, github })).toEqual({ read: 2, moved: 2 });
    expect(store.bugs.map((one) => one.state)).toEqual(['wont-fix', 'open']);
  });

  it('puts a bug back open when its fix pull request closed unmerged', async () => {
    const store = memoryStore([bug(12, 'pr-opened', { fixPr: 40 })]);
    const github = fakeGithub({ pulls: { 40: { merged: false, open: false, mergeCommit: null } } });
    expect(await sweepBugs({ store, github })).toEqual({ read: 1, moved: 1 });
    expect(store.bugs[0]).toMatchObject({ state: 'open', fixPr: null });
  });

  it('leaves a bug it cannot read as it is, says why, and goes on with the next', async () => {
    const store = memoryStore([bug(12, 'pr-opened', { fixPr: 40 }), bug(13, 'fixing')]);
    const github = fakeGithub({ broken: [12], issues: { 13: { open: false, notPlanned: true } } });
    const lines: string[] = [];
    expect(await sweepBugs({ store, github, log: (line) => lines.push(line) })).toEqual({ read: 2, moved: 1 });
    expect(store.bugs.map((one) => one.state)).toEqual(['pr-opened', 'wont-fix']);
    expect(lines).toEqual(['bug sweep: #12 left as it is — GitHub is down']);
  });

  it('reads no bug that is open, or already fixed', async () => {
    const store = memoryStore([bug(12, 'open'), bug(13, 'fixed', { fixedIn: '0.0.1' })]);
    expect(await sweepBugs({ store, github: fakeGithub() })).toEqual({ read: 0, moved: 0 });
  });
});
