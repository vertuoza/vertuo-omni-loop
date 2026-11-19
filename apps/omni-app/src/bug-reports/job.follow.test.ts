// The `bug-follow` job (PRD 3088 s4) and the live reads of the Omni Loop repository, with no GitHub and no database.
import { parseIssue, parsePr } from 'omni-loop/kit/lib/ids.ts';
import { describe, expect, it } from 'vitest';
import type { ClaimedJob } from '../jobs/ledger.ts';
import { OMNI_LOOP_REPOSITORY } from './file.ts';
import type { BugGithub, BugTeamStore } from './follow.ts';
import { bugGithub } from './github.ts';
import { bugFollowHandler } from './job.ts';

const store: BugTeamStore = {
  byIssue: () => Promise.resolve({ fingerprint: 'a'.repeat(64), repo: OMNI_LOOP_REPOSITORY, issue: parseIssue(12), state: 'pr-opened', fixPr: parsePr(40), fixedIn: null }),
  byFixPr: () => Promise.resolve(null),
  inStates: () => Promise.resolve([]),
  move: () => Promise.resolve(true),
};
const github: BugGithub = { issue: () => Promise.reject(new Error('no')), pull: () => Promise.reject(new Error('no')), releases: () => Promise.resolve([]), holds: () => Promise.resolve(false) };
const job = (payload: unknown) => ({ id: 'j', kind: 'bug-follow', key: 'k', subject: OMNI_LOOP_REPOSITORY, payload }) as unknown as ClaimedJob;

describe('bugFollowHandler', () => {
  it('follows the event and says how many bugs it moved', async () => {
    const lines: string[] = [];
    const run = bugFollowHandler({ store, github, log: (line) => lines.push(line) });
    expect(await run(job({ event: { kind: 'merged', issue: parseIssue(12), pr: parsePr(40) }, delivery: 'd' }), {} as never)).toEqual({ outcome: 'done' });
    expect(lines).toEqual(['bug follow: merged moved 1 bug']);
  });

  it('refuses a payload that is malformed, by the name of its field', async () => {
    const run = bugFollowHandler({ store, github, log: () => undefined });
    await expect(run(job({ event: { kind: 'merged', issue: 'x', pr: parsePr(40) }, delivery: 'd' }), {} as never)).rejects.toThrow('The bug-follow job is malformed');
  });
});

describe('bugGithub', () => {
  const calls: string[] = [];
  const answers: Record<string, unknown> = {
    'GET /repos/{owner}/{repo}/installation': { id: 7 },
    'GET /repos/{owner}/{repo}/issues/{issue_number}': { state: 'closed', state_reason: 'not_planned' },
    'GET /repos/{owner}/{repo}/pulls/{pull_number}': { state: 'closed', merged: true, merge_commit_sha: 'abc' },
    'GET /repos/{owner}/{repo}/releases': [
      { tag_name: 'v0.0.681', draft: false },
      { tag_name: 'v0.0.682', draft: true },
      { tag_name: 'v0.0.683-rc', prerelease: true },
    ],
    'GET /repos/{owner}/{repo}/compare/{basehead}': { status: 'ahead' },
  };
  const client = { request: (route: string, params?: Record<string, unknown>) => {
    calls.push(`${route} ${JSON.stringify(params ?? {})}`);
    return Promise.resolve({ data: answers[route] });
  } };
  const live = bugGithub({ octokitFor: () => client, app: () => client });

  it('reads an issue, a pull request, the published releases and whether a tag holds a commit', async () => {
    expect(await live.issue(OMNI_LOOP_REPOSITORY, parseIssue(12))).toEqual({ open: false, notPlanned: true });
    expect(await live.pull(OMNI_LOOP_REPOSITORY, parsePr(40))).toEqual({ merged: true, open: false, mergeCommit: 'abc' });
    expect(await live.releases(OMNI_LOOP_REPOSITORY)).toEqual(['v0.0.681']);
    expect(await live.holds(OMNI_LOOP_REPOSITORY, 'abc', 'v0.0.681')).toBe(true);
    expect(calls.some((call) => call.includes('"basehead":"abc...v0.0.681"'))).toBe(true);
    answers['GET /repos/{owner}/{repo}/compare/{basehead}'] = { status: 'diverged' };
    expect(await live.holds(OMNI_LOOP_REPOSITORY, 'abc', 'v0.0.681')).toBe(false);
  });

  it('refuses a repository that is not owner/name', async () => {
    await expect(live.issue('nope', parseIssue(1))).rejects.toThrow('is not owner/name');
  });
});
