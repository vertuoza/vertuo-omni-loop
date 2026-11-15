// The acceptance report CI writes on a feature PR's head commit (PRD 2898, s5), on fixture
// repositories: `git` is the real one, `gh` a stub that records what it was asked, so no test calls
// GitHub. The report it writes is read back with the ready rule's own reader.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../kit/test/fixture.ts';
import { PrdNumberSchema } from '../kit/lib/ids.ts';
import { parseCriteria } from '../kit/lib/ready/criteria.ts';
import { parseAcceptanceReport } from '../kit/lib/ready/report.ts';
import { buildReport, main, planE2e, prdOfBranch, verdictOf, type Exec, type Io, type ReportInput } from './acceptance-report.ts';

const HEAD = 'c'.repeat(40);

const scenario = (n: number, kind: 'test' | 'e2e', name: string) =>
  [`### AC-${String(n)} · ${kind}`, '', '```gherkin', `Scenario: ${name}`, '  Given a thing', '  When it moves', '  Then it shows', '```', ''].join('\n');

const SPEC = ['---', 'prd: 2898', '---', '', '## Acceptance criteria', '', scenario(1, 'test', 'Five passing checks'), scenario(2, 'e2e', 'The page shows it')].join('\n');

/** A config of this repository's shape: the PRD folders, the feature branch, the e2e block. */
const config = (e2e: Record<string, unknown> = {}) =>
  ['kit: 1', 'repo:', '  slug: acme/widgets', 'e2e:', ...Object.entries({ ci: true, url: 'github-deployment', ...e2e }).map(([key, value]) => `  ${key}: ${JSON.stringify(value)}`), ''].join('\n');

function fixture({ e2e = {}, spec = SPEC }: { e2e?: Record<string, unknown>; spec?: string } = {}) {
  return makeRepo({
    git: true,
    files: {
      '.omni-loop/config.yml': config(e2e),
      '.omni-loop/delivery/inbox/2898-ready-five-checks/spec.md': spec,
      '.omni-loop/delivery/shipped/2001-old-thing/spec.md': SPEC,
    },
  });
}

/** Commits `files` on the feature branch, so the diff against main holds them. */
function onFeatureBranch(root: string, files: Readonly<Record<string, string>>) {
  const git = (...args: string[]) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd: root, stdio: 'ignore' });
  git('switch', '-q', '-c', 'feat/ready-five-checks');
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  git('add', '-A');
  git('commit', '-q', '-m', 'feature');
}

type Fake = { io: Io; lines: string[]; gh: string[][]; bodies: unknown[]; output: string; summary: string; slept: number[] };

/** An io whose `git` is real and whose `gh` answers from `answer`, recording each call and each body sent. */
function fakeIo(root: string, answer: (args: readonly string[]) => string = () => '{}'): Fake {
  const fake: Fake = { lines: [], gh: [], bodies: [], output: join(root, 'output.txt'), summary: join(root, 'summary.md'), slept: [], io: undefined as unknown as Io };
  let clock = 0;
  const exec: Exec = (file, args) => {
    if (file === 'git') return execFileSync('git', [...args], { cwd: root, encoding: 'utf8' });
    fake.gh.push([...args]);
    const input = args.indexOf('--input');
    if (input >= 0) fake.bodies.push(JSON.parse(readFileSync(args[input + 1] ?? '', 'utf8')));
    return answer(args);
  };
  fake.io = {
    exec,
    say: (line) => fake.lines.push(line),
    output: fake.output,
    summary: fake.summary,
    sleep: (seconds) => {
      fake.slept.push(seconds);
      clock += seconds * 1000;
      return Promise.resolve();
    },
    now: () => clock,
  };
  return fake;
}

const vitestReport = (root: string, file: string, tests: Record<string, string>) => ({
  testResults: [{ name: join(root, file), assertionResults: Object.entries(tests).map(([title, status]) => ({ title, status })) }],
});

