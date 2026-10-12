import { describe, expect, it } from 'vitest';
import { makeRepo } from '../test/fixture.ts';
import { dig } from './dig.ts';
import { main } from './omni.ts';
import { aChange, fakeLoopReads } from '../lib/loop-reads/fake.ts';
import type { FakeLoopState, FakeRead } from '../lib/loop-reads/fake.ts';
import { LoopReadError } from '../lib/loop-reads/port.ts';
import type { ChangesQuery } from '../lib/loop-reads/port.ts';
import type { LoopChange } from '../lib/loop-reads/contract.ts';
import type { TokenStore } from '../lib/ask/client.ts';
import { parsePr } from '../lib/ids.ts';

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

/** One call a fake `exec` was handed. */
type ExecCall = { file: string; args: readonly string[] };

/** A fake `execFileSync` that answers `git rev-parse --show-toplevel` with `root`, and records every
 * call: the board runs no `gh`. */
function fakeExec(root: string) {
  const calls: ExecCall[] = [];
  const exec = (file: string, args: readonly string[]) => {
    calls.push({ file, args });
    if (file === 'git' && args[0] === 'rev-parse') return `${root}\n`;
    throw new Error(`fakeExec: unexpected call ${file} ${args.join(' ')}`);
  };
  return { exec, calls };
}

/** A sub-PR of the feature `widgets`, as the Omni page answers a change. */
function change(overrides: Partial<LoopChange> = {}): LoopChange {
  return aChange({
    number: parsePr(1),
    title: 's1',
    head: 'feat/widgets--s1',
    base: 'feat/widgets',
    state: 'open',
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(), // fresh — never a stale candidate unless a test says otherwise
    ...overrides,
  });
}

/** A board of `plan` (PRD `prd`, folder `widgets`) read from `state`, through `main()`. */
async function boardOf(plan: string, state: FakeLoopState, { args = [], config = CONFIG, prd = 7 }: { args?: string[]; config?: Record<string, string>; prd?: number } = {}) {
  const { root } = makeRepo({ git: true, files: { ...config, [`.omni-loop/delivery/inbox/${String(prd).padStart(4, '0')}-widgets/plan.md`]: plan } });
  const { exec, calls } = fakeExec(root);
  const reads = fakeLoopReads(state);
  const s = io();
  const code = await main(['board', String(prd), ...args], { cwd: root, exec, reads, ...s });
  return { code, out: s.out.join(''), err: s.err.join(''), reads: reads.reads, calls };
}

const listQueries = (reads: FakeRead[]): ChangesQuery[] => reads.flatMap((read) => (read.read === 'changes' ? [read.query] : []));
const merged = { state: 'merged', mergedAt: new Date().toISOString() } as const;

describe('omni board — the changes read', () => {
  it('reads every change of the feature, merged and closed too, narrowed to the feature branch when board.matchBy is "base" (the default)', async () => {
    const { reads } = await boardOf(planMd(['| s1 | Alpha | `a/` | — | 1 |']), {});
    expect(listQueries(reads)).toEqual([{ repo: 'acme/widgets', state: 'all', base: 'feat/widgets' }]);
  });

  it('narrows by label instead of base when board.matchBy is "label"', async () => {
    const config = { '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: acme/widgets\nboard:\n  matchBy: label\n' };
    const { reads } = await boardOf(planMd(['| s1 | Alpha | `a/` | — | 1 |']), {}, { config });
    expect(listQueries(reads)).toEqual([{ repo: 'acme/widgets', state: 'all', label: 'omni:sub' }]);
  });

  it('reads the repository --repo names', async () => {
    const { reads } = await boardOf(planMd(['| s1 | Alpha | `a/` | — | 1 |']), {}, { args: ['--repo', 'acme/other'] });
    expect(listQueries(reads).map((query) => query.repo)).toEqual(['acme/other']);
  });

  it('runs no gh command', async () => {
    const { calls } = await boardOf(planMd(['| s1 | Alpha | `a/` | — | 1 |']), { changes: { 'acme/widgets': [change()] } });
    expect(calls.filter((call) => call.file === 'gh')).toEqual([]);
  });
});

