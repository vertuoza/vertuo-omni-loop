import { describe, expect, it } from 'vitest';
import { missionBranches, rebaseWhy } from './branch.ts';

const SHA = '3f2a9c1e0b7d4c5a8e6f1d2c3b4a5968778695a4';

type Repo = { default_branch: string; allow_rebase_merge?: boolean };

/** A GitHub that holds `branches` (name to sha) and answers the repository as `repo`; every call is kept. */
function github({ repo = { default_branch: 'main', allow_rebase_merge: true }, branches = { main: SHA } }: { repo?: Repo; branches?: Record<string, string> } = {}) {
  const calls: string[] = [];
  const octokit = {
    request: (route: string, params: Record<string, unknown> = {}) => {
      calls.push(route);
      if (route === 'GET /repos/{owner}/{repo}') return Promise.resolve({ data: repo });
      if (route === 'GET /repos/{owner}/{repo}/git/ref/{ref}') {
        const sha = branches[String(params.ref).replace('heads/', '')];
        return sha === undefined ? Promise.reject(Object.assign(new Error('Not Found'), { status: 404 })) : Promise.resolve({ data: { object: { sha } } });
      }
      if (route === 'POST /repos/{owner}/{repo}/git/refs') {
        branches[String(params.ref).replace('refs/heads/', '')] = String(params.sha);
        return Promise.resolve({ data: {} });
      }
      return Promise.reject(new Error(`unexpected ${route}`));
    },
  };
  return { calls, branches, prepare: missionBranches({ octokitFor: () => octokit }).prepare };
}

const where = { installation: 7, repo: 'acme/widgets', branch: 'mission/12-faster-quotes' };

describe('missionBranches.prepare: the mission branch, cut once from the default branch (PRD 2896)', () => {
  it('cuts the branch from the default branch\'s head when the repository allows rebase merges', async () => {
    const gh = github();
    expect(await gh.prepare(where)).toEqual({ ok: true, cut: true });
    expect(gh.branches['mission/12-faster-quotes']).toBe(SHA);
  });

  it('leaves a branch that exists as it is, and cuts nothing twice', async () => {
    const other = 'b'.repeat(40);
    const gh = github({ branches: { main: SHA, 'mission/12-faster-quotes': other } });
    expect(await gh.prepare(where)).toEqual({ ok: true, cut: false });
    expect(gh.branches['mission/12-faster-quotes']).toBe(other);
    expect(gh.calls).not.toContain('POST /repos/{owner}/{repo}/git/refs');
  });

  it('refuses, naming the setting and cutting nothing, where rebase merges are not allowed', async () => {
    const gh = github({ repo: { default_branch: 'main', allow_rebase_merge: false } });
    expect(await gh.prepare(where)).toEqual({ ok: false, why: rebaseWhy('acme/widgets') });
    expect(rebaseWhy('acme/widgets')).toContain('Allow rebase merging');
    expect(Object.keys(gh.branches)).toEqual(['main']);
  });

  it('refuses too when GitHub does not say whether rebase merges are allowed', async () => {
    const gh = github({ repo: { default_branch: 'main' } });
    expect((await gh.prepare(where)).ok).toBe(false);
    expect(Object.keys(gh.branches)).toEqual(['main']);
  });

  it('never writes the default branch', async () => {
    const gh = github();
    await expect(gh.prepare({ ...where, branch: 'main' })).rejects.toThrow('default branch');
    expect(gh.calls).not.toContain('POST /repos/{owner}/{repo}/git/refs');
  });
});
