// The plan repository's old way, end to end, beside the product way (PRD 2011, s13): on one
// plan-repository fixture (its config has `plan.targets`), a roadmap is pushed and graded, `omni bug`
// checks a bug record's Fixes table, and an imported knowledge copy is read, all as before this PRD.
// No test calls GitHub or the Omni page: `gh` is stubbed and the page's `POST /api/roadmaps` is a fetch.
import { execFileSync } from 'node:child_process';
import type { ExecFileSyncOptions } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { main } from '../bin/omni.ts';
import { fakeLoopReads } from '../lib/loop-reads/fake.ts';
import { makeRepo, realExec } from './fixture.ts';
import type { FetchInit } from './fixture.ts';

const IN = '.omni-loop/delivery/inbox';
const K = '.omni-loop/knowledge';
const COPY = `${K}/repos/backend`;
const READ_AT = '3f2a9c1e0b7d4c5a8e6f1d2c3b4a5968778695a4';
const BASE_URL = 'https://omni.example';
const CONFIG = [
  'kit: 1',
  'repo:',
  '  slug: acme/plan',
  'ask:',
  `  url: ${BASE_URL}`,
  'plan:',
  '  guide: null',
  '  targets:',
  '    - repo: acme/backend',
  '      role: back-end',
  '      knowledge: imported',
  `      readAt: ${READ_AT}`,
  '    - repo: acme/frontend',
  '      role: front-end',
  '      knowledge: none',
  '',
].join('\n');

const spec = (prd: number, blockedBy: string) => ['---', `prd: ${prd}`, `title: PRD ${prd}`, `blocked-by: ${blockedBy}`, 'spec: file', '---', ''].join('\n');
const ROADMAP = [
  '---',
  'roadmap: 1200',
  'title: Crew',
  'milestone: M',
  '---',
  '',
  '## PRDs',
  '',
  '| id | PRD | title | repos | blocked by | why | wave |',
  '|---|---|---|---|---|---|---|',
  '| P1 | #1201 | Skeleton | backend | – | – | 1 |',
  '| P2 | #1202 | Worker | backend, frontend | P1 | it runs on the skeleton | 2 |',
  '',
].join('\n');

const principle = (id: string) => `## ${id}\n\nA decision.\n\nWhy: x\nDecided: y\nSource: PRD #1\n\n`;
const FILES = {
  '.omni-loop/config.yml': CONFIG,
  [`${IN}/1201-skeleton/spec.md`]: spec(1201, 'none'),
  [`${IN}/1202-worker/spec.md`]: spec(1202, '[1201]'),
  [`${IN}/roadmaps/1200-crew/roadmap.md`]: ROADMAP,
  [`${K}/product/principles.md`]: `# Principles\n\n${principle('P-PRODUCT-1')}`,
  [`${K}/product/rules.md`]: '# Rules\n',
  [`${K}/product/invariants.md`]: '# Invariants\n',
  [`${COPY}/README.md`]: `# acme/backend — imported\n\nRead at ${READ_AT}. A draft.\n`,
  [`${COPY}/product/principles.md`]: `# Principles\n\n${principle('P-PRODUCT-1')}`,
  [`${COPY}/product/rules.md`]: '# Rules\n',
  [`${COPY}/product/invariants.md`]: '# Invariants\n',
};

async function omni(root: string, argv: readonly string[], options: Record<string, unknown> = {}) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(argv, { cwd: root, stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => err.push(s) }, ...options });
  return { code, out: out.join(''), err: err.join('') };
}

/** An exec whose `gh` reads nothing and posts nothing: any `gh` call is an unexpected one. */
const exec = (file: string, args: readonly string[], options?: ExecFileSyncOptions) => {
  if (file === 'gh') throw new Error(`unexpected gh ${args.join(' ')}`);
  return realExec(file, args, options);
};

const fixture = () => makeRepo({ git: true, files: FILES });