describe('omni board — head commit dates', () => {
  it('reads a change for its last commit only for an open draft old enough to be stale', async () => {
    const oldClaim = new Date(Date.now() - 2 * HOUR_MS).toISOString(); // older than the default 60-minute limit
    const { code, out, reads } = await boardOf(planMd(['| s1 | Alpha | `a/` | — | 1 |']), {
      changes: { 'acme/widgets': [change({ number: parsePr(42), state: 'draft', createdAt: oldClaim })] },
      details: { 'acme/widgets#42': { lastCommitAt: oldClaim } },
    });

    expect(code).toBe(0);
    expect(out).toMatch(/s1\s+w1\s+claimed-stale/);
    expect(reads.filter((read) => read.read === 'change')).toEqual([{ read: 'change', repo: 'acme/widgets', number: 42 }]);
  });

  it('reads an old draft with a commit after its claim as in flight', async () => {
    const oldClaim = new Date(Date.now() - 2 * HOUR_MS).toISOString();
    const { out } = await boardOf(planMd(['| s1 | Alpha | `a/` | — | 1 |']), {
      changes: { 'acme/widgets': [change({ number: parsePr(42), state: 'draft', createdAt: oldClaim })] },
      details: { 'acme/widgets#42': { lastCommitAt: new Date(Date.now() - HOUR_MS).toISOString() } },
    });
    expect(out).toMatch(/s1\s+w1\s+in-flight/);
  });

  it('never reads a change for a fresh draft, an open non-draft, an old closed draft or a merged change', async () => {
    const oldClaim = new Date(Date.now() - 2 * HOUR_MS).toISOString();
    const plan = planMd(['| s1 | Alpha | `a/` | — | 1 |', '| s2 | Beta | `b/` | — | 1 |', '| s3 | Gamma | `c/` | — | 1 |', '| s4 | Delta | `d/` | — | 1 |']);
    const { code, reads } = await boardOf(
      plan,
      {
        changes: {
          'acme/widgets': [
            change({ number: parsePr(1), head: 'feat/widgets--s1', state: 'draft' }), // fresh — not old enough to be stale
            change({ number: parsePr(2), head: 'feat/widgets--s2', ...merged }),
            change({ number: parsePr(3), head: 'feat/widgets--s3', createdAt: oldClaim }),
            change({ number: parsePr(4), head: 'feat/widgets--s4', state: 'closed', createdAt: oldClaim }),
          ],
        },
      },
      { prd: 8 },
    );

    expect(code).toBe(0);
    expect(reads.some((read) => read.read === 'change')).toBe(false);
  });

  it('reads claimed-stale even when a draft was updated recently — a comment bumps updatedAt, not the claim', async () => {
    const oldClaim = new Date(Date.now() - 2 * HOUR_MS).toISOString();
    const { code, out } = await boardOf(planMd(['| s1 | Alpha | `a/` | — | 1 |']), {
      changes: { 'acme/widgets': [change({ state: 'draft', createdAt: oldClaim, updatedAt: new Date().toISOString() })] },
      details: { 'acme/widgets#1': { lastCommitAt: oldClaim } },
    });
    expect(code).toBe(0);
    expect(out).toMatch(/s1\s+w1\s+claimed-stale/);
  });
});