const e2eRun = (results: { title: string; status: string; tags?: string[]; file?: string }[]) => ({
  schemaVersion: 'report-1',
  run: { results: results.map(({ title, status, tags = ['prd-2898'], file = 'tests/ready.e2e.ts' }) => ({ titlePath: ['ready panel', title], status, tags, file })) },
});

describe('the PRD of a branch', () => {
  it('is the PRD whose folder holds the feature branch’s topic, in the inbox or shipped', () => {
    const { root } = fixture();
    const loaded = { branches: { feature: 'feat/{topic}' }, paths: { delivery: '.omni-loop/delivery', adr: 'a', knowledge: 'k', playbook: 'p' } } as Parameters<typeof prdOfBranch>[1];
    expect(prdOfBranch(root, loaded, 'feat/ready-five-checks')).toEqual({ prd: 2898, spec: '.omni-loop/delivery/inbox/2898-ready-five-checks/spec.md' });
    expect(prdOfBranch(root, loaded, 'feat/old-thing')).toEqual({ prd: 2001, spec: '.omni-loop/delivery/shipped/2001-old-thing/spec.md' });
  });

  it('is none for a slice branch, a fix branch or a topic no folder holds', () => {
    const { root } = fixture();
    const loaded = { branches: { feature: 'feat/{topic}' }, paths: { delivery: '.omni-loop/delivery', adr: 'a', knowledge: 'k', playbook: 'p' } } as Parameters<typeof prdOfBranch>[1];
    for (const branch of ['feat/ready-five-checks--s5', 'fix/2900-law-judge', 'feat/', 'feat/nothing-here']) expect(prdOfBranch(root, loaded, branch), branch).toBeNull();
  });
});

describe('the e2e plan', () => {
  const criteria = parseCriteria(SPEC).criteria;
  const testOnly = parseCriteria(scenario(1, 'test', 'x')).criteria;
  const of = (e2e: { ci?: boolean; url?: string | null }) => ({ e2e: { ci: true, url: 'github-deployment', ...e2e } }) as Parameters<typeof planE2e>[0];

  it('runs the scenarios only for a PRD with an e2e criterion, e2e.ci on, an e2e.url and a model key', () => {
    expect(planE2e(of({}), criteria, true)).toBe('ran');
  });

  it('says why it runs nothing, the first reason first', () => {
    expect(planE2e(of({}), null, true)).toBe('no-prd');
    expect(planE2e(of({}), testOnly, true)).toBe('no-criterion');
    expect(planE2e(of({ ci: false }), criteria, true)).toBe('not-ci');
    expect(planE2e(of({ url: null }), criteria, true)).toBe('no-url');
    expect(planE2e(of({}), criteria, false)).toBe('no-key');
  });

  it('writes its state and the PRD to the step’s outputs', async () => {
    const repo = fixture();
    const fake = fakeIo(repo.root);
    expect(await main(['e2e-plan', '--branch', 'feat/ready-five-checks', '--key-set', 'false'], repo.root, fake.io)).toBe(0);
    expect(readFileSync(fake.output, 'utf8')).toBe('state=no-key\nprd=2898\n');
    const other = fakeIo(repo.root);
    other.io.output = join(repo.root, 'other.txt');
    expect(await main(['e2e-plan', '--branch', 'fix/1-x', '--key-set', 'true'], repo.root, other.io)).toBe(0);
    expect(readFileSync(join(repo.root, 'other.txt'), 'utf8')).toBe('state=no-prd\nprd=\n');
  });
});

