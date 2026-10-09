import { describe, expect, it } from 'vitest';
import { makeRepo } from '../test/fixture.ts';
import { dig } from './dig.ts';
import { main } from './omni.ts';

/** What `omni board --json` prints, as these tests read it. */
type BoardPayload = {
  slices: { id: string; repo?: string; slug?: string | null; state: string; pr: { number: number } | null }[];
  frontier: unknown;
};

function io() {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => err.push(s) } };
}

const CONFIG = { '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: acme/widgets\n' };

function planMd(rows: string[]) {
  return [
    '# A plan',
    '',
    '| id | slice | territory | blocked by | wave |',
    '| --- | --- | --- | --- | --- |',
    ...rows,
    '',
  ].join('\n');
}

const HOUR_MS = 60 * 60 * 1000;

/** A fake `execFileSync`: resolves `git rev-parse --show-toplevel` to `root`, `gh pr list …` to
 * `prs` (as JSON), and `gh pr view <n> … --json commits` to `commitsByNumber[n]` (`[]` for any
 * number not named). Records every call. */
/** One call a fake `exec` was handed. */
type ExecCall = { file: string; args: readonly string[]; options: unknown };

function fakeExec(root: string, prs: unknown[], commitsByNumber: Record<string, unknown[]> = {}) {
  const calls: ExecCall[] = [];
  const exec = (file: string, args: readonly string[], options: unknown = {}) => {
    calls.push({ file, args, options });
    if (file === 'git' && args[0] === 'rev-parse') return `${root}\n`;
    if (file === 'gh' && args[0] === 'pr' && args[1] === 'list') return JSON.stringify(prs);
    if (file === 'gh' && args[0] === 'pr' && args[1] === 'view') {
      const number = Number(args[2]);
      return JSON.stringify({ commits: commitsByNumber[number] ?? [] });
    }
    throw new Error(`fakeExec: unexpected call ${file} ${args.join(' ')}`);
  };
  return { exec, calls };
}

function pr(overrides = {}) {
  return {
    number: 1,
    title: 's1',
    headRefName: 'feat/widgets--s1',
    baseRefName: 'feat/widgets',
    state: 'OPEN',
    isDraft: false,
    mergedAt: null,
    body: '',
    labels: [],
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(), // fresh — never a stale candidate unless a test says otherwise
    ...overrides,
  };
}

const LIST_JSON_FIELDS = 'number,title,headRefName,baseRefName,state,isDraft,mergedAt,body,labels,updatedAt,createdAt';

describe('omni board — the gh pr list call', () => {
  it('never asks for `commits`, and narrows to the feature branch when board.matchBy is "base" (the default)', async () => {
    const plan = planMd(['| s1 | Alpha | `a/` | — | 1 |']);
    const { root } = makeRepo({
      git: true,
      files: { ...CONFIG, '.omni-loop/delivery/inbox/0007-widgets/plan.md': plan },
    });
    const { exec, calls } = fakeExec(root, []);
    const s = io();
    await main(['board', '7'], { cwd: root, exec, ...s });

    const listCall = calls.find((call) => call.file === 'gh' && call.args[1] === 'list');
    expect(listCall?.args).toEqual([
      'pr',
      'list',
      '--repo',
      'acme/widgets',
      '--json',
      LIST_JSON_FIELDS,
      '--state',
      'all',
      '--limit',
      '200',
      '--base',
      'feat/widgets',
    ]);
    expect(listCall?.args.join(' ')).not.toMatch(/commits/);
  });

  it('narrows by --label instead of --base when board.matchBy is "label"', async () => {
    const plan = planMd(['| s1 | Alpha | `a/` | — | 1 |']);
    const { root } = makeRepo({
      git: true,
      files: {
        '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: acme/widgets\nboard:\n  matchBy: label\n',
        '.omni-loop/delivery/inbox/0007-widgets/plan.md': plan,
      },
    });
    const { exec, calls } = fakeExec(root, []);
    const s = io();
    await main(['board', '7'], { cwd: root, exec, ...s });

    const listCall = calls.find((call) => call.file === 'gh' && call.args[1] === 'list');
    expect(listCall?.args).toEqual([
      'pr',
      'list',
      '--repo',
      'acme/widgets',
      '--json',
      LIST_JSON_FIELDS,
      '--state',
      'all',
      '--limit',
      '200',
      '--label',
      'omni:sub',
    ]);
  });
});