describe('omni board — table and --json output', () => {
  it('prints one row per slice, and the takeable/runnable frontier', async () => {
    const { code, out } = await boardOf(planMd(['| s1 | Alpha | `a/` | — | 1 |', '| s2 | Beta | `b/` | s1 | 2 |']), {
      changes: { 'acme/widgets': [change(merged)] },
    });

    expect(code).toBe(0);
    expect(out).toMatch(/omni board — PRD 7: 2 slice\(s\)/);
    expect(out).toMatch(/s1\s+w1\s+merged\s+#1/);
    expect(out).toMatch(/s2\s+w2\s+runnable/);
    expect(out).toMatch(/runnable frontier: wave 2 — takeable: s2/);
    expect(out).toMatch(/of which runnable \(unclaimed\): s2/);
  });

  it('prints --json with the same shape boardFor returns, including the takeable field', async () => {
    const { code, out } = await boardOf(planMd(['| s1 | Alpha | `a/` | — | 1 |']), {}, { args: ['--json'] });

    expect(code).toBe(0);
    const payload = JSON.parse(out) as BoardPayload;
    expect(payload.slices).toHaveLength(1);
    expect(payload.slices[0]).toMatchObject({ id: 's1', state: 'runnable', pr: null });
    expect(payload.frontier).toEqual({ wave: 1, runnable: ['s1'], takeable: ['s1'], excluded: [], collisions: [] });
  });

  it('gives a slice its change as a pull request in --json: number, head, base, draft and labels', async () => {
    const { out } = await boardOf(
      planMd(['| s1 | Alpha | `a/` | — | 1 |']),
      { changes: { 'acme/widgets': [change({ number: parsePr(12), state: 'draft', labels: ['omni:sub'] })] } },
      { args: ['--json'] },
    );
    expect(dig(JSON.parse(out), 'slices', 0, 'pr')).toMatchObject({
      number: 12,
      headRefName: 'feat/widgets--s1',
      baseRefName: 'feat/widgets',
      state: 'OPEN',
      isDraft: true,
      labels: ['omni:sub'],
    });
  });

  it('reports a stuck slice from the needs-fix label', async () => {
    const { code, out } = await boardOf(planMd(['| s1 | Alpha | `a/` | — | 1 |']), { changes: { 'acme/widgets': [change({ labels: ['omni:needs-fix'] })] } });
    expect(code).toBe(0);
    expect(out).toMatch(/s1\s+w1\s+stuck/);
  });

  it('never matches a closed change: its slice reads runnable again', async () => {
    const { out } = await boardOf(planMd(['| s1 | Alpha | `a/` | — | 1 |']), { changes: { 'acme/widgets': [change({ state: 'closed' })] } });
    expect(out).toMatch(/s1\s+w1\s+runnable/);
  });

  it('honours a configured board.matchBy of "label" when deciding a slice’s own state', async () => {
    const config = { '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: acme/widgets\nboard:\n  matchBy: label\n' };
    const { code, out } = await boardOf(
      planMd(['| s1 | Alpha | `a/` | — | 1 |']),
      { changes: { 'acme/widgets': [change({ base: 'main', labels: ['omni:sub'] })] } },
      { config },
    );
    expect(code).toBe(0);
    expect(out).toMatch(/s1\s+w1\s+in-flight/);
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
    const { code, out, reads } = await boardOf(plan, {
      changes: {
        'acme/widgets': [
          change({ number: parsePr(1), base: 'feat/widgets-1of2-expand', ...merged }),
          change({ number: parsePr(5), head: 'feat/widgets-1of2-expand', base: 'main', state: 'draft' }),
        ],
      },
    });
    expect(code).toBe(0);

    expect(listQueries(reads).map(({ base, head }) => (base ? `base ${base}` : `head ${head}`))).toEqual([
      'base feat/widgets-1of2-expand',
      'base feat/widgets-2of2-code',
      'head feat/widgets-1of2-expand',
      'head feat/widgets-2of2-code',
    ]);
    expect(out).toMatch(/landing 1 \(expand\) feat\/widgets-1of2-expand — 1\/1 merged, 0 open, 0 not started — #5 draft\n/);
    expect(out).toMatch(/s1\s+w1\s+merged/);
    expect(out).toMatch(/landing 2 \(code\) feat\/widgets-2of2-code — 0\/1 merged, 0 open, 1 not started — no PR — current\n/);
    expect(out).toMatch(/runnable frontier: wave 1 of landing 2 — takeable: s2/);
  });

  it('fails usage with no PRD argument', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG } });
    const s = io();
    const code = await main(['board'], { cwd: root, exec: fakeExec(root).exec, reads: fakeLoopReads(), ...s });
    expect(code).toBe(2);
    expect(s.err.join('')).toMatch(/usage: omni board <prd>/);
  });

  it('fails usage when the PRD has no inbox or shipped folder', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG } });
    const s = io();
    const code = await main(['board', '9'], { cwd: root, exec: fakeExec(root).exec, reads: fakeLoopReads(), ...s });
    expect(code).toBe(2);
    expect(s.err.join('')).toMatch(/PRD 9 has no inbox or shipped folder/);
  });
});

