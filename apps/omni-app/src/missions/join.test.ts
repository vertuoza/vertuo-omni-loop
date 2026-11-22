import { describe, expect, it } from 'vitest';
import { parsePr, parsePrd } from 'omni-loop/kit/lib/ids.ts';
import { reviewMarker } from 'omni-loop/kit/lib/review/verdict.ts';
import type { PullRead } from './gate.ts';
import { DefaultBranchMergeError, joinProduct, missionJoins, type MissionJoins, type PullAt } from './join.ts';

const HEAD = 'a'.repeat(40);
const BRANCH = 'mission/12-faster-quotes';
const OUTBOX = '.omni-loop/delivery/outbox';

/** An outbox item of `rank`, as `omni item new` writes one. */
const item = (id: string, rank: string): string =>
  [
    '---',
    `id: ${id}`,
    'prd: 7',
    'slice: s1',
    `rank: ${rank}`,
    'bears-on: none',
    'raised: 2027-01-22',
    'wave: 1',
    '---',
    '',
    ...['What I had to decide', 'What I did meanwhile', 'What it costs to change later', 'What I could not know'].flatMap((heading) => [`## ${heading}`, '', 'The button\'s colour.', '']),
  ].join('\n');

/** A GitHub holding `files` at the head of pull request 45, and answering its pull request, checks and reviews; every call kept. */
function github({ files = {}, pull = {}, runs = [], statuses = [], reviews = [], merge = () => Promise.resolve({ data: { merged: true } }) }: {
  files?: Record<string, string>;
  pull?: Record<string, unknown>;
  runs?: unknown[];
  statuses?: unknown[];
  reviews?: unknown[];
  merge?: (params: Record<string, unknown>) => Promise<{ data: unknown }>;
} = {}) {
  const calls: { route: string; params: Record<string, unknown> }[] = [];
  // Trees by sha: the head's root, then one per folder; a recursive read lists every file under it.
  const treeOf = (dir: string) => {
    const prefix = dir === '' ? '' : `${dir}/`;
    const names = new Map<string, 'blob' | 'tree'>();
    for (const path of Object.keys(files)) {
      if (!path.startsWith(prefix)) continue;
      const [name = '', ...rest] = path.slice(prefix.length).split('/');
      names.set(name, rest.length > 0 ? 'tree' : 'blob');
    }
    return [...names].map(([name, type]) => ({ path: name, mode: type === 'tree' ? '040000' : '100644', type, sha: `${type}:${prefix}${name}`, size: type === 'blob' ? (files[`${prefix}${name}`] ?? '').length : null }));
  };
  const recursiveOf = (dir: string) =>
    Object.keys(files)
      .filter((path) => path.startsWith(`${dir}/`))
      .map((path) => ({ path: path.slice(dir.length + 1), mode: '100644', type: 'blob', sha: `blob:${path}`, size: (files[path] ?? '').length }));
  const page = (params: Record<string, unknown>, all: unknown[]) => (params.page === 1 ? all : []);
  const routes: Record<string, (params: Record<string, unknown>) => unknown> = {
    'GET /repos/{owner}/{repo}/pulls/{pull_number}': () => ({
      html_url: 'https://github.com/acme/widgets/pull/45',
      title: 'feat(quotes): faster',
      state: 'open',
      draft: false,
      merged: false,
      base: { ref: BRANCH, repo: { default_branch: 'main' } },
      head: { sha: HEAD },
      ...pull,
    }),
    'GET /repos/{owner}/{repo}/commits/{ref}/check-runs': (params) => ({ total_count: runs.length, check_runs: page(params, runs) }),
    'GET /repos/{owner}/{repo}/commits/{ref}/status': () => ({ state: 'success', statuses }),
    'GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews': (params) => page(params, reviews),
    'GET /repos/{owner}/{repo}/git/ref/{ref}': () => ({ object: { sha: HEAD } }),
    'GET /repos/{owner}/{repo}/git/trees/{tree_sha}': (params) => {
      const sha = String(params.tree_sha);
      const dir = sha === HEAD ? '' : sha.replace(/^tree:/, '');
      return { truncated: false, tree: params.recursive === '1' ? recursiveOf(dir) : treeOf(dir) };
    },
    'GET /repos/{owner}/{repo}/git/blobs/{file_sha}': (params) => ({ content: Buffer.from(files[String(params.file_sha).replace(/^blob:/, '')] ?? '').toString('base64'), encoding: 'base64' }),
  };
  const octokit = {
    request: (route: string, params: Record<string, unknown> = {}) => {
      calls.push({ route, params });
      if (route === 'PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge') return merge(params);
      const answer = routes[route];
      return answer ? Promise.resolve({ data: answer(params) }) : Promise.reject(new Error(`unexpected ${route}`));
    },
  };
  return { calls, joins: missionJoins({ octokitFor: () => octokit }) };
}