describe('the report of the head commit', () => {
  const parsed = parseCriteria(SPEC);
  const input = (over: Partial<ReportInput>): ReportInput => ({
    root: '/repo',
    dir: 'e2e',
    prd: PrdNumberSchema.parse(2898),
    head: HEAD,
    criteria: parsed.criteria,
    vitest: [],
    changed: new Set(['kit/bin/ready.test.ts']),
    e2eState: 'ran',
    e2eReport: null,
    ...over,
  });

  it('proves a test criterion by a passing AC-<n> test of a changed file, and an e2e one by the run tagged prd-<n>', () => {
    const report = buildReport(
      input({
        vitest: [vitestReport('/repo', 'kit/bin/ready.test.ts', { 'AC-1: Five passing checks let the Reviewer mark it ready': 'passed', 'reads the plan': 'passed' })],
        e2eReport: e2eRun([{ title: 'AC-2: The page shows it', status: 'passed' }]) as ReportInput['e2eReport'],
      }),
    );
    expect(report.results).toEqual([
      { ac: 1, kind: 'test', state: 'passed', title: 'AC-1: Five passing checks let the Reviewer mark it ready', proof: 'kit/bin/ready.test.ts' },
      { ac: 2, kind: 'e2e', state: 'passed', title: 'AC-2: The page shows it', proof: 'e2e/tests/ready.e2e.ts' },
    ]);
    expect(verdictOf(parsed, report)).toMatchObject({ post: true, conclusion: 'success', title: '2 of 2 criteria proven' });
    // The format the ready rule reads: the report round-trips through its own reader.
    expect(parseAcceptanceReport(JSON.stringify(report))).toEqual({ ok: true, report });
  });

  it('never takes an AC-<n> test from a file the pull request did not change: an older PRD’s AC-1 proves nothing here', () => {
    const report = buildReport(input({ vitest: [vitestReport('/repo', 'kit/lib/old.test.ts', { 'AC-1: an older criterion': 'passed' })] }));
    expect(report.results.filter((result) => result.kind === 'test')).toEqual([]);
    const verdict = verdictOf(parsed, report);
    expect(verdict).toMatchObject({ post: true, conclusion: 'failure', title: '0 of 2 criteria proven' });
    expect(verdict.summary).toContain('| AC-1 | test | ✗ no proof on this commit | — |');
  });

  it('matches a shard’s test file by its ending when the shard ran in another checkout', () => {
    const report = buildReport(input({ vitest: [vitestReport('/home/runner/work/x/x', 'kit/bin/ready.test.ts', { 'AC-1: x': 'passed' })] }));
    expect(report.results).toEqual([{ ac: 1, kind: 'test', state: 'passed', title: 'AC-1: x', proof: 'kit/bin/ready.test.ts' }]);
  });

  it('fails a criterion whose test failed or was skipped, and leaves out an e2e test of another PRD', () => {
    const report = buildReport(
      input({
        vitest: [vitestReport('/repo', 'kit/bin/ready.test.ts', { 'AC-1: Five passing checks': 'failed' })],
        e2eReport: e2eRun([
          { title: 'AC-2: The page shows it', status: 'skipped' },
          { title: 'AC-2: Another PRD’s page', status: 'passed', tags: ['prd-12'] },
        ]) as ReportInput['e2eReport'],
      }),
    );
    expect(report.results.map((result) => `${String(result.ac)} ${result.kind} ${result.state}`)).toEqual(['1 test failed', '2 e2e skipped']);
    const verdict = verdictOf(parsed, report);
    expect(verdict.conclusion).toBe('failure');
    expect(verdict.summary).toContain('| AC-1 | test | ✗ failed | kit/bin/ready.test.ts |');
    expect(verdict.summary).toContain('| AC-2 | e2e | ✗ skipped | e2e/tests/ready.e2e.ts |');
  });

  it.each([
    ['not-ci', 'no runner has run the e2e scenarios yet'],
    ['no-key', 'no model key is set for CI, and no runner has run the e2e scenarios yet'],
    ['no-url', 'e2e.url is not set, and no runner has run the e2e scenarios yet'],
  ] as const)('leaves each e2e criterion pending when the scenarios wait on a runner (%s), and posts nothing', (state, why) => {
    const report = buildReport(input({ e2eState: state, vitest: [vitestReport('/repo', 'kit/bin/ready.test.ts', { 'AC-1: x': 'passed' })] }));
    expect(report.results[1]).toEqual({ ac: 2, kind: 'e2e', state: 'pending', title: 'AC-2: The page shows it', proof: null, why });
    expect(verdictOf(parsed, report)).toMatchObject({ post: false, title: '1 of 2 criteria proven; the e2e scenarios wait on a runner' });
  });

  it('reports no e2e result when the e2e job ended before its plan said anything: the criterion has no proof', () => {
    const report = buildReport(input({ e2eState: null }));
    expect(report.results).toEqual([]);
    expect(verdictOf(parsed, report)).toMatchObject({ post: true, conclusion: 'failure' });
  });

  it('is neutral for a spec of plain bullets, and fails a spec whose criteria are written wrong', () => {
    const plain = parseCriteria('## Acceptance criteria\n\n- it works\n');
    expect(verdictOf(plain, buildReport(input({ criteria: [] })))).toMatchObject({ post: true, conclusion: 'neutral' });
    const wrong = parseCriteria(`${scenario(1, 'test', 'x')}\n### AC-2\n`);
    const verdict = verdictOf(wrong, buildReport(input({ criteria: wrong.criteria, vitest: [vitestReport('/repo', 'kit/bin/ready.test.ts', { 'AC-1: x': 'passed' })] })));
    expect(verdict.conclusion).toBe('failure');
    expect(verdict.summary).toContain('- AC-2 has no kind');
  });
});