describe('omni board — head commit dates', () => {
  it('fetches a head commit date with `gh pr view` only for an open draft old enough to be stale', async () => {
    const plan = planMd(['| s1 | Alpha | `a/` | — | 1 |']);
    const { root } = makeRepo({
      git: true,
      files: { ...CONFIG, '.omni-loop/delivery/inbox/0007-widgets/plan.md': plan },
    });
    const oldClaim = new Date(Date.now() - 2 * HOUR_MS).toISOString(); // older than the default 60-minute limit
    const { exec, calls } = fakeExec(root, [pr({ number: 42, isDraft: true, createdAt: oldClaim })], {
      42: [{ committedDate: oldClaim }],
    });
    const s = io();
    const code = await main(['board', '7'], { cwd: root, exec, ...s });

    expect(code).toBe(0);
    expect(s.out.join('')).toMatch(/s1\s+w1\s+claimed-stale/);
    const viewCall = calls.find((call) => call.file === 'gh' && call.args[1] === 'view');
    expect(viewCall?.args).toEqual(['pr', 'view', '42', '--repo', 'acme/widgets', '--json', 'commits']);
  });

  it('never calls `gh pr view` for a fresh draft, an open non-draft, or a merged pull request', async () => {
    const plan = planMd(['| s1 | Alpha | `a/` | — | 1 |', '| s2 | Beta | `b/` | — | 1 |']);
    const { root } = makeRepo({
      git: true,
      files: { ...CONFIG, '.omni-loop/delivery/inbox/0008-widgets/plan.md': plan },
    });
    const prs = [
      pr({ number: 1, headRefName: 'feat/widgets--s1', isDraft: true }), // fresh — not old enough to be stale
      pr({ number: 2, headRefName: 'feat/widgets--s2', mergedAt: new Date().toISOString(), state: 'MERGED' }),
    ];
    const { exec, calls } = fakeExec(root, prs);
    const s = io();
    const code = await main(['board', '8'], { cwd: root, exec, ...s });

    expect(code).toBe(0);
    expect(calls.some((call) => call.file === 'gh' && call.args[1] === 'view')).toBe(false);
  });

  it('reads claimed-stale even when a draft was updated recently — a comment bumps updatedAt, not the claim', async () => {
    const plan = planMd(['| s1 | Alpha | `a/` | — | 1 |']);
    const { root } = makeRepo({
      git: true,
      files: { ...CONFIG, '.omni-loop/delivery/inbox/0007-widgets/plan.md': plan },
    });
    const oldClaim = new Date(Date.now() - 2 * HOUR_MS).toISOString();
    const { exec } = fakeExec(
      root,
      [pr({ number: 1, isDraft: true, createdAt: oldClaim, updatedAt: new Date().toISOString() })],
      { 1: [{ committedDate: oldClaim }] },
    );
    const s = io();
    const code = await main(['board', '7'], { cwd: root, exec, ...s });
    expect(code).toBe(0);
    expect(s.out.join('')).toMatch(/s1\s+w1\s+claimed-stale/);
  });
});