const at = { installation: 7, repo: 'acme/widgets', prd: parsePrd(7), pr: parsePr(45) };
const CONFIG = { '.omni-loop/config.yml': 'kit: 1\n' };

describe('missionJoins.read: what the gate reads of a feature pull request (PRD 2896 s4)', () => {
  it('reads the pull request, its checks, its reviews and its open items at the head', async () => {
    const gh = github({
      files: { ...CONFIG, [`${OUTBOX}/0007-quotes/s1-01-colour.md`]: item('s1-01-colour', 'high'), [`${OUTBOX}/0007-quotes/settled.md`]: '# Settled\n', [`${OUTBOX}/0007-quotes/accounts/s1.md`]: '---\n' },
      runs: [{ id: 3, name: 'test', status: 'completed', conclusion: 'success', output: { title: 'green' } }],
      statuses: [{ context: 'Vercel', state: 'pending', description: null }],
      reviews: [{ body: '<!-- omni-review: 1 pass -->', commit_id: HEAD }],
    });
    expect(await gh.joins.read(at)).toEqual({
      number: 45,
      url: 'https://github.com/acme/widgets/pull/45',
      title: 'feat(quotes): faster',
      state: 'open',
      draft: false,
      merged: false,
      base: BRANCH,
      defaultBranch: 'main',
      head: HEAD,
      runs: [{ id: 3, name: 'test', status: 'completed', conclusion: 'success', title: 'green' }],
      statuses: [{ context: 'Vercel', state: 'pending', description: null }],
      reviews: [{ body: '<!-- omni-review: 1 pass -->', commit: HEAD }],
      items: { ranks: ['high'], open: [{ id: 's1-01-colour', rank: 'high' }] },
    });
  });

  it('fetches only this PRD\'s items, never another PRD\'s', async () => {
    const gh = github({ files: { ...CONFIG, [`${OUTBOX}/0007-quotes/s1-01-colour.md`]: item('s1-01-colour', 'medium'), [`${OUTBOX}/0008-other/s1-01-x.md`]: item('s1-01-x', 'high') } });
    expect((await gh.joins.read(at)).items).toEqual({ ranks: ['medium'], open: [{ id: 's1-01-colour', rank: 'medium' }] });
    const blobs = gh.calls.filter(({ route }) => route.endsWith('/git/blobs/{file_sha}')).map(({ params }) => params.file_sha);
    expect(blobs).not.toContain(`blob:${OUTBOX}/0008-other/s1-01-x.md`);
  });

  it('counts an item that does not parse as open, with no rank', async () => {
    const gh = github({ files: { ...CONFIG, [`${OUTBOX}/0007-quotes/broken.md`]: 'no front matter' } });
    expect((await gh.joins.read(at)).items).toEqual({ ranks: [null], open: [{ id: null, rank: null }] });
  });

  it('reads no item when the PRD has no outbox, and says so when the head has no config', async () => {
    expect((await github({ files: CONFIG }).joins.read(at)).items).toEqual({ ranks: [], open: [] });
    expect((await github({ files: {} }).joins.read(at)).items).toEqual({ notRead: 'its head has no .omni-loop/config.yml' });
  });

  it('reads no outbox of a merged pull request', async () => {
    const gh = github({ pull: { state: 'closed', merged: true }, files: CONFIG });
    const read = await gh.joins.read(at);
    expect(read).toMatchObject({ merged: true, items: { ranks: [] } });
    expect(gh.calls.some(({ route }) => route.includes('/git/'))).toBe(false);
  });
});