describe('post', () => {
  const args = (over: Record<string, string> = {}) =>
    Object.entries({ repo: 'acme/widgets', branch: 'feat/ready-five-checks', head: 'HEAD', base: 'main', vitest: 'vitest', 'e2e-state': 'ran', 'e2e-report': 'e2e/.e2e/report.json', out: '.acceptance/report.json', ...over }).flatMap(([key, value]) => [`--${key}`, value]);

  function prepared(e2e: Record<string, unknown> = {}) {
    const repo = fixture({ e2e });
    onFeatureBranch(repo.root, { 'kit/bin/ready.test.ts': "it('AC-1: x', () => {});\n" });
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo.root, encoding: 'utf8' }).trim();
    repo.write('vitest/vitest-1.json', JSON.stringify(vitestReport(repo.root, 'kit/bin/ready.test.ts', { 'AC-1: Five passing checks': 'passed' })));
    return { ...repo, head };
  }

  it('writes the check run acceptance on the head commit, its text the report, its summary one line per criterion', async () => {
    const repo = prepared();
    repo.write('e2e/.e2e/report.json', JSON.stringify(e2eRun([{ title: 'AC-2: The page shows it', status: 'passed' }])));
    const fake = fakeIo(repo.root);
    expect(await main(['post', ...args({ head: repo.head, 'details-url': 'https://github.com/acme/widgets/actions/runs/7' })], repo.root, fake.io)).toBe(0);
    expect(fake.gh).toHaveLength(1);
    expect(fake.gh[0]?.slice(0, 4)).toEqual(['api', '-X', 'POST', 'repos/acme/widgets/check-runs']);
    const body = fake.bodies[0] as { name: string; head_sha: string; status: string; conclusion: string; details_url: string; output: { title: string; summary: string; text: string } };
    expect(body).toMatchObject({ name: 'acceptance', head_sha: repo.head, status: 'completed', conclusion: 'success', details_url: 'https://github.com/acme/widgets/actions/runs/7' });
    expect(body.output.title).toBe('2 of 2 criteria proven');
    expect(body.output.summary).toContain('| AC-2 | e2e | ✓ proven | e2e/tests/ready.e2e.ts |');
    const read = parseAcceptanceReport(body.output.text);
    expect(read.ok && read.report.commit).toBe(repo.head);
    expect(repo.read('.acceptance/report.json')).toBe(body.output.text);
    expect(readFileSync(fake.summary, 'utf8')).toContain('## Acceptance of PRD 2898: 2 of 2 criteria proven');
  });

  it('keeps the report and posts nothing while the e2e scenarios wait on a runner: the App writes the check run', async () => {
    const repo = prepared({ ci: false });
    const fake = fakeIo(repo.root);
    expect(await main(['post', ...args({ head: repo.head, 'e2e-state': 'not-ci' })], repo.root, fake.io)).toBe(0);
    expect(fake.gh).toEqual([]);
    const read = parseAcceptanceReport(repo.read('.acceptance/report.json'));
    expect(read.ok && read.report.results.map((result) => result.state)).toEqual(['passed', 'pending']);
    expect(fake.lines.at(-1)).toBe('acceptance-report: PRD 2898: 1 of 2 criteria proven; the e2e scenarios wait on a runner, kept for the App to write');
  });

  it('writes no report for a pull request that is no PRD’s feature PR', async () => {
    const repo = prepared();
    const fake = fakeIo(repo.root);
    expect(await main(['post', ...args({ head: repo.head, branch: 'fix/2900-law-judge' })], repo.root, fake.io)).toBe(0);
    expect(fake.gh).toEqual([]);
    expect(existsSync(join(repo.root, '.acceptance/report.json'))).toBe(false);
  });

  it('refuses a missing option with its name and the usage, exit 2', async () => {
    const repo = prepared();
    const fake = fakeIo(repo.root);
    expect(await main(['post', '--repo', 'acme/widgets'], repo.root, fake.io)).toBe(2);
    expect(fake.lines[0]).toMatch(/^acceptance-report: --head is required/);
    expect(await main(['nothing'], repo.root, fake.io)).toBe(2);
  });
});