describe('omni board — table and --json output', () => {
  it('prints one row per slice, and the takeable/runnable frontier', async () => {
    const plan = planMd(['| s1 | Alpha | `a/` | — | 1 |', '| s2 | Beta | `b/` | s1 | 2 |']);
    const { root } = makeRepo({
      git: true,
      files: { ...CONFIG, '.omni-loop/delivery/inbox/0007-widgets/plan.md': plan },
    });
    const { exec } = fakeExec(root, [pr({ mergedAt: new Date().toISOString(), state: 'MERGED' })]);
    const s = io();
    const code = await main(['board', '7'], { cwd: root, exec, ...s });

    expect(code).toBe(0);
    const text = s.out.join('');
    expect(text).toMatch(/omni board — PRD 7: 2 slice\(s\)/);
    expect(text).toMatch(/s1\s+w1\s+merged/);
    expect(text).toMatch(/s2\s+w2\s+runnable/);
    expect(text).toMatch(/runnable frontier: wave 2 — takeable: s2/);
    expect(text).toMatch(/of which runnable \(unclaimed\): s2/);
  });

  it('prints --json with the same shape boardFor returns, including the takeable field', async () => {
    const plan = planMd(['| s1 | Alpha | `a/` | — | 1 |']);
    const { root } = makeRepo({
      git: true,
      files: { ...CONFIG, '.omni-loop/delivery/inbox/0007-widgets/plan.md': plan },
    });
    const { exec } = fakeExec(root, []);
    const s = io();
    const code = await main(['board', '7', '--json'], { cwd: root, exec, ...s });

    expect(code).toBe(0);
    const payload = JSON.parse(s.out.join('')) as BoardPayload;
    expect(payload.slices).toHaveLength(1);
    expect(payload.slices[0]).toMatchObject({ id: 's1', state: 'runnable', pr: null });
    expect(payload.frontier).toEqual({ wave: 1, runnable: ['s1'], takeable: ['s1'], excluded: [], collisions: [] });
  });

  it('reports a stuck slice from the needs-fix label', async () => {
    const plan = planMd(['| s1 | Alpha | `a/` | — | 1 |']);
    const { root } = makeRepo({
      git: true,
      files: { ...CONFIG, '.omni-loop/delivery/inbox/0007-widgets/plan.md': plan },
    });
    const { exec } = fakeExec(root, [pr({ labels: [{ name: 'omni:needs-fix' }] })]);
    const s = io();
    const code = await main(['board', '7'], { cwd: root, exec, ...s });
    expect(code).toBe(0);
    expect(s.out.join('')).toMatch(/s1\s+w1\s+stuck/);
  });

  it('honours a configured board.matchBy of "label" when deciding a slice’s own state', async () => {
    const plan = planMd(['| s1 | Alpha | `a/` | — | 1 |']);
    const { root } = makeRepo({
      git: true,
      files: {
        '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: acme/widgets\nboard:\n  matchBy: label\n',
        '.omni-loop/delivery/inbox/0007-widgets/plan.md': plan,
      },
    });
    const { exec } = fakeExec(root, [pr({ baseRefName: 'main', labels: [{ name: 'omni:sub' }] })]);
    const s = io();
    const code = await main(['board', '7'], { cwd: root, exec, ...s });
    expect(code).toBe(0);
    expect(s.out.join('')).toMatch(/s1\s+w1\s+in-flight/);
  });

  it('reads a PRD of two landings per landing: one list per landing branch, one per landing PR, a line per landing', async () => {
    const plan = [
      '# A plan',
      '',
      '| id | slice | territory | blocked by | wave | landing |',
      '| --- | --- | --- | --- | --- | --- |',
      '| s1 | Expand | `db/` | — | 1 | 1 |',
      '| s2 | Code | `src/` | — | 1 | 2 |',
      '',
      '## Landings',
      '',
      '| landing | name | merge when |',
      '| --- | --- | --- |',
      '| 1 | expand | — |',
      '| 2 | code | landing 1 is deployed |',
      '',
    ].join('\n');
    const { root } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0007-widgets/plan.md': plan } });
    const { exec, calls } = fakeExec(root, [
      pr({ number: 1, baseRefName: 'feat/widgets-1of2-expand', state: 'MERGED', mergedAt: new Date().toISOString() }),
      pr({ number: 5, headRefName: 'feat/widgets-1of2-expand', baseRefName: 'main', isDraft: true }),
    ]);
    const s = io();
    expect(await main(['board', '7'], { cwd: root, exec, ...s })).toBe(0);

    const narrowed = calls.filter((call) => call.file === 'gh' && call.args[1] === 'list').map((call) => call.args.slice(-2).join(' '));
    expect(narrowed).toEqual([
      '--base feat/widgets-1of2-expand',
      '--base feat/widgets-2of2-code',
      '--head feat/widgets-1of2-expand',
      '--head feat/widgets-2of2-code',
    ]);
    const text = s.out.join('');
    expect(text).toMatch(/landing 1 \(expand\) feat\/widgets-1of2-expand — 1\/1 merged, 0 open, 0 not started — #5 draft\n/);
    expect(text).toMatch(/s1\s+w1\s+merged/);
    expect(text).toMatch(/landing 2 \(code\) feat\/widgets-2of2-code — 0\/1 merged, 0 open, 1 not started — no PR — current\n/);
    expect(text).toMatch(/runnable frontier: wave 1 of landing 2 — takeable: s2/);
  });

  it('fails usage with no PRD argument', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG } });
    const s = io();
    const code = await main(['board'], { cwd: root, exec: fakeExec(root, []).exec, ...s });
    expect(code).toBe(2);
    expect(s.err.join('')).toMatch(/usage: omni board <prd>/);
  });

  it('fails usage when the PRD has no inbox or shipped folder', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG } });
    const s = io();
    const code = await main(['board', '9'], { cwd: root, exec: fakeExec(root, []).exec, ...s });
    expect(code).toBe(2);
    expect(s.err.join('')).toMatch(/PRD 9 has no inbox or shipped folder/);
  });
});

