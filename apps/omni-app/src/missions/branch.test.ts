import { describe, expect, it } from 'vitest';
import { parsePrd, parseProductPrdId } from 'omni-loop/kit/lib/ids.ts';
import { missionBranches, planTargets, prepareAll, rebaseWhy, scopeRepos, type MissionBranches } from './branch.ts';

const SHA = '3f2a9c1e0b7d4c5a8e6f1d2c3b4a5968778695a4';

type Repo = { default_branch: string; allow_rebase_merge?: boolean };

/** A GitHub that holds `branches` (name to sha) and answers the repository as `repo`; every call is kept. */
function github({ repo = { default_branch: 'main', allow_rebase_merge: true }, branches = { main: SHA } }: { repo?: Repo | null; branches?: Record<string, string> } = {}) {
  const calls: string[] = [];
  const octokit = {
    request: (route: string, params: Record<string, unknown> = {}) => {
      calls.push(route);
      if (route === 'GET /repos/{owner}/{repo}') return repo === null ? Promise.reject(Object.assign(new Error('Not Found - https://docs.github.com/rest/repos/repos#get-a-repository'), { status: 404 })) : Promise.resolve({ data: repo });
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

// A mission branch in every repository the scope touches (PRD omni-loop-21 s7, spec "2. One mission branch per repository").

const PLAN = [
  '# Plan',
  '',
  '## Repositories',
  '',
  '| repo | role | read at | knowledge |',
  '| --- | --- | --- | --- |',
  '| api | backend | 2dd25db9a0139eee370871d480373dcbf9fef845 | own |',
  '| acme/mobile | app | 2dd25db9a0139eee370871d480373dcbf9fef845 | imported |',
  '',
].join('\n');

describe('planTargets: the repositories a product PRD\'s plan names', () => {
  it('reads each row of its Repositories table as owner/name, a bare name under the mission repository\'s owner', () => {
    expect(planTargets(PLAN, 'acme')).toEqual(['acme/api', 'acme/mobile']);
  });

  it('names none for a plan with no Repositories table', () => {
    expect(planTargets('# Plan\n\n## Slices\n', 'acme')).toEqual([]);
  });
});

describe('scopeRepos: every repository the scope touches', () => {
  const targets = new Map([
    [parseProductPrdId('omni-loop-15'), ['acme/api', 'acme/mobile']],
    [parseProductPrdId('omni-loop-16'), ['ACME/api', 'acme/web']],
  ]);

  it('names the mission\'s repository for a repository PRD, then each target of each product PRD, once each', () => {
    expect(scopeRepos({ repo: 'acme/widgets', prds: [parsePrd(2896), parseProductPrdId('omni-loop-15'), parseProductPrdId('omni-loop-16')], targets })).toEqual([
      'acme/widgets',
      'acme/api',
      'acme/mobile',
      'acme/web',
    ]);
  });

  it('leaves the mission\'s repository out when no repository PRD is in scope and no plan names it', () => {
    expect(scopeRepos({ repo: 'acme/widgets', prds: [parseProductPrdId('omni-loop-15')], targets })).toEqual(['acme/api', 'acme/mobile']);
  });

  it('names nothing for a product PRD whose plan is not read yet', () => {
    expect(scopeRepos({ repo: 'acme/widgets', prds: [parseProductPrdId('omni-loop-17')], targets })).toEqual([]);
  });
});

describe('prepareAll: the mission branch cut in each repository', () => {
  /** Branches that refuse the repositories `refused` names, with its reason, and keep every repository asked. */
  function branches(refused: Record<string, string> = {}, existing: readonly string[] = []): MissionBranches & { asked: string[] } {
    const asked: string[] = [];
    return {
      asked,
      prepare: ({ repo }) => {
        asked.push(repo);
        const why = refused[repo];
        return Promise.resolve(why === undefined ? { ok: true, cut: !existing.includes(repo) } : { ok: false, why });
      },
    };
  }

  it('AC-2: cuts a mission branch in each of the two repositories a product PRD\'s plan names', async () => {
    const two = branches();
    expect(await prepareAll(two, { installation: 7, repos: ['acme/api', 'acme/mobile'], branch: 'mission/12-faster-quotes' })).toEqual({ ok: true, cut: ['acme/api', 'acme/mobile'] });
    expect(two.asked).toEqual(['acme/api', 'acme/mobile']);
  });

  it('names only the repositories it cut, a branch already there left as it is', async () => {
    expect(await prepareAll(branches({}, ['acme/api']), { installation: 7, repos: ['acme/api', 'acme/mobile'], branch: 'mission/12-q' })).toEqual({ ok: true, cut: ['acme/mobile'] });
  });

  it('asks every repository, and waits on each that refused, naming it', async () => {
    const one = branches({ 'acme/api': rebaseWhy('acme/api') });
    expect(await prepareAll(one, { installation: 7, repos: ['acme/api', 'acme/mobile'], branch: 'mission/12-q' })).toEqual({ ok: false, why: rebaseWhy('acme/api') });
    expect(one.asked).toEqual(['acme/api', 'acme/mobile']);
    const both = await prepareAll(branches({ 'acme/api': 'no', 'acme/mobile': 'not either' }), { installation: 7, repos: ['acme/api', 'acme/mobile'], branch: 'mission/12-q' });
    expect(both).toEqual({ ok: false, why: 'no; not either' });
  });

  it('cuts nothing for a scope that touches no repository yet', async () => {
    expect(await prepareAll(branches(), { installation: 7, repos: [], branch: 'mission/12-q' })).toEqual({ ok: true, cut: [] });
  });
});

describe('a target GitHub cannot find (bug #3271)', () => {
  it('reads no repository from a Repositories cell that names none, such as "omni-loop (this repository)"', () => {
    const plan = ['## Repositories', '', '| repo | role | read at |', '| --- | --- | --- |', '| omni-loop (this repository) | product | — |', '| demo-org/widgets | app | — |', ''].join('\n');
    expect(planTargets(plan, 'demo-org')).toEqual(['demo-org/widgets']);
  });

  it('waits, naming the repository, when GitHub does not find it, and cuts nothing', async () => {
    const gh = github({ repo: null });
    await expect(gh.prepare({ ...where, repo: 'demo-org/omni-loop' })).resolves.toEqual({
      ok: false,
      why: 'demo-org/omni-loop is not found on GitHub, or the app is not installed on it: nothing was cut',
    });
    expect(gh.calls).toEqual(['GET /repos/{owner}/{repo}']);
  });
});