describe('preview', () => {
  const deployments = (environment = 'Preview – galaxy') => JSON.stringify([{ id: 9, environment }]);

  it('hands over a fixed e2e.url as it is', async () => {
    const repo = fixture({ e2e: { url: 'https://demo.example.test' } });
    const fake = fakeIo(repo.root);
    expect(await main(['preview', '--repo', 'acme/widgets', '--head', HEAD], repo.root, fake.io)).toBe(0);
    expect(readFileSync(fake.output, 'utf8')).toBe('url=https://demo.example.test\n');
    expect(fake.gh).toEqual([]);
  });

  it('waits for the preview of the head commit, then hands over its address', async () => {
    const repo = fixture({ e2e: { deployment: 'Preview – galaxy' } });
    let asked = 0;
    const fake = fakeIo(repo.root, (args) => {
      const path = args[1] ?? '';
      if (path.endsWith('/statuses?per_page=100')) return JSON.stringify([{ state: 'success', environment_url: 'https://x-galaxy.vercel.app' }]);
      asked += 1;
      return asked === 1 ? '[]' : `[${JSON.stringify({ id: 3, environment: 'Preview – omni-app' })},${deployments().slice(1)}`;
    });
    expect(await main(['preview', '--repo', 'acme/widgets', '--head', HEAD], repo.root, fake.io)).toBe(0);
    expect(fake.slept).toEqual([20]);
    expect(fake.gh[0]).toEqual(['api', `repos/acme/widgets/deployments?sha=${HEAD}&per_page=100`]);
    expect(fake.gh.at(-1)).toEqual(['api', 'repos/acme/widgets/deployments/9/statuses?per_page=100']);
    expect(readFileSync(fake.output, 'utf8')).toBe('url=https://x-galaxy.vercel.app\n');
  });

  it('fails when the preview failed, and when none succeeded within 15 minutes', async () => {
    const repo = fixture();
    const failed = fakeIo(repo.root, (args) => ((args[1] ?? '').includes('/statuses') ? JSON.stringify([{ state: 'failure' }]) : deployments()));
    expect(await main(['preview', '--repo', 'acme/widgets', '--head', HEAD], repo.root, failed.io)).toBe(1);
    expect(failed.lines.at(-1)).toBe('::error::acceptance-report: the deployment Preview – galaxy of ccccccc ended failure');
    const never = fakeIo(repo.root, () => '[]');
    expect(await main(['preview', '--repo', 'acme/widgets', '--head', HEAD], repo.root, never.io)).toBe(1);
    expect(never.slept).toHaveLength(45);
    expect(never.lines.at(-1)).toBe('::error::acceptance-report: no preview of ccccccc succeeded within 15 minutes');
  });
});