describe('omni board — a plan repository (PRD 563)', () => {
  const PLAN_CONFIG = [
    'kit: 1',
    'repo:',
    '  slug: acme/widgets-plan',
    'plan:',
    '  targets:',
    '    - repo: acme/backend',
    '      role: back-end',
    '      knowledge: own',
    '    - repo: acme/frontend',
    '      role: front-end',
    '      knowledge: none',
    '',
  ].join('\n');

  function multiPlan(rows: string[]) {
    return [
      '# A plan',
      '',
      '| id | repo | slice | territory | blocked by | wave |',
      '| --- | --- | --- | --- | --- | --- |',
      ...rows,
      '',
    ].join('\n');
  }

  /** A fake `execFileSync` answering `gh pr list --repo <slug>` from `prsBySlug[slug]`; a slug in
   * `failing` throws as an unreadable repository does. */
  function fakeMultiExec(
    root: string,
    prsBySlug: Record<string, unknown[]>,
    { failing = [], commitsByNumber = {} }: { failing?: string[]; commitsByNumber?: Record<string, unknown[]> } = {},
  ) {
    const calls: ExecCall[] = [];
    const gh = (args: readonly string[]) => {
      const slug = String(args[args.indexOf('--repo') + 1]);
      if (failing.includes(slug)) {
        const error: Error & { stderr?: string } = new Error('gh: Could not resolve to a Repository');
        error.stderr = 'GraphQL: Could not resolve to a Repository';
        throw error;
      }
      if (args[1] === 'list') return JSON.stringify(prsBySlug[slug] ?? []);
      if (args[1] === 'view') return JSON.stringify({ commits: commitsByNumber[`${slug}#${args[2]}`] ?? [] });
      return null;
    };
    const exec = (file: string, args: readonly string[], options: unknown = {}) => {
      calls.push({ file, args, options });
      if (file === 'git' && args[0] === 'rev-parse') return `${root}\n`;
      const answer = file === 'gh' && args[0] === 'pr' ? gh(args) : null;
      if (answer === null) throw new Error(`fakeMultiExec: unexpected call ${file} ${args.join(' ')}`);
      return answer;
    };
    return { exec, calls };
  }

  function repoWith(plan: string, config = PLAN_CONFIG) {
    return makeRepo({
      git: true,
      files: { '.omni-loop/config.yml': config, '.omni-loop/delivery/inbox/0007-widgets/plan.md': plan },
    }).root;
  }

  const listCalls = (calls: ExecCall[]) => calls.filter((call) => call.file === 'gh' && call.args[1] === 'list');
  const repoOf = (call: ExecCall) => call.args[call.args.indexOf('--repo') + 1];

  it('makes one gh pr list per repository a slice names, the plan repository included, narrowed to the feature branch', async () => {
    const root = repoWith(
      multiPlan([
        '| s1 | backend | Alpha | `a/` | — | 1 |',
        '| s2 | frontend | Beta | `b/` | — | 1 |',
        '| s3 | backend | Gamma | `c/` | — | 1 |',
        '| s4 | widgets-plan | Delta | `d/` | — | 1 |',
      ]),
    );
    const { exec, calls } = fakeMultiExec(root, {});
    const code = await main(['board', '7', '--json'], { cwd: root, exec, ...io() });

    expect(code).toBe(0);
    const lists = listCalls(calls);
    expect(lists.map(repoOf)).toEqual(['acme/backend', 'acme/frontend', 'acme/widgets-plan']);
    for (const call of lists) expect(call.args.slice(-2)).toEqual(['--base', 'feat/widgets']);
  });

  it('never reads a repository no slice names', async () => {
    const root = repoWith(multiPlan(['| s1 | backend | Alpha | `a/` | — | 1 |']));
    const { exec, calls } = fakeMultiExec(root, {});
    await main(['board', '7', '--json'], { cwd: root, exec, ...io() });
    expect(listCalls(calls).map(repoOf)).toEqual(['acme/backend']);
  });

  it('narrows by --label instead of --base when board.matchBy is "label"', async () => {
    const root = repoWith(
      multiPlan(['| s1 | backend | Alpha | `a/` | — | 1 |', '| s2 | frontend | Beta | `b/` | — | 1 |']),
      `${PLAN_CONFIG}board:\n  matchBy: label\n`,
    );
    const { exec, calls } = fakeMultiExec(root, {});
    await main(['board', '7', '--json'], { cwd: root, exec, ...io() });
    for (const call of listCalls(calls)) expect(call.args.slice(-2)).toEqual(['--label', 'omni:sub']);
  });

  it('matches each slice only to a pull request of its own repository, and gives every row repo and slug', async () => {
    const root = repoWith(
      multiPlan([
        '| s1 | backend | Alpha | `a/` | — | 1 |',
        '| s2 | frontend | Beta | `b/` | s1 | 2 |',
        '| s3 | widgets-plan | Gamma | `c/` | — | 2 |',
      ]),
    );
    const merged = { state: 'MERGED', mergedAt: new Date().toISOString() };
    const { exec } = fakeMultiExec(root, {
      'acme/backend': [pr({ number: 5, ...merged })],
      // the same slice branch name in another repository ties nothing to s1
      'acme/frontend': [pr({ number: 9, headRefName: 'feat/widgets--s1' })],
    });
    const s = io();
    const code = await main(['board', '7', '--json'], { cwd: root, exec, ...s });

    expect(code).toBe(0);
    const payload = JSON.parse(s.out.join('')) as BoardPayload;
    expect(payload.slices.map(({ id, repo, slug, state }) => ({ id, repo, slug, state }))).toEqual([
      { id: 's1', repo: 'backend', slug: 'acme/backend', state: 'merged' },
      { id: 's2', repo: 'frontend', slug: 'acme/frontend', state: 'runnable' },
      { id: 's3', repo: 'widgets-plan', slug: 'acme/widgets-plan', state: 'runnable' },
    ]);
    expect(payload.slices[0]?.pr?.number).toBe(5);
    expect(payload.frontier).toMatchObject({ wave: 2, takeable: ['s2', 's3'] });
  });

  it('reads a head commit date from the repository the pull request lives in', async () => {
    const root = repoWith(multiPlan(['| s1 | frontend | Alpha | `a/` | — | 1 |']));
    const oldClaim = new Date(Date.now() - 2 * HOUR_MS).toISOString();
    const { exec, calls } = fakeMultiExec(
      root,
      { 'acme/frontend': [pr({ number: 42, isDraft: true, createdAt: oldClaim })] },
      { commitsByNumber: { 'acme/frontend#42': [{ committedDate: oldClaim }] } },
    );
    const s = io();
    await main(['board', '7', '--json'], { cwd: root, exec, ...s });

    expect(dig(JSON.parse(s.out.join('')), 'slices', 0, 'state')).toBe('claimed-stale');
    const viewCall = calls.find((call) => call.file === 'gh' && call.args[1] === 'view');
    expect(viewCall?.args).toEqual(['pr', 'view', '42', '--repo', 'acme/frontend', '--json', 'commits']);
  });

  it('makes the slices of a repository gh cannot read unreadable, holds what they block, and computes the rest', async () => {
    const root = repoWith(
      multiPlan([
        '| s1 | backend | Alpha | `a/` | — | 1 |',
        '| s2 | frontend | Beta | `b/` | — | 1 |',
        '| s3 | widgets-plan | Gamma | `c/` | s1 | 2 |',
      ]),
    );
    const { exec } = fakeMultiExec(root, {}, { failing: ['acme/backend'] });
    const s = io();
    const code = await main(['board', '7'], { cwd: root, exec, ...s });

    expect(code).toBe(0);
    const text = s.out.join('');
    expect(text).toMatch(/s1\s+backend\s+w1\s+unreadable/);
    expect(text).toMatch(/s2\s+frontend\s+w1\s+runnable/);
    expect(text).toMatch(/s3\s+widgets-plan\s+w2\s+blocked/);
    expect(text).toMatch(/runnable frontier: wave 1 — takeable: s2/);
    expect(text).toMatch(/cannot read acme\/backend/);
  });

  it('makes the slices of a repository neither a target nor the plan repository unreadable, calling no gh for it', async () => {
    const root = repoWith(multiPlan(['| s1 | nowhere | Alpha | `a/` | — | 1 |']));
    const { exec, calls } = fakeMultiExec(root, {});
    const s = io();
    await main(['board', '7', '--json'], { cwd: root, exec, ...s });

    expect(dig(JSON.parse(s.out.join('')), 'slices', 0)).toMatchObject({ repo: 'nowhere', slug: null, state: 'unreadable' });
    expect(listCalls(calls)).toEqual([]);
  });

  it('reads a plan without a repo column exactly as today, even in a plan repository: one list, no repo or slug', async () => {
    const root = repoWith(planMd(['| s1 | Alpha | `a/` | — | 1 |']));
    const { exec, calls } = fakeMultiExec(root, {});
    const s = io();
    await main(['board', '7', '--json'], { cwd: root, exec, ...s });

    expect(listCalls(calls).map(repoOf)).toEqual(['acme/widgets-plan']);
    const row = dig(JSON.parse(s.out.join('')), 'slices', 0);
    expect(row).not.toHaveProperty('repo');
    expect(row).not.toHaveProperty('slug');
  });
});