describe('missionJoins.merge: a squash-merge into the mission branch, pinned to the head judged', () => {
  const merging = { ...at, head: HEAD, title: 'feat(quotes): faster', base: BRANCH, defaultBranch: 'main' };

  it('squash-merges, titled as the pull request, on the head the gate read', async () => {
    const gh = github();
    expect(await gh.joins.merge(merging)).toEqual({ ok: true });
    expect(gh.calls.at(-1)).toEqual({
      route: 'PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge',
      params: { owner: 'acme', repo: 'widgets', pull_number: 45, merge_method: 'squash', sha: HEAD, commit_title: 'feat(quotes): faster (#45)' },
    });
  });

  it('answers a refusal (the head moved, not mergeable) with GitHub\'s reason, never a throw', async () => {
    const gh = github({ merge: () => Promise.reject(Object.assign(new Error('Head branch was modified. Review and try the merge again.'), { status: 409 })) });
    expect(await gh.joins.merge(merging)).toEqual({ ok: false, why: 'GitHub refused the merge: Head branch was modified. Review and try the merge again.' });
  });

  it('throws on any other failure, so the run is retried', async () => {
    const gh = github({ merge: () => Promise.reject(Object.assign(new Error('Server Error'), { status: 502 })) });
    await expect(gh.joins.merge(merging)).rejects.toThrow('Server Error');
  });

  it('never merges into the default branch, asking GitHub nothing (N-PRODUCT-15)', async () => {
    const gh = github();
    await expect(gh.joins.merge({ ...merging, base: 'main' })).rejects.toThrow(DefaultBranchMergeError);
    expect(gh.calls).toEqual([]);
  });
});

describe('missionJoins.checks: the checks on the mission branch\'s own head (PRD 2896 s7)', () => {
  it('reads the head of the branch, then its check runs and commit statuses', async () => {
    const gh = github({
      runs: [{ id: 3, name: 'test', status: 'completed', conclusion: 'failure', output: { title: 'red' } }],
      statuses: [{ context: 'Vercel', state: 'success', description: null }],
    });
    expect(await gh.joins.checks?.({ installation: 7, repo: 'acme/widgets', branch: BRANCH })).toEqual({
      head: HEAD,
      runs: [{ id: 3, name: 'test', status: 'completed', conclusion: 'failure', title: 'red' }],
      statuses: [{ context: 'Vercel', state: 'success', description: null }],
    });
    expect(gh.calls[0]).toEqual({ route: 'GET /repos/{owner}/{repo}/git/ref/{ref}', params: { owner: 'acme', repo: 'widgets', ref: `heads/${BRANCH}` } });
  });
});

// A product PRD joins each repository's mission branch (PRD omni-loop-21 s7, spec "2. One mission branch per repository"): each
// of its target pull requests through the merge gate, its open items read on the server and given for every one.

