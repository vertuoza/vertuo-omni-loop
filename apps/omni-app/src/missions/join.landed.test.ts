// Bug #3371: missionJoins.landed, what the supervisor asks GitHub of a PRD outside the mission's scope that a build ended held on,
// on omni-loop-27's shape: its target pull request merged into an earlier mission's branch, and that mission's pull request
// squash-merged into the default branch, which the mission branch was cut from.
import { describe, expect, it } from 'vitest';
import { parseProductPrdId } from 'omni-loop/kit/lib/ids.ts';
import type { GitHubClient } from '../outbox-check/github-schema.ts';
import { missionJoins } from './join.ts';

const P27 = parseProductPrdId('demo-27');
const BRANCH = 'mission/19-settings';
const EARLIER = 'mission/70-settings';
const TARGET_SHA = 'a'.repeat(40);
const MISSION_SHA = 'b'.repeat(40);

const pull = (number: number, base: string, head: string, sha: string, body: string) => ({ number, body, merged_at: '2027-01-30T05:57:21Z', merge_commit_sha: sha, base: { ref: base }, head: { ref: head } });
const PULLS: Record<number, ReturnType<typeof pull>> = {
  83: pull(83, EARLIER, 'feat/demo-27', TARGET_SHA, 'Part of demo-27 · https://example.test/prd/27\n\n## Slices'),
  84: pull(84, 'main', 'fix/demo-270', 'c'.repeat(40), 'Part of demo-270'),
  118: pull(118, 'main', EARLIER, MISSION_SHA, 'Mission #70'),
};

/** A GitHub where pull requests 83, 84 and 118 merged and `onBranch` are the commits the mission branch holds; every call kept. */
function github(onBranch: readonly string[]) {
  const calls: string[] = [];
  const octokit = {
    request(route: string, params: Record<string, unknown>) {
      calls.push(route);
      if (route === 'GET /search/issues') return Promise.resolve({ data: { items: [{ number: 83 }, { number: 84 }] } });
      if (route === 'GET /repos/{owner}/{repo}/pulls/{pull_number}') return Promise.resolve({ data: PULLS[Number(params.pull_number)] });
      if (route === 'GET /repos/{owner}/{repo}/pulls') return Promise.resolve({ data: Object.values(PULLS).filter((one) => `demo-org:${one.head.ref}` === params.head) });
      if (route === 'GET /repos/{owner}/{repo}/compare/{basehead}') {
        const [sha = '', branch] = String(params.basehead).split('...');
        if (branch !== BRANCH) return Promise.reject(new Error(`unexpected branch ${String(branch)}`));
        return onBranch.includes(sha) ? Promise.resolve({ data: { status: 'ahead' } }) : Promise.reject(Object.assign(new Error('Not Found'), { status: 404 }));
      }
      return Promise.reject(new Error(`unexpected ${route}`));
    },
  } as unknown as GitHubClient;
  const landed = missionJoins({ octokitFor: () => octokit }).landed;
  if (landed === undefined) throw new Error('no landed');
  return { calls, landed: (repos = ['demo-org/widgets']) => landed({ installation: 7, repos, prd: P27, branch: BRANCH }) };
}

describe('missionJoins.landed (bug #3371)', () => {
  it('is true when the mission pull request that merged the target pull request base is on the branch', async () => {
    expect(await github([MISSION_SHA]).landed()).toBe(true);
  });

  it('is true when the target pull request merge commit is on the branch itself', async () => {
    expect(await github([TARGET_SHA]).landed()).toBe(true);
  });

  it('is false while neither is on the branch, and reads no pull request whose body is not part of the PRD as one', async () => {
    const gh = github(['c'.repeat(40)]);
    expect(await gh.landed()).toBe(false);
    expect(gh.calls).toContain('GET /search/issues');
  });

  it('is false with no repository to read', async () => {
    expect(await github([MISSION_SHA]).landed([])).toBe(false);
  });
});