describe('omni board — a read that cannot be made', () => {
  const plan = planMd(['| s1 | Alpha | `a/` | — | 1 |']);

  it.each([
    ['no sign-in (omni signin)', 'everything'],
    ['unreachable', 'everything'],
    ['refused (404): this Omni page cannot read the loop yet', 'everything'],
    ['refused (403): acme/widgets is not in your workspace', 'repository'],
  ] as const)('prints "%s" alone on stderr and exits 1', async (line, scope) => {
    const { code, out, err } = await boardOf(plan, { everything: new LoopReadError(line, scope) });
    expect(code).toBe(1);
    expect(err).toBe(`${line}\n`);
    expect(out).toBe('');
  });

  /** A repository whose Omni page is `https://omni.example.test`, with PRD 7's plan. */
  const withPage = () =>
    makeRepo({
      git: true,
      files: {
        '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: acme/widgets\nask:\n  url: https://omni.example.test\n',
        '.omni-loop/delivery/inbox/0007-widgets/plan.md': plan,
      },
    }).root;

  /** A token store signed in to the Omni page's host. */
  const signedIn = (): TokenStore => ({ read: () => ({ access_token: 'at', refresh_token: 'rt', expires_at: null }), write: () => undefined });

  it('reads the Omni page of ask.url with the sign-in, and prints its 403 in its own words', async () => {
    const root = withPage();
    const urls: string[] = [];
    const fetch = (url: string) => {
      urls.push(url);
      return Promise.resolve(new Response(JSON.stringify({ error: 'acme/widgets is not in your workspace: No workspace you belong to lists it.' }), { status: 403 }));
    };
    const s = io();
    const code = await main(['board', '7'], { cwd: root, exec: fakeExec(root).exec, tokens: signedIn(), fetch, ...s });
    expect(code).toBe(1);
    expect(s.err.join('')).toBe('refused (403): acme/widgets is not in your workspace: No workspace you belong to lists it\n');
    expect(urls).toEqual(['https://omni.example.test/api/loop/changes?repo=acme%2Fwidgets&base=feat%2Fwidgets&state=all']);
  });

  it('prints no sign-in when the terminal has none, calling nothing', async () => {
    const root = withPage();
    let called = false;
    const fetch = () => {
      called = true;
      return Promise.resolve(new Response('{}'));
    };
    const s = io();
    const tokens: TokenStore = { read: () => null, write: () => undefined };
    expect(await main(['board', '7'], { cwd: root, exec: fakeExec(root).exec, tokens, fetch, ...s })).toBe(1);
    expect(s.err.join('')).toBe('no sign-in (omni signin)\n');
    expect(called).toBe(false);
  });

  it('says so when no Omni page is set here', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0007-widgets/plan.md': plan } });
    const s = io();
    expect(await main(['board', '7'], { cwd: root, exec: fakeExec(root).exec, tokens: signedIn(), ...s })).toBe(1);
    expect(s.err.join('')).toBe('no Omni page is set here (ask.url)\n');
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

  const across = (plan: string, state: FakeLoopState, args: string[] = ['--json'], config = PLAN_CONFIG) =>
    boardOf(plan, state, { args, config: { '.omni-loop/config.yml': config } });
  const reposRead = (reads: FakeRead[]) => listQueries(reads).map((query) => query.repo);

  it('makes one list per repository a slice names, the plan repository included, narrowed to the feature branch', async () => {
    const { code, reads } = await across(
      multiPlan([
        '| s1 | backend | Alpha | `a/` | — | 1 |',
        '| s2 | frontend | Beta | `b/` | — | 1 |',
        '| s3 | backend | Gamma | `c/` | — | 1 |',
        '| s4 | widgets-plan | Delta | `d/` | — | 1 |',
      ]),
      {},
    );

    expect(code).toBe(0);
    expect(reposRead(reads)).toEqual(['acme/backend', 'acme/frontend', 'acme/widgets-plan']);
    for (const query of listQueries(reads)) expect(query.base).toBe('feat/widgets');
  });

  it('never reads a repository no slice names', async () => {
    const { reads } = await across(multiPlan(['| s1 | backend | Alpha | `a/` | — | 1 |']), {});
    expect(reposRead(reads)).toEqual(['acme/backend']);
  });

  it('narrows by label instead of base when board.matchBy is "label"', async () => {
    const { reads } = await across(
      multiPlan(['| s1 | backend | Alpha | `a/` | — | 1 |', '| s2 | frontend | Beta | `b/` | — | 1 |']),
      {},
      ['--json'],
      `${PLAN_CONFIG}board:\n  matchBy: label\n`,
    );
    for (const query of listQueries(reads)) expect(query).toMatchObject({ label: 'omni:sub' });
  });

  it('matches each slice only to a change of its own repository, and gives every row repo and slug', async () => {
    const { code, out } = await across(
      multiPlan([
        '| s1 | backend | Alpha | `a/` | — | 1 |',
        '| s2 | frontend | Beta | `b/` | s1 | 2 |',
        '| s3 | widgets-plan | Gamma | `c/` | — | 2 |',
      ]),
      {
        changes: {
          'acme/backend': [change({ number: parsePr(5), ...merged })],
          // the same slice branch name in another repository ties nothing to s1
          'acme/frontend': [change({ number: parsePr(9), head: 'feat/widgets--s1' })],
        },
      },
    );

    expect(code).toBe(0);
    const payload = JSON.parse(out) as BoardPayload;
    expect(payload.slices.map(({ id, repo, slug, state }) => ({ id, repo, slug, state }))).toEqual([
      { id: 's1', repo: 'backend', slug: 'acme/backend', state: 'merged' },
      { id: 's2', repo: 'frontend', slug: 'acme/frontend', state: 'runnable' },
      { id: 's3', repo: 'widgets-plan', slug: 'acme/widgets-plan', state: 'runnable' },
    ]);
    expect(payload.slices[0]?.pr?.number).toBe(5);
    expect(payload.frontier).toMatchObject({ wave: 2, takeable: ['s2', 's3'] });
  });

  it('reads a head commit date from the repository the change lives in', async () => {
    const oldClaim = new Date(Date.now() - 2 * HOUR_MS).toISOString();
    const { out, reads } = await across(multiPlan(['| s1 | frontend | Alpha | `a/` | — | 1 |']), {
      changes: { 'acme/frontend': [change({ number: parsePr(42), state: 'draft', createdAt: oldClaim })] },
      details: { 'acme/frontend#42': { lastCommitAt: oldClaim } },
    });

    expect(dig(JSON.parse(out), 'slices', 0, 'state')).toBe('claimed-stale');
    expect(reads.filter((read) => read.read === 'change')).toEqual([{ read: 'change', repo: 'acme/frontend', number: 42 }]);
  });

  it('makes the slices of a repository the page refuses unreadable, holds what they block, and computes the rest', async () => {
    const { code, out } = await across(
      multiPlan([
        '| s1 | backend | Alpha | `a/` | — | 1 |',
        '| s2 | frontend | Beta | `b/` | — | 1 |',
        '| s3 | widgets-plan | Gamma | `c/` | s1 | 2 |',
      ]),
      { failing: { 'acme/backend': new LoopReadError('refused (424): The Omni app cannot read acme/backend: https://example.test/install', 'repository') } },
      [],
    );

    expect(code).toBe(0);
    expect(out).toMatch(/s1\s+backend\s+w1\s+unreadable/);
    expect(out).toMatch(/s2\s+frontend\s+w1\s+runnable/);
    expect(out).toMatch(/s3\s+widgets-plan\s+w2\s+blocked/);
    expect(out).toMatch(/runnable frontier: wave 1 — takeable: s2/);
    expect(out).toMatch(/cannot read acme\/backend: refused \(424\): The Omni app cannot read acme\/backend: https:\/\/example.test\/install — its slices are unreadable/);
  });

  it('stops the whole board, exit 1, on a read no repository can make', async () => {
    const { code, err } = await across(
      multiPlan(['| s1 | backend | Alpha | `a/` | — | 1 |', '| s2 | frontend | Beta | `b/` | — | 1 |']),
      { failing: { 'acme/frontend': new LoopReadError('unreachable', 'everything') } },
      [],
    );
    expect(code).toBe(1);
    expect(err).toBe('unreachable\n');
  });

  it('makes the slices of a repository neither a target nor the plan repository unreadable, reading nothing for it', async () => {
    const { out, reads } = await across(multiPlan(['| s1 | nowhere | Alpha | `a/` | — | 1 |']), {});

    expect(dig(JSON.parse(out), 'slices', 0)).toMatchObject({ repo: 'nowhere', slug: null, state: 'unreadable' });
    expect(listQueries(reads)).toEqual([]);
  });

  it('reads a plan without a repo column exactly as today, even in a plan repository: one list, no repo or slug', async () => {
    const { out, reads } = await across(planMd(['| s1 | Alpha | `a/` | — | 1 |']), {});

    expect(reposRead(reads)).toEqual(['acme/widgets-plan']);
    const row = dig(JSON.parse(out), 'slices', 0);
    expect(row).not.toHaveProperty('repo');
    expect(row).not.toHaveProperty('slug');
  });
});

/** A fake `exec` as `fakeExec`, whose `git merge-base --is-ancestor <base> <branch>` exits 0 when
 * `<branch>` is in `onBase` and 1 (as git does when `<base>` is not an ancestor) otherwise. */
function fakeExecWithAncestry(root: string, onBase: readonly string[]) {
  const inner = fakeExec(root);
  const exec = (file: string, args: readonly string[]) => {
    if (file === 'git' && args[0] === 'merge-base') {
      inner.calls.push({ file, args });
      if (onBase.includes(String(args[3]))) return '';
      throw Object.assign(new Error(`Command failed: git ${args.join(' ')}`), { status: 1 });
    }
    return inner.exec(file, args);
  };
  return { exec, calls: inner.calls };
}

const ancestryCalls = (calls: ExecCall[]) => calls.filter((call) => call.file === 'git' && call.args[0] === 'merge-base').map((call) => call.args.join(' '));

describe('omni board — a feature branch behind the default branch (issue 1179)', () => {
  it('says the feature branch is behind <remote>/<default branch> — a phase-0 merged after the plan — so the wave merges it in first', async () => {
    const plan = planMd(['| s1 | Alpha | `a/` | — | 1 |']);
    const { root } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0007-widgets/plan.md': plan } });
    const { exec, calls } = fakeExecWithAncestry(root, []);

    const json = io();
    expect(await main(['board', '7', '--json'], { cwd: root, exec, reads: fakeLoopReads({}), ...json })).toBe(0);
    expect(dig(JSON.parse(json.out.join('')), 'base')).toEqual({ branch: 'feat/widgets', onto: 'origin/main', behind: true });
    expect(ancestryCalls(calls)).toEqual(['merge-base --is-ancestor origin/main origin/feat/widgets']);

    const text = io();
    await main(['board', '7'], { cwd: root, exec, reads: fakeLoopReads({}), ...text });
    expect(text.out.join('')).toMatch(/omni board — feat\/widgets is behind origin\/main: merge origin\/main into it before reading the plan or running a wave\.\n/);
  });

  it('says nothing more when the default branch is already in the feature branch', async () => {
    const plan = planMd(['| s1 | Alpha | `a/` | — | 1 |']);
    const { root } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0007-widgets/plan.md': plan } });
    const { exec } = fakeExecWithAncestry(root, ['origin/feat/widgets']);

    const json = io();
    await main(['board', '7', '--json'], { cwd: root, exec, reads: fakeLoopReads({}), ...json });
    expect(dig(JSON.parse(json.out.join('')), 'base')).toEqual({ branch: 'feat/widgets', onto: 'origin/main', behind: false });
    const text = io();
    await main(['board', '7'], { cwd: root, exec, reads: fakeLoopReads({}), ...text });
    expect(text.out.join('')).not.toMatch(/is behind/);
  });

  it('reads `behind: null` when git cannot answer (the branch was never pushed), and still prints the board', async () => {
    const plan = planMd(['| s1 | Alpha | `a/` | — | 1 |']);
    const { root } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0007-widgets/plan.md': plan } });
    const { exec } = fakeExec(root);
    const json = io();
    expect(await main(['board', '7', '--json'], { cwd: root, exec, reads: fakeLoopReads({}), ...json })).toBe(0);
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
    const { exec, calls } = fakeExecWithAncestry(root, []);
    const reads = fakeLoopReads({ changes: { 'acme/widgets': [change({ number: parsePr(5), head: 'feat/widgets-1of2-expand', base: 'main', state: 'draft' })] } });
    const json = io();
    await main(['board', '7', '--json'], { cwd: root, exec, reads, ...json });
    expect(dig(JSON.parse(json.out.join('')), 'base')).toEqual({ branch: 'feat/widgets-1of2-expand', onto: 'origin/main', behind: true });
    expect(ancestryCalls(calls)).toEqual(['merge-base --is-ancestor origin/main origin/feat/widgets-1of2-expand']);
  });

  it('checks a later landing only once its PR is based on the default branch (landing 1 merged), never while it is stacked', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0007-widgets/plan.md': LANDINGS_PLAN } });
    const mergedLanding = change({ number: parsePr(1), head: 'feat/widgets--s1', base: 'feat/widgets-1of2-expand', ...merged });
    const landingTwo = (base: string) => fakeLoopReads({ changes: { 'acme/widgets': [mergedLanding, change({ number: parsePr(6), head: 'feat/widgets-2of2-code', base, state: 'draft' })] } });
    const stacked = fakeExecWithAncestry(root, []);
    const json = io();
    await main(['board', '7', '--json'], { cwd: root, exec: stacked.exec, reads: landingTwo('feat/widgets-1of2-expand'), ...json });
    expect(dig(JSON.parse(json.out.join('')), 'base')).toBeNull();
    expect(ancestryCalls(stacked.calls)).toEqual([]);

    const retargeted = fakeExecWithAncestry(root, []);
    const again = io();
    await main(['board', '7', '--json'], { cwd: root, exec: retargeted.exec, reads: landingTwo('main'), ...again });
    expect(dig(JSON.parse(again.out.join('')), 'base')).toEqual({ branch: 'feat/widgets-2of2-code', onto: 'origin/main', behind: true });
  });
});