/** A fake `exec` as `fakeExec`, whose `git merge-base --is-ancestor <base> <branch>` exits 0 when
 * `<branch>` is in `onBase` and 1 (as git does when `<base>` is not an ancestor) otherwise. */
function fakeExecWithAncestry(root: string, prs: unknown[], onBase: readonly string[]) {
  const inner = fakeExec(root, prs);
  const exec = (file: string, args: readonly string[], options: unknown = {}) => {
    if (file === 'git' && args[0] === 'merge-base') {
      inner.calls.push({ file, args, options });
      if (onBase.includes(String(args[3]))) return '';
      throw Object.assign(new Error(`Command failed: git ${args.join(' ')}`), { status: 1 });
    }
    return inner.exec(file, args, options);
  };
  return { exec, calls: inner.calls };
}

const ancestryCalls = (calls: ExecCall[]) => calls.filter((call) => call.file === 'git' && call.args[0] === 'merge-base').map((call) => call.args.join(' '));

describe('omni board — a feature branch behind the default branch (issue 1179)', () => {
  it('says the feature branch is behind <remote>/<default branch> — a phase-0 merged after the plan — so the wave merges it in first', async () => {
    const plan = planMd(['| s1 | Alpha | `a/` | — | 1 |']);
    const { root } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0007-widgets/plan.md': plan } });
    const { exec, calls } = fakeExecWithAncestry(root, [], []);

    const json = io();
    expect(await main(['board', '7', '--json'], { cwd: root, exec, ...json })).toBe(0);
    expect(dig(JSON.parse(json.out.join('')), 'base')).toEqual({ branch: 'feat/widgets', onto: 'origin/main', behind: true });
    expect(ancestryCalls(calls)).toEqual(['merge-base --is-ancestor origin/main origin/feat/widgets']);

    const text = io();
    await main(['board', '7'], { cwd: root, exec, ...text });
    expect(text.out.join('')).toMatch(/omni board — feat\/widgets is behind origin\/main: merge origin\/main into it before reading the plan or running a wave\.\n/);
  });

  it('says nothing more when the default branch is already in the feature branch', async () => {
    const plan = planMd(['| s1 | Alpha | `a/` | — | 1 |']);
    const { root } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0007-widgets/plan.md': plan } });
    const { exec } = fakeExecWithAncestry(root, [], ['origin/feat/widgets']);

    const json = io();
    await main(['board', '7', '--json'], { cwd: root, exec, ...json });
    expect(dig(JSON.parse(json.out.join('')), 'base')).toEqual({ branch: 'feat/widgets', onto: 'origin/main', behind: false });
    const text = io();
    await main(['board', '7'], { cwd: root, exec, ...text });
    expect(text.out.join('')).not.toMatch(/is behind/);
  });

  it('reads `behind: null` when git cannot answer (the branch was never pushed), and still prints the board', async () => {
    const plan = planMd(['| s1 | Alpha | `a/` | — | 1 |']);
    const { root } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0007-widgets/plan.md': plan } });
    const { exec } = fakeExec(root, []);
    const json = io();
    expect(await main(['board', '7', '--json'], { cwd: root, exec, ...json })).toBe(0);
    expect(dig(JSON.parse(json.out.join('')), 'base')).toEqual({ branch: 'feat/widgets', onto: 'origin/main', behind: null });
  });

  const LANDINGS_PLAN = [
    '# A plan',
    '',
    '| id | slice | territory | blocked by | wave | landing |',
    '| --- | --- | --- | --- | --- | --- |',
    '| s1 | Expand | `db/` | — | 1 | 1 |',
    '| s2 | Code | `src/` | — | 1 | 2 |',
    '',
    '## Landings',
    '',
    '| landing | name | merge when |',
    '| --- | --- | --- |',
    '| 1 | expand | — |',
    '| 2 | code | landing 1 is deployed |',
    '',
  ].join('\n');

  it('checks landing 1, the current landing, against the default branch', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0007-widgets/plan.md': LANDINGS_PLAN } });
    const { exec, calls } = fakeExecWithAncestry(root, [pr({ number: 5, headRefName: 'feat/widgets-1of2-expand', baseRefName: 'main', isDraft: true })], []);
    const json = io();
    await main(['board', '7', '--json'], { cwd: root, exec, ...json });
    expect(dig(JSON.parse(json.out.join('')), 'base')).toEqual({ branch: 'feat/widgets-1of2-expand', onto: 'origin/main', behind: true });
    expect(ancestryCalls(calls)).toEqual(['merge-base --is-ancestor origin/main origin/feat/widgets-1of2-expand']);
  });

  it('checks a later landing only once its PR is based on the default branch (landing 1 merged), never while it is stacked', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0007-widgets/plan.md': LANDINGS_PLAN } });
    const merged = pr({ number: 1, baseRefName: 'feat/widgets-1of2-expand', state: 'MERGED', mergedAt: new Date().toISOString() });
    const stacked = fakeExecWithAncestry(root, [merged, pr({ number: 6, headRefName: 'feat/widgets-2of2-code', baseRefName: 'feat/widgets-1of2-expand', isDraft: true })], []);
    const json = io();
    await main(['board', '7', '--json'], { cwd: root, exec: stacked.exec, ...json });
    expect(dig(JSON.parse(json.out.join('')), 'base')).toBeNull();
    expect(ancestryCalls(stacked.calls)).toEqual([]);

    const retargeted = fakeExecWithAncestry(root, [merged, pr({ number: 6, headRefName: 'feat/widgets-2of2-code', baseRefName: 'main', isDraft: true })], []);
    const again = io();
    await main(['board', '7', '--json'], { cwd: root, exec: retargeted.exec, ...again });
    expect(dig(JSON.parse(again.out.join('')), 'base')).toEqual({ branch: 'feat/widgets-2of2-code', onto: 'origin/main', behind: true });
  });
});
