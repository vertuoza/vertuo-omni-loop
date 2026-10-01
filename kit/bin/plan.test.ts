// @ts-nocheck
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../test/fixture.ts';
import { main } from './omni.ts';

function io() {
  const out = [];
  const err = [];
  return { out, err, stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) } };
}

const CONFIG = { '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: acme/widgets\n' };

function planMd(rows) {
  return [
    '# A plan',
    '',
    '| id | slice | territory | blocked by | wave |',
    '| --- | --- | --- | --- | --- |',
    ...rows,
    '',
  ].join('\n');
}

describe('omni plan check', () => {
  it('passes a plan whose slices share no ground in any one wave', async () => {
    const plan = planMd([
      '| s1 | Alpha | `a/` | — | 1 |',
      '| s2 | Beta | `b/` | s1 | 2 |',
    ]);
    const { root } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0007-x/plan.md': plan } });
    const s = io();
    const code = await main(['plan', 'check', '7'], { cwd: root, ...s });
    expect(code).toBe(0);
    expect(s.out.join('')).toMatch(/2 slice\(s\) across wave\(s\) 1, 2/);
    expect(s.out.join('')).toMatch(/all territories and blocks well-formed/);
  });

  it('flags two slices in the same wave sharing territory', async () => {
    const plan = planMd([
      '| s1 | Alpha | `shared/` | — | 1 |',
      '| s2 | Beta | `shared/` | — | 1 |',
    ]);
    const { root } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0007-x/plan.md': plan } });
    const s = io();
    const code = await main(['plan', 'check', '7'], { cwd: root, ...s });
    expect(code).toBe(1);
    expect(s.out.join('')).toMatch(/s1 and s2 share.*wave 1/);
  });

  it('does not flag two slices sharing territory across different waves', async () => {
    const plan = planMd([
      '| s1 | Alpha | `shared/` | — | 1 |',
      '| s2 | Beta | `shared/` | s1 | 2 |',
    ]);
    const { root } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0007-x/plan.md': plan } });
    const s = io();
    const code = await main(['plan', 'check', '7'], { cwd: root, ...s });
    expect(code).toBe(0);
    expect(s.out.join('')).toMatch(/collision matrix \(1 pair/);
  });

  it('flags a "blocked by" id that names no slice in the plan', async () => {
    const plan = planMd(['| s1 | Alpha | `a/` | s9 | 1 |']);
    const { root } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0007-x/plan.md': plan } });
    const s = io();
    const code = await main(['plan', 'check', '7'], { cwd: root, ...s });
    expect(code).toBe(1);
    expect(s.out.join('')).toMatch(/s1 is blocked by "s9", which names no slice/);
  });

  it('flags a slice blocked by one in its own wave', async () => {
    const plan = planMd([
      '| s1 | Alpha | `a/` | s2 | 1 |',
      '| s2 | Beta | `b/` | — | 1 |',
    ]);
    const { root } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0007-x/plan.md': plan } });
    const s = io();
    const code = await main(['plan', 'check', '7'], { cwd: root, ...s });
    expect(code).toBe(1);
    expect(s.out.join('')).toMatch(/s1 \(wave 1\) is blocked by s2 \(wave 1\)/);
  });

  it('flags a slice blocked by one in a later wave', async () => {
    const plan = planMd([
      '| s1 | Alpha | `a/` | s2 | 1 |',
      '| s2 | Beta | `b/` | — | 2 |',
    ]);
    const { root } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0007-x/plan.md': plan } });
    const s = io();
    const code = await main(['plan', 'check', '7'], { cwd: root, ...s });
    expect(code).toBe(1);
    expect(s.out.join('')).toMatch(/s1 \(wave 1\) is blocked by s2 \(wave 2\)/);
  });

  it('flags an id used by more than one slice row', async () => {
    const plan = planMd([
      '| s1 | Alpha | `a/` | — | 1 |',
      '| s1 | Beta | `b/` | — | 2 |',
    ]);
    const { root } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0007-x/plan.md': plan } });
    const s = io();
    const code = await main(['plan', 'check', '7'], { cwd: root, ...s });
    expect(code).toBe(1);
    expect(s.out.join('')).toMatch(/id "s1" is used by more than one slice row/);
  });

  it('passes on this repository\'s own PRD 7 plan', async () => {
    const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
    const s = io();
    // No `CLAUDE_CODE_SESSION_ID` from the session running the tests: it would record PRD 7 for that
    // session in this repository's own `.omni-loop/local/`.
    const code = await main(['plan', 'check', '7'], { cwd: repoRoot, ...s, env: {} });
    expect(s.out.join('')).not.toMatch(/violation/);
    expect(code).toBe(0);
  });
});

// PRD 549: a plan repository's plan names a repository per slice.
const SHA_BACK = '3f2a9c1e0b7d4c5a8e6f1d2c3b4a5968778695a4';
const SHA_APPS = '9b01e44c2d7a3f5e8b6c1d0a9f8e7d6c5b4a3921';

function planRepoConfig(targets = [
  { repo: 'vertuoza/vertuo-backend-php', role: 'back-end', knowledge: 'own' },
  { repo: 'vertuoza/vertuo-apps', role: 'front-end', knowledge: 'own' },
]) {
  const lines = ['kit: 1', 'repo:', '  slug: vertuoza/vertuo-automation-plan', 'plan:', '  targets:'];
  for (const t of targets) lines.push(`    - repo: ${t.repo}`, `      role: ${t.role}`, `      knowledge: ${t.knowledge}`);
  return { '.omni-loop/config.yml': `${lines.join('\n')}\n` };
}

const REPOS_OK = [
  `| vertuo-backend-php | back-end | ${SHA_BACK} | own |`,
  `| vertuo-apps | front-end | ${SHA_APPS} | own |`,
];
const SLICES_OK = [
  '| s1 | vertuo-backend-php | the total is served | `src/` | — | 1 |',
  '| s2 | vertuo-apps | the screen shows it | `apps/quote/` | s1 | 2 |',
  '| s3 | vertuo-apps | the empty quote says why | `src/` | — | 1 |',
];

function multiPlan({ repos = REPOS_OK, slices = SLICES_OK, header = '| id | repo | slice | territory | blocked by | wave |' } = {}) {
  const lines = ['# A plan', ''];
  if (repos !== null) {
    lines.push('## Repositories', '', '| repo | role | read at | knowledge |', '| --- | --- | --- | --- |', ...repos, '');
  }
  lines.push('## Slices', '', header, `|${' --- |'.repeat(header.split('|').length - 2)}`, ...slices, '');
  return lines.join('\n');
}

async function check(config, plan) {
  const { root } = makeRepo({ git: true, files: { ...config, '.omni-loop/delivery/inbox/0007-x/plan.md': plan } });
  const s = io();
  const code = await main(['plan', 'check', '7'], { cwd: root, ...s });
  return { code, out: s.out.join(''), err: s.err.join('') };
}

describe('omni plan check — in a plan repository (PRD 549)', () => {
  it('passes a plan across repositories and prints each wave with its repositories', async () => {
    const { code, out } = await check(planRepoConfig(), multiPlan());
    expect(out).not.toMatch(/violation/);
    expect(code).toBe(0);
    expect(out).toMatch(/3 slices · 2 waves · 2 repositories/);
    expect(out).toMatch(/wave 1: s1 \(vertuo-backend-php\), s3 \(vertuo-apps\)/);
    expect(out).toMatch(/wave 2: s2 \(vertuo-apps\)/);
  });

  it('passes a slice that names the plan repository itself, its row read at —', async () => {
    const { code, out } = await check(
      planRepoConfig(),
      multiPlan({
        repos: [...REPOS_OK, '| vertuo-automation-plan | plan | — | own |'],
        slices: [...SLICES_OK, '| s4 | vertuo-automation-plan | the guide says so | `guide/` | — | 1 |'],
      }),
    );
    expect(out).not.toMatch(/violation/);
    expect(code).toBe(0);
    expect(out).toMatch(/4 slices · 2 waves · 3 repositories/);
  });

  it('prints the collision matrix per repository', async () => {
    const slices = [...SLICES_OK, '| s4 | vertuo-apps | more | `apps/` | s2 | 3 |'];
    const { code, out } = await check(planRepoConfig(), multiPlan({ slices }));
    expect(code).toBe(0);
    expect(out).toMatch(/collision matrix, vertuo-apps \(1 pair/);
    expect(out).toMatch(/s2 · s4/);
  });

  it('refuses the same territory twice in one repository and one wave', async () => {
    const slices = [...SLICES_OK, '| s4 | vertuo-apps | more | `src/lib/` | — | 1 |'];
    const { code, out } = await check(planRepoConfig(), multiPlan({ slices }));
    expect(code).toBe(1);
    expect(out).toMatch(/s3 and s4 share src\/.*wave 1/);
  });

  it('refuses a slice table without a repo column, field first', async () => {
    const { code, out } = await check(
      planRepoConfig(),
      multiPlan({ repos: null, header: '| id | slice | territory | blocked by | wave |', slices: ['| s1 | a | `a/` | — | 1 |'] }),
    );
    expect(code).toBe(1);
    expect(out).toMatch(/^ {2}repo: the slice table has no repo column/m);
  });

  it('refuses a repo that is neither a target nor the plan repository, field first', async () => {
    const slices = [...SLICES_OK, '| s4 | vertuo-nowhere | x | `x/` | — | 1 |'];
    const { code, out } = await check(planRepoConfig(), multiPlan({ slices }));
    expect(code).toBe(1);
    expect(out).toMatch(/^ {2}repo: s4 names "vertuo-nowhere"/m);
  });

  it('refuses a short name two entries share, field first', async () => {
    const { code, out } = await check(
      planRepoConfig([
        { repo: 'vertuoza/vertuo-backend-php', role: 'back-end', knowledge: 'own' },
        { repo: 'vertuoza/vertuo-apps', role: 'front-end', knowledge: 'own' },
        { repo: 'someone/vertuo-apps', role: 'mobile', knowledge: 'none' },
      ]),
      multiPlan(),
    );
    expect(code).toBe(1);
    expect(out).toMatch(/^ {2}repo: "vertuo-apps" is the short name of vertuoza\/vertuo-apps and someone\/vertuo-apps/m);
  });

  it('refuses a repository with slices and no ## Repositories row, field first', async () => {
    const { code, out } = await check(planRepoConfig(), multiPlan({ repos: [REPOS_OK[0]] }));
    expect(code).toBe(1);
    expect(out).toMatch(/^ {2}## Repositories: vertuo-apps holds slices and has no row/m);
  });

  it('refuses a row no slice names, field first', async () => {
    const slices = ['| s2 | vertuo-apps | the screen shows it | `apps/quote/` | — | 1 |'];
    const { code, out } = await check(planRepoConfig(), multiPlan({ slices }));
    expect(code).toBe(1);
    expect(out).toMatch(/^ {2}## Repositories: the row vertuo-backend-php names no slice's repository/m);
  });

  it("refuses a target row whose read at is not 40 hex characters, field first", async () => {
    const { code, out } = await check(planRepoConfig(), multiPlan({ repos: [REPOS_OK[0], '| vertuo-apps | front-end | 9b01e44 | own |'] }));
    expect(code).toBe(1);
    expect(out).toMatch(/^ {2}read at: vertuo-apps reads "9b01e44"/m);
  });

  it("refuses a plan-repository row whose read at is not —, field first", async () => {
    const { code, out } = await check(
      planRepoConfig(),
      multiPlan({
        repos: [...REPOS_OK, `| vertuo-automation-plan | plan | ${SHA_APPS} | own |`],
        slices: [...SLICES_OK, '| s4 | vertuo-automation-plan | the guide | `guide/` | — | 1 |'],
      }),
    );
    expect(code).toBe(1);
    expect(out).toMatch(/^ {2}read at: vertuo-automation-plan is the plan repository and reads "9b01/m);
  });

  it('passes a slice blocked by another repository\'s slice in an earlier wave, and refuses the reverse', async () => {
    expect((await check(planRepoConfig(), multiPlan())).code).toBe(0);
    const reverse = [
      '| s1 | vertuo-backend-php | the total is served | `src/` | s2 | 1 |',
      '| s2 | vertuo-apps | the screen shows it | `apps/quote/` | — | 2 |',
    ];
    const { code, out } = await check(planRepoConfig(), multiPlan({ slices: reverse }));
    expect(code).toBe(1);
    expect(out).toMatch(/s1 \(wave 1\) is blocked by s2 \(wave 2\)/);
  });
});

describe('omni plan check — outside a plan repository (PRD 549)', () => {
  it('refuses a repo column', async () => {
    const { code, out } = await check(CONFIG, multiPlan({ repos: null }));
    expect(code).toBe(1);
    expect(out).toMatch(/^ {2}repo: a repo column needs a plan repository/m);
  });

  it('refuses a ## Repositories table', async () => {
    const plan = multiPlan({ slices: ['| s1 | a | `a/` | — | 1 |'], header: '| id | slice | territory | blocked by | wave |' });
    const { code, out } = await check(CONFIG, plan);
    expect(code).toBe(1);
    expect(out).toMatch(/^ {2}## Repositories: a Repositories table needs a plan repository/m);
  });

  it('prints no repository summary for an ordinary plan', async () => {
    const { code, out } = await check(CONFIG, planMd(['| s1 | Alpha | `a/` | — | 1 |']));
    expect(code).toBe(0);
    expect(out).not.toMatch(/repositor/);
  });
});

describe('omni plan check — user-caused errors are one line, exit 2', () => {
  const oneLine = (s) => expect(s.err.join('')).toMatch(/^[^\n]+\n$/);

  it('an unknown plan subcommand', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const s = io();
    expect(await main(['plan', 'nope'], { cwd: root, ...s })).toBe(2);
    oneLine(s);
  });

  it('a missing prd argument', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const s = io();
    expect(await main(['plan', 'check'], { cwd: root, ...s })).toBe(2);
    oneLine(s);
  });

  it('a PRD with no inbox or shipped folder', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const s = io();
    const code = await main(['plan', 'check', '999'], { cwd: root, ...s });
    expect(code).toBe(2);
    oneLine(s);
    expect(s.err.join('')).toMatch(/PRD 999 has no inbox or shipped folder/);
  });

  it('a PRD folder with no plan.md', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0007-x/spec.md': 'x' } });
    const s = io();
    const code = await main(['plan', 'check', '7'], { cwd: root, ...s });
    expect(code).toBe(2);
    oneLine(s);
  });

  it('a plan whose slice table has no territory column', async () => {
    const plan = [
      '| id | slice | wave |',
      '| --- | --- | --- |',
      '| s1 | Alpha | 1 |',
      '',
    ].join('\n');
    const { root } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0007-x/plan.md': plan } });
    const s = io();
    const code = await main(['plan', 'check', '7'], { cwd: root, ...s });
    expect(code).toBe(2);
    oneLine(s);
  });
});

// PRD 563, s2: `omni plan moved <prd>` — what changed in each target under its slices' territories
// since the plan read it. `gh` is faked; no test calls GitHub.
describe('omni plan moved (PRD 563)', () => {
  const MOVED_SLICES = [
    '| s1 | vertuo-backend-php | the total is served | `src/Quote/` | — | 1 |',
    '| s2 | vertuo-apps | the screen shows it | `apps/quote/` | s1 | 2 |',
    '| s3 | vertuo-automation-plan | the guide says so | `guide/` | — | 1 |',
  ];
  const MOVED_REPOS = [...REPOS_OK, '| vertuo-automation-plan | plan | — | own |'];

  /** A fake `execFileSync` answering `gh api` from `world`: `{ slug: { compare } }`, a missing slug a 404. */
  function fakeGh(world) {
    const calls = [];
    const exec = (file, args, options) => {
      if (file === 'git') return execFileSync(file, args, options);
      if (file !== 'gh') throw new Error(`unexpected ${file}`);
      calls.push(args.join(' '));
      const endpoint = args[args.length - 1];
      const [, owner, name, kind, range] = endpoint.split('?')[0].split('/');
      const repo = world[`${owner}/${name}`];
      if (!repo) throw Object.assign(new Error('gh failed'), { stderr: 'gh: Not Found (HTTP 404)\n' });
      if (kind === undefined) return JSON.stringify({ default_branch: 'main' });
      if (kind === 'compare') {
        expect(decodeURIComponent(range)).toMatch(/^[0-9a-f]{40}\.\.\.main$/);
        if (repo.compare === null) throw Object.assign(new Error('gh failed'), { stderr: 'gh: No common ancestor (HTTP 404)\n' });
        return JSON.stringify(repo.compare);
      }
      throw new Error(`unexpected gh api ${endpoint}`);
    };
    return { exec, calls };
  }

  const unmoved = { compare: { ahead_by: 0, files: [] } };
  const movedElsewhere = { compare: { ahead_by: 4, files: [{ filename: 'README.md' }, { filename: 'src/Invoice/Pay.php' }] } };
  const movedInside = {
    compare: {
      ahead_by: 2,
      files: [
        { filename: 'src/Quote/Total.php' },
        { filename: 'docs/x.md' },
        { filename: 'src/Quote/Line.php', previous_filename: 'src/Old.php' },
      ],
    },
  };

  async function moved(args, { config = planRepoConfig(), plan = multiPlan({ repos: MOVED_REPOS, slices: MOVED_SLICES }), world }) {
    const { root } = makeRepo({ git: true, files: { ...config, '.omni-loop/delivery/inbox/0007-x/plan.md': plan } });
    const { exec, calls } = fakeGh(world);
    const s = io();
    const code = await main(['plan', 'moved', '7', ...args], { cwd: root, exec, env: {}, ...s });
    return { code, out: s.out.join(''), err: s.err.join(''), calls };
  }

  it('says ok for a head that has not moved, and never reads the plan repository itself', async () => {
    const { code, out, err, calls } = await moved([], {
      world: { 'vertuoza/vertuo-backend-php': unmoved, 'vertuoza/vertuo-apps': unmoved },
    });
    expect(err).toBe('');
    expect(code).toBe(0);
    expect(out).toMatch(/^vertuo-backend-php\s+ok$/m);
    expect(out).toMatch(/^vertuo-apps\s+ok$/m);
    expect(out).not.toMatch(/vertuo-automation-plan/);
    expect(calls.some((c) => c.includes('vertuo-automation-plan'))).toBe(false);
  });

  it('says ok for a head that moved without touching a territory path', async () => {
    const { code, out } = await moved([], {
      world: { 'vertuoza/vertuo-backend-php': movedElsewhere, 'vertuoza/vertuo-apps': unmoved },
    });
    expect(code).toBe(0);
    expect(out).toMatch(/^vertuo-backend-php\s+ok$/m);
  });

  it('says moved, naming the files under the territories, and still exits 0', async () => {
    const { code, out } = await moved([], {
      world: { 'vertuoza/vertuo-backend-php': movedInside, 'vertuoza/vertuo-apps': unmoved },
    });
    expect(code).toBe(0);
    expect(out).toMatch(
      /^vertuo-backend-php\s+moved\s+2 files under s1's territory \(src\/Quote\/Total\.php, src\/Quote\/Line\.php\)$/m,
    );
    expect(out).not.toMatch(/docs\/x\.md/);
    expect(out).toMatch(/^vertuo-apps\s+ok$/m);
  });

  it('says unreachable for a target gh cannot read, and still exits 0', async () => {
    const { code, out } = await moved([], { world: { 'vertuoza/vertuo-backend-php': unmoved } });
    expect(code).toBe(0);
    expect(out).toMatch(/^vertuo-apps\s+unreachable/m);
    expect(out).toMatch(/^vertuo-backend-php\s+ok$/m);
  });

  it('says unreachable, naming read at, for a target that no longer has the read at commit (item s2-01)', async () => {
    const { code, out } = await moved([], {
      world: { 'vertuoza/vertuo-backend-php': { compare: null }, 'vertuoza/vertuo-apps': unmoved },
    });
    expect(code).toBe(0);
    expect(out).toMatch(/^vertuo-backend-php\s+unreachable\s+read at 3f2a9c1 cannot be compared with main$/m);
  });

  it('prints [{ repo, state, files }] with --json', async () => {
    const { code, out } = await moved(['--json'], { world: { 'vertuoza/vertuo-backend-php': movedInside } });
    expect(code).toBe(0);
    expect(JSON.parse(out)).toEqual([
      { repo: 'vertuo-backend-php', state: 'moved', files: ['src/Quote/Total.php', 'src/Quote/Line.php'] },
      { repo: 'vertuo-apps', state: 'unreachable', files: [] },
    ]);
  });

  it('prints not a plan repository and exits 1 without a plan section', async () => {
    const { code, out, calls } = await moved([], {
      config: CONFIG,
      plan: planMd(['| s1 | Alpha | `a/` | — | 1 |']),
      world: {},
    });
    expect(code).toBe(1);
    expect(out).toBe('not a plan repository\n');
    expect(calls).toEqual([]);
  });

  it('refuses a missing prd argument in one line, exit 2', async () => {
    const { root } = makeRepo({ git: true, files: planRepoConfig() });
    const s = io();
    expect(await main(['plan', 'moved'], { cwd: root, ...s })).toBe(2);
    expect(s.err.join('')).toMatch(/^[^\n]+\n$/);
  });
});