describe('omni board — slices built inline (issue 1722)', () => {
  const PLAN = planMd(['| s1 | Alpha | `a/` | — | 1 |', '| s2 | Beta | `b/` | s1 | 2 |']);
  const inlineConfig = (below: number) => ({ '.omni-loop/config.yml': `kit: 1\nrepo:\n  slug: acme/widgets\nwave:\n  inlineBelow: ${below}\n` });

  /** A fake `exec` whose `git log <remote>/main..<remote>/<branch>` prints `messages`, or fails when it is null. */
  function execWithLog(root: string, messages: string | null) {
    const inner = fakeExec(root);
    const exec = (file: string, args: readonly string[]) => {
      if (file === 'git' && args[0] === 'log') {
        inner.calls.push({ file, args });
        if (messages === null) throw new Error('unknown revision');
        return messages;
      }
      return inner.exec(file, args);
    };
    return { exec, calls: inner.calls };
  }

  async function boardWith(config: Record<string, string>, messages: string | null, args: string[] = ['--json']) {
    const { root } = makeRepo({ git: true, files: { ...config, '.omni-loop/delivery/inbox/0007-widgets/plan.md': PLAN } });
    const { exec, calls } = execWithLog(root, messages);
    const s = io();
    const code = await main(['board', '7', ...args], { cwd: root, exec, reads: fakeLoopReads({}), ...s });
    return { code, out: s.out.join(''), calls };
  }

  const logCalls = (calls: ExecCall[]) => calls.filter((call) => call.file === 'git' && call.args[0] === 'log').map((call) => call.args.join(' '));

  it('reads a slice with an Omni-Slice commit on the feature branch as merged, frees the next, and says the PRD is inline', async () => {
    const { code, out, calls } = await boardWith(inlineConfig(3), 'feat(x): alpha\n\nOmni-Slice: s1\n');
    expect(code).toBe(0);
    const payload = JSON.parse(out) as BoardPayload & { inline: boolean };
    expect(payload.slices.map(({ id, state }) => ({ id, state }))).toEqual([
      { id: 's1', state: 'merged' },
      { id: 's2', state: 'runnable' },
    ]);
    expect(payload.inline).toBe(true);
    expect(logCalls(calls)).toEqual(['log origin/main..origin/feat/widgets --format=%B']);
  });

  it('prints the inline line in the table, and not when the plan has as many slices as wave.inlineBelow', async () => {
    expect((await boardWith(inlineConfig(3), '', [])).out).toMatch(/omni board — inline: fewer than 3 slices \(wave\.inlineBelow\)/);
    expect((await boardWith(inlineConfig(2), '', [])).out).not.toMatch(/inline/);
  });

  it('reads no commit and reports inline false with wave.inlineBelow at its default 0', async () => {
    const { out, calls } = await boardWith(CONFIG, 'feat(x): alpha\n\nOmni-Slice: s1\n');
    const payload = JSON.parse(out) as BoardPayload & { inline: boolean };
    expect(payload.slices.map((row) => row.state)).toEqual(['runnable', 'blocked']);
    expect(payload.inline).toBe(false);
    expect(logCalls(calls)).toEqual([]);
  });

  it('reads a feature branch the remote does not have as built by nothing', async () => {
    const { code, out } = await boardWith(inlineConfig(3), null);
    expect(code).toBe(0);
    expect((JSON.parse(out) as BoardPayload).slices.map((row) => row.state)).toEqual(['runnable', 'blocked']);
  });
});