describe('joinProduct: a product PRD\'s target pull requests into their repositories\' mission branches', () => {
  const passed = { body: `${reviewMarker(1, 'pass')}\n**Round 1 of 2: pass**`, commit: HEAD };
  const green = { runs: [{ id: 1, name: 'test', status: 'completed', conclusion: 'success', title: null }], statuses: [], reviews: [passed] };

  /** Joins whose pull requests read as `pulls` say (by repository), each judged green by default; every merge and read kept. */
  function joins(pulls: Record<string, Partial<PullRead>> = {}, refuse: readonly string[] = []) {
    const merged: string[] = [];
    const read: (PullAt & { prdRead: PullAt['prd'] })[] = [];
    const fake: MissionJoins = {
      read: (at) => {
        read.push({ ...at, prdRead: at.prd });
        const over = pulls[at.repo] ?? {};
        return Promise.resolve({
          number: at.pr, url: `https://github.com/${at.repo}/pull/${String(at.pr)}`, title: `Part of omni-loop-15`, state: 'open', draft: false, merged: false,
          base: BRANCH, defaultBranch: 'main', head: HEAD, ...green, items: { ranks: ['high'] }, ...over,
        });
      },
      merge: (at) => {
        if (at.base === at.defaultBranch) return Promise.reject(new DefaultBranchMergeError(at.base));
        if (refuse.includes(at.repo)) return Promise.resolve({ ok: false, why: 'GitHub refused the merge: Head branch was modified' });
        merged.push(`${at.repo}#${String(at.pr)}`);
        return Promise.resolve({ ok: true });
      },
    };
    return { fake, merged, read };
  }

  const targets = [{ repo: 'acme/api', pr: parsePr(12) }, { repo: 'acme/mobile', pr: parsePr(34) }];
  const none = { ranks: [] };

  it('squash-merges each target pull request into its repository\'s mission branch once every one passes the gate', async () => {
    const gh = joins();
    expect(await joinProduct(gh.fake, { installation: 7, targets, branch: BRANCH, items: none })).toEqual({
      joined: true,
      pulls: [
        { repo: 'acme/api', pr: 12, url: 'https://github.com/acme/api/pull/12' },
        { repo: 'acme/mobile', pr: 34, url: 'https://github.com/acme/mobile/pull/34' },
      ],
    });
    expect(gh.merged).toEqual(['acme/api#12', 'acme/mobile#34']);
    // No repository outbox is read for a product PRD: its items are the server's, given for every pull request.
    expect(gh.read.map((one) => one.prdRead)).toEqual([null, null]);
  });

  it('merges none while one waits, naming its repository, its pull request and what the gate lacks', async () => {
    const gh = joins({ 'acme/mobile': { draft: true } });
    expect(await joinProduct(gh.fake, { installation: 7, targets, branch: BRANCH, items: none })).toEqual({ joined: false, pulls: [], lacks: ['acme/mobile #34: #34 is a draft'] });
    expect(gh.merged).toEqual([]);
  });

  it('holds every pull request on the product PRD\'s open high item, read on the server', async () => {
    const gh = joins();
    const held = await joinProduct(gh.fake, { installation: 7, targets, branch: BRANCH, items: { ranks: ['high'] } });
    expect(held).toEqual({ joined: false, pulls: [], lacks: ['acme/api #12: 1 high item open', 'acme/mobile #34: 1 high item open'] });
    expect(gh.merged).toEqual([]);
  });

  it('reads a pull request merged into its mission branch already as joined, and merges it never twice', async () => {
    const gh = joins({ 'acme/api': { merged: true } });
    const done = await joinProduct(gh.fake, { installation: 7, targets, branch: BRANCH, items: none });
    expect(done.joined).toBe(true);
    expect(gh.merged).toEqual(['acme/mobile#34']);
  });

  it('waits on GitHub\'s refusal, naming the pull request, the ones merged before it kept as joined', async () => {
    const gh = joins({}, ['acme/mobile']);
    expect(await joinProduct(gh.fake, { installation: 7, targets, branch: BRANCH, items: none })).toEqual({
      joined: false,
      pulls: [{ repo: 'acme/api', pr: 12, url: 'https://github.com/acme/api/pull/12' }],
      lacks: ['acme/mobile #34: GitHub refused the merge: Head branch was modified'],
    });
  });

  it('never merges into a default branch (N-PRODUCT-15): a pull request into it waits', async () => {
    const gh = joins({ 'acme/api': { base: 'main' } });
    const held = await joinProduct(gh.fake, { installation: 7, targets, branch: 'main', items: none });
    expect(held.joined).toBe(false);
    expect(gh.merged).toEqual([]);
  });

  it('waits while the mission knows none of its target pull requests', async () => {
    expect(await joinProduct(joins().fake, { installation: 7, targets: [], branch: BRANCH, items: none })).toEqual({ joined: false, pulls: [], lacks: ['its target pull requests are not known to the mission'] });
  });
});