describe('the plan repository, as before the product way', () => {
  it('grades a roadmap against plan.targets: repos named, a read-only or unknown target refused', async () => {
    const { root, write } = fixture();
    const green = await omni(root, ['roadmap', 'check']);
    expect(green.code).toBe(0);
    expect(green.out).toContain('wave 2: P2 #1202 (backend, frontend)');

    write(`${IN}/roadmaps/1200-crew/roadmap.md`, ROADMAP.replace('backend, frontend', 'backend, mobile'));
    const red = await omni(root, ['roadmap', 'check']);
    expect(red.code).toBe(1);
    expect(red.out).toContain('mobile is not a target of plan.targets');
  });

  it('pushes the roadmap with each row’s repositories from plan.targets', async () => {
    const { root } = fixture();
    const calls: unknown[] = [];
    const fetch = (_url: string, init: FetchInit) => {
      calls.push(typeof init.body === 'string' ? JSON.parse(init.body) : undefined);
      return Promise.resolve(new Response(JSON.stringify({ roadmapId: '00000000-0000-4000-8000-000000000042', created: true, product: null, unknownProduct: null, note: null }), { status: 201 }));
    };
    const tokens = { read: () => ({ access_token: 'a', refresh_token: 'r' }), write: () => undefined };
    const { code, err } = await omni(root, ['roadmap', 'push', '1200'], { exec, env: {}, tokens, fetch, reads: fakeLoopReads() });
    expect({ code, err }).toEqual({ code: 0, err: '' });
    expect(calls).toHaveLength(1);
    const [sent] = calls as { repo: string; prds: { id: string; repos: string[] }[] }[];
    expect(sent?.repo).toBe('acme/plan');
    expect(sent?.prds.map(({ id, repos }) => [id, repos])).toEqual([['P1', ['backend']], ['P2', ['backend', 'frontend']]]);
  });

  it('omni bug checks a bug record’s Fixes table against plan.targets', async () => {
    const { root, write } = fixture();
    const trailer = 'Co-authored-by: Omni-man <333776611+omni-loop-invader[bot]@users.noreply.github.com>';
    const base = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
    const record = (repository: string) => [
      '# Bug 12: saving twice duplicates the row',
      '',
      '## Triage',
      '',
      '- **Domain:** saving',
      '- **Risk:** high — every user who saves twice gets a duplicate row; no workaround',
      '- **Regression:** new bug — no evidence this ever worked',
      '',
      '## Reproduction',
      '',
      '- **backend:** `tests/TotalTest.php` — red: Failed asserting that null is 120',
      '',
      '## Fix',
      '',
      'The save handler now updates the row it finds.',
      '',
      '## Fixes',
      '',
      '| order | repository | pull request | what changes |',
      '| --- | --- | --- | --- |',
      `| 1 | ${repository} | acme/backend#41 | restore the total field |`,
      '',
      '## Guard',
      '',
      '- **backend:** none — the reproduction is the guard',
      '',
      '## Mutation',
      '',
      '- **backend:** Mutation: not run in a target',
      '',
    ].join('\n');
    const bugAt = (repository: string) => {
      write('.omni-loop/delivery/bugs/0012-double-save/bug.md', record(repository));
      execFileSync('git', ['add', '-A'], { cwd: root, stdio: 'ignore' });
      execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', `docs(delivery): the record of bug #12 across the targets (#12)\n\nCo-Authored-By: Claude <noreply@anthropic.com>\n${trailer}\n`], { cwd: root, stdio: 'ignore' });
      return omni(root, ['bug', '12', '--base', base]);
    };
    const ok = await bugAt('backend');
    expect({ code: ok.code, ok: /^ok$/m.test(ok.out)}).toEqual({ code: 0, ok: true});
    const red = await bugAt('mobile');
    expect(red.code).toBe(1);
    expect(red.out).toContain('Fixes row 1: mobile is not a repository of plan.targets.');
  });

  it('reads an imported knowledge copy: it is checked, listed under targets, and never mixed into the plan repository’s own registers', async () => {
    const { root } = fixture();
    const checked = await omni(root, ['check', 'kb']);
    expect(checked.out).not.toMatch(/does not exist/);
    expect(checked.out).toMatch(/1 imported copy checked/);
    expect(checked.code).toBe(0);

    const status = JSON.parse((await omni(root, ['kb', 'status', '--json'])).out) as { targets: { repo: string }[] };
    expect(status.targets.map(({ repo }) => repo)).toEqual(['acme/backend']);

    const gone = makeRepo({ git: true, files: Object.fromEntries(Object.entries(FILES).filter(([path]) => !path.startsWith(COPY))) });
    const missing = await omni(gone.root, ['check', 'kb']);
    expect(missing.code).toBe(1);
    expect(missing.out).toContain('plan.targets lists acme/backend as imported, so its copy lives here');
  });
});
