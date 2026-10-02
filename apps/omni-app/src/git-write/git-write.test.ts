import { describe, expect, it } from 'vitest';
import { assertDefined } from 'vertuo-omni-plan/kit/test/assert.ts';
import { replayGitHub } from '../../test/github-replay.ts';
import { DefaultBranchError, addCommit, branchHead, pullsFrom, refuseDefault, upsertPull } from './git-write.ts';

const OWNER = 'acme';
const REPO = 'widgets';
const BASE = 'main';
const FROM = 'merge1';
const FILES = {
  '.omni-loop/config.yml': 'kit: 1\n',
  '.omni-loop/delivery/inbox/0007-widget/spec.md': '# spec\n',
  '.omni-loop/delivery/inbox/0007-widget/plan.md': '# plan\n',
  '.omni-loop/delivery/outbox/0007-widget/settled.md': '# settled\n',
  '.omni-loop/delivery/outbox/0007-widget/s1-01-item.md': '# item\n',
};

const scenario = () => replayGitHub({ commits: { [FROM]: FILES } });
const at = { owner: OWNER, repo: REPO, defaultBranch: BASE };
type GitHub = ReturnType<typeof scenario>;
const writes = (github: GitHub) => github.state.requests.filter((r) => !r.route.startsWith('GET ')).map((r) => r.route);

/** The first request on `route`: the test fails when there is none. */
function requestOn(github: GitHub, route: string) {
  const request = github.state.requests.find((r) => r.route === route);
  assertDefined(request, `a request on ${route}`);
  return request;
}

describe('git-write — the default branch', () => {
  it('refuses to write to the default branch before any request', async () => {
    const github = scenario();
    expect(() => {
      refuseDefault('main', BASE);
    }).toThrow(DefaultBranchError);
    expect(() => {
      refuseDefault('docs/retro-widget', BASE);
    }).not.toThrow();
    await expect(branchHead(github.octokit, { ...at, branch: BASE, from: FROM })).rejects.toThrow(/default branch/);
    await expect(
      addCommit(github.octokit, { ...at, branch: BASE, parent: FROM, message: 'm', files: [{ path: 'a', content: 'b' }] }),
    ).rejects.toThrow(DefaultBranchError);
    expect(github.state.requests).toEqual([]);
  });
});

describe('git-write — the branch', () => {
  it('cuts the branch from `from` when it does not exist, and reads its head when it does', async () => {
    const github = scenario();
    expect(await branchHead(github.octokit, { ...at, branch: 'docs/knowledge-widget', from: FROM })).toBe(FROM);
    expect(writes(github)).toEqual(['POST /repos/{owner}/{repo}/git/refs']);
    github.state.requests.length = 0;
    expect(await branchHead(github.octokit, { ...at, branch: 'docs/knowledge-widget', from: 'other' })).toBe(FROM);
    expect(writes(github)).toEqual([]);
  });
});

describe('git-write — one commit', () => {
  it('writes files on top of the parent, a fast-forward, never forced', async () => {
    const github = scenario();
    const branch = 'docs/knowledge-widget';
    const parent = await branchHead(github.octokit, { ...at, branch, from: FROM });
    const sha = await addCommit(github.octokit, {
      ...at,
      branch,
      parent,
      message: 'docs: one',
      files: [{ path: 'notes/a.md', content: 'A\n' }],
    });
    expect(github.state.refs.get(`heads/${branch}`)).toBe(sha);
    expect(github.state.commits.get(sha)?.parents).toEqual([{ sha: FROM }]);
    expect(github.filesAt(branch, ['notes/a.md', '.omni-loop/config.yml'])).toEqual({
      'notes/a.md': 'A\n',
      '.omni-loop/config.yml': 'kit: 1\n',
    });
    expect(requestOn(github, 'PATCH /repos/{owner}/{repo}/git/refs/{ref}').force).toBe(false);
  });

  it('moves a file and a folder by reusing their blobs, and deletes what it is told to', async () => {
    const github = scenario();
    const branch = 'docs/knowledge-widget';
    const parent = await branchHead(github.octokit, { ...at, branch, from: FROM });
    await addCommit(github.octokit, {
      ...at,
      branch,
      parent,
      message: 'docs: ship',
      moves: [
        { from: '.omni-loop/delivery/inbox/0007-widget', to: '.omni-loop/delivery/shipped/0007-widget' },
        { from: '.omni-loop/delivery/outbox/0007-widget/settled.md', to: '.omni-loop/delivery/shipped/0007-widget/outbox/settled.md' },
      ],
      deletes: ['.omni-loop/delivery/outbox/0007-widget/s1-01-item.md'],
    });
    const { tree } = requestOn(github, 'POST /repos/{owner}/{repo}/git/trees');
    expect(tree).toEqual([
      { path: '.omni-loop/delivery/shipped/0007-widget/plan.md', mode: '100644', type: 'blob', sha: `${FROM}:.omni-loop/delivery/inbox/0007-widget/plan.md` },
      { path: '.omni-loop/delivery/shipped/0007-widget/spec.md', mode: '100644', type: 'blob', sha: `${FROM}:.omni-loop/delivery/inbox/0007-widget/spec.md` },
      { path: '.omni-loop/delivery/shipped/0007-widget/outbox/settled.md', mode: '100644', type: 'blob', sha: `${FROM}:.omni-loop/delivery/outbox/0007-widget/settled.md` },
      { path: '.omni-loop/delivery/inbox/0007-widget/plan.md', mode: '100644', type: 'blob', sha: null },
      { path: '.omni-loop/delivery/inbox/0007-widget/spec.md', mode: '100644', type: 'blob', sha: null },
      { path: '.omni-loop/delivery/outbox/0007-widget/settled.md', mode: '100644', type: 'blob', sha: null },
      { path: '.omni-loop/delivery/outbox/0007-widget/s1-01-item.md', mode: '100644', type: 'blob', sha: null },
    ]);
    const blobReads = github.state.requests.filter((r) => r.route === 'GET /repos/{owner}/{repo}/git/blobs/{file_sha}');
    expect(blobReads).toEqual([]);
  });

  it('refuses a move whose source is not in the parent', async () => {
    const github = scenario();
    const parent = await branchHead(github.octokit, { ...at, branch: 'x', from: FROM });
    await expect(
      addCommit(github.octokit, { ...at, branch: 'x', parent, message: 'm', moves: [{ from: 'nowhere/a.md', to: 'b.md' }] }),
    ).rejects.toThrow(/nowhere\/a\.md/);
  });
});

describe('git-write — the pull request', () => {
  it('opens one, then rewrites its title and body in place', async () => {
    const github = scenario();
    const branch = 'docs/knowledge-widget';
    const parent = await branchHead(github.octokit, { ...at, branch, from: FROM });
    const head = await addCommit(github.octokit, { ...at, branch, parent, message: 'm', files: [{ path: 'a', content: 'b' }] });
    const first = await upsertPull(github.octokit, { owner: OWNER, repo: REPO, branch, base: BASE, head, title: 'T1', body: 'B1' });
    expect(first).toMatchObject({ created: true, open: true });
    const again = await upsertPull(github.octokit, { owner: OWNER, repo: REPO, branch, base: BASE, head, title: 'T2', body: 'B2' });
    expect(again).toMatchObject({ number: first.number, created: false, open: true });
    expect(github.state.pulls.find((pull) => pull.number === first.number)).toMatchObject({ title: 'T2', body: 'B2' });
    expect((await pullsFrom(github.octokit, { owner: OWNER, repo: REPO, branch, base: BASE })).map((p) => p.number)).toEqual([first.number]);
  });
});
