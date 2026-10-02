import { readFileSync } from 'node:fs';
import { InngestTestEngine } from '@inngest/test';
import { describe, expect, it } from 'vitest';
import { parseConfig } from 'vertuo-omni-plan/kit/lib/config.ts';
import { inngest } from '../../inngest-client.ts';
import { FEATURE, JUDGE_ENV, OWNER, PLAN, REPO, SUB_PULLS, judge } from '../../../test/retro-scenario.ts';
import { listPullsInto } from '../github.ts';
import { LIMITS } from '../rules.ts';
import { ci } from './ci.ts';
import type { Finding, RetroPull } from './index.ts';
import { handles, replay, retroFunction, scenario } from './test-handles.ts';
import { cleanLog, tailOf } from './ci-logs.ts';

const { gather, detect, section } = handles(ci);

// The widget repository's three slices, as GitHub Actions ran them:
//   s1 (#13) — run 101 on aaa1111: unit red (Vitest) and e2e red (Playwright), both re-run: unit red
//              again, e2e green; run 102 on bbb2222: all green.
//   s2 (#14) — run 201 on ccc3333: unit red (Jest), lint red (a log in no known format), py red (pytest).
//   s3 (#15) — run 301 on eee5555: py red, its log gone (410).
// So `unit` is red on two commits in two slices, `py` too, `e2e` turns green on a re-run of one commit,
// and one Vitest test fails in both of unit's runs on aaa1111.

const RUNS = 'GET /repos/{owner}/{repo}/actions/runs';
const JOBS = 'GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs';
const LOGS = 'GET /repos/{owner}/{repo}/actions/jobs/{job_id}/logs';

const SHA = { a: 'aaa1111f00d', b: 'bbb2222f00d', c: 'ccc3333f00d', e: 'eee5555f00d' };
const fixture = (name: string) => readFileSync(new URL(`./ci.fixtures/${name}.log`, import.meta.url), 'utf8');
const VITEST_RERUN = [
  '2026-09-20T09:31:00.0000000Z  ❯ src/cart/cart.test.ts (3 tests | 1 failed) 9ms',
  '2026-09-20T09:31:00.0000001Z    × cart > adds an item 5ms',
  '2026-09-20T09:31:00.0000002Z  Test Files  1 failed | 1 passed (2)',
  '2026-09-20T09:31:00.0000003Z       Tests  1 failed | 6 passed (7)',
  '',
].join('\n');

const jobUrl = (run: number, id: number) => `https://github.com/${OWNER}/${REPO}/actions/runs/${run}/job/${id}`;
const run = (id: number, branch: string, sha: string, name = 'CI') => ({ id, name, head_branch: branch, head_sha: sha, run_attempt: 1, status: 'completed' });
const job = (id: number, runId: number, name: string, sha: string, conclusion: string, completedAt: string, attempt = 1, workflow = 'CI') => ({
  id,
  run_id: runId,
  workflow_name: workflow,
  name,
  head_sha: sha,
  run_attempt: attempt,
  status: 'completed',
  conclusion,
  html_url: jobUrl(runId, id),
  started_at: completedAt,
  completed_at: completedAt,
});
const at = (h: number, m: number) => `2026-09-20T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`;

const record = (route: string, params: Record<string, unknown>, data: unknown, status?: number) => ({ route, params: { owner: OWNER, repo: REPO, ...params }, data, status });
const runsOf = (branch: string, runs: object[], status?: number) =>
  record(RUNS, { branch, exclude_pull_requests: true, per_page: 100, page: 1 }, { total_count: runs.length, workflow_runs: runs }, status);
const jobsOf = (runId: number, jobs: object[]) => record(JOBS, { run_id: runId, filter: 'all', per_page: 100, page: 1 }, { total_count: jobs.length, jobs });
const logOf = (jobId: number, text: string | null, status?: number) => record(LOGS, { job_id: jobId }, text, status);

function recording({ s3Runs = runsOf('feat/widget--s3', [run(301, 'feat/widget--s3', SHA.e, 'Python')]) } = {}) {
  return [
    runsOf('feat/widget--s1', [run(101, 'feat/widget--s1', SHA.a), run(102, 'feat/widget--s1', SHA.b)]),
    runsOf('feat/widget--s2', [run(201, 'feat/widget--s2', SHA.c)]),
    s3Runs,
    jobsOf(101, [
      job(1011, 101, 'unit', SHA.a, 'failure', at(9, 20)),
      job(1012, 101, 'e2e', SHA.a, 'failure', at(9, 21)),
      job(1013, 101, 'lint', SHA.a, 'success', at(9, 19)),
      job(1015, 101, 'unit', SHA.a, 'failure', at(9, 31), 2),
      job(1016, 101, 'e2e', SHA.a, 'success', at(9, 32), 2),
    ]),
    jobsOf(102, [
      job(1021, 102, 'unit', SHA.b, 'success', at(9, 36)),
      job(1022, 102, 'e2e', SHA.b, 'success', at(9, 37)),
      job(1023, 102, 'lint', SHA.b, 'success', at(9, 35)),
    ]),
    jobsOf(201, [
      job(2011, 201, 'unit', SHA.c, 'failure', at(10, 2)),
      job(2012, 201, 'e2e', SHA.c, 'success', at(10, 3)),
      job(2013, 201, 'lint', SHA.c, 'failure', at(9, 50)),
      job(2014, 201, 'py', SHA.c, 'failure', at(11, 5)),
      job(2015, 201, 'docs', SHA.c, 'skipped', at(10, 0)),
    ]),
    jobsOf(301, [job(3011, 301, 'py', SHA.e, 'failure', at(11, 20), 1, 'Python')]),
    logOf(1011, fixture('vitest')),
    logOf(1012, fixture('playwright')),
    logOf(1015, VITEST_RERUN),
    logOf(2011, fixture('jest')),
    logOf(2013, fixture('unknown')),
    logOf(2014, fixture('pytest')),
    logOf(3011, null, 410),
  ];
}

const config = parseConfig('kit: 1\n');
const pr = { number: 12, url: FEATURE.html_url, headRef: 'feat/widget' };
const prd = { number: 7, topic: 'widget', plan: PLAN };

async function gathered(options?: Parameters<typeof recording>[0]) {
  const github = replay({ pulls: [FEATURE, ...SUB_PULLS], recording: recording(options) });
  const pulls: RetroPull[] = await listPullsInto(github.octokit, { owner: OWNER, repo: REPO, base: 'feat/widget' });
  const scope = { owner: OWNER, repo: REPO, pr, prd, config, pulls };
  const records = await gather(github.octokit, scope);
  return { github, records, context: { pr, prd, config, pulls } };
}

describe('ci — gather', () => {
  it('reads the Actions runs of every slice branch and all their jobs, every attempt included', async () => {
    const { github, records } = await gathered();
    const branches = github.state.requests.filter((r) => r.route === RUNS).map((r) => r.branch);
    expect(branches).toEqual(['feat/widget--s1', 'feat/widget--s2', 'feat/widget--s3']);
    expect(github.state.requests.filter((r) => r.route === JOBS).map((r) => [r.run_id, r.filter])).toEqual([
      [101, 'all'],
      [102, 'all'],
      [201, 'all'],
      [301, 'all'],
    ]);
    expect(records.slices).toEqual(['s1', 's2', 's3']);
    expect(records.unread).toEqual([]);
    expect(records.jobs.find((j) => j.id === 1015)).toEqual({
      id: 1015,
      run: 101,
      workflow: 'CI',
      check: 'unit',
      slice: 's1',
      sha: SHA.a,
      attempt: 2,
      status: 'completed',
      conclusion: 'failure',
      url: jobUrl(101, 1015),
      completedAt: at(9, 31),
    });
    expect(records.jobs).toHaveLength(14);
  });

  it('fetches only the failed jobs’ logs, and keeps only their last lines, cleaned', async () => {
    const { github, records } = await gathered();
    const fetched = github.state.requests.filter((r) => r.route === LOGS).map((r) => r.job_id);
    expect(fetched).toEqual([1011, 1012, 1015, 2011, 2013, 2014, 3011]);
    expect(Object.keys(records.logs).map(Number)).toEqual(fetched);
    expect(records.logs[2013]).toEqual({ tail: cleanLog(fixture('unknown')).trimEnd() });
    expect(records.logs[3011]).toEqual({ tail: null, status: 410 });
  });

  it(`cuts a long log to its last ${LIMITS.logTailLines} lines`, async () => {
    const long = Array.from({ length: 500 }, (_, index) => `2026-09-20T09:20:00.0000000Z line ${index + 1}`).join('\n');
    const github = replay({
      pulls: [FEATURE, SUB_PULLS[0]!],
      recording: [
        runsOf('feat/widget--s1', [run(101, 'feat/widget--s1', SHA.a)]),
        jobsOf(101, [job(1011, 101, 'unit', SHA.a, 'failure', at(9, 20))]),
        logOf(1011, `${long}\n`),
      ],
    });
    const pulls = await listPullsInto(github.octokit, { owner: OWNER, repo: REPO, base: 'feat/widget' });
    const records = await gather(github.octokit, { owner: OWNER, repo: REPO, pr, prd, config, pulls });
    const lines = records.logs[1011]!.tail!.split('\n');
    expect(lines).toHaveLength(LIMITS.logTailLines);
    expect(lines[0]).toBe(`line ${500 - LIMITS.logTailLines + 1}`);
    expect(lines.at(-1)).toBe('line 500');
    expect(records.logs[1011]!.tail).toBe(tailOf(cleanLog(long), LIMITS.logTailLines));
  });

  it('keeps going when GitHub refuses a slice’s runs, and says which', async () => {
    const { records } = await gathered({ s3Runs: runsOf('feat/widget--s3', [], 403) });
    expect(records.slices).toEqual(['s1', 's2']);
    expect(records.unread).toEqual([{ slice: 's3', status: 403 }]);
    expect(records.jobs.some((j) => j.slice === 's3')).toBe(false);
  });

  it('reads a slice whose runs GitHub does not know as a slice with no run', async () => {
    const { records } = await gathered({ s3Runs: runsOf('feat/widget--s3', [], 404) });
    expect(records.slices).toEqual(['s1', 's2', 's3']);
    expect(records.unread).toEqual([]);
  });

  it('lets any other GitHub failure fail the step, so Inngest retries it', async () => {
    await expect(gathered({ s3Runs: runsOf('feat/widget--s3', [], 502) })).rejects.toThrow('recorded 502');
  });

  it('gathers nothing when no pull request into the feature branch is a slice', async () => {
    const github = replay({ pulls: [FEATURE] });
    const pulls = [{ number: 17, url: 'u17', headRef: 'fix/settle-widget', openedAt: at(10, 30), closedAt: null, mergedAt: null, labels: [] }];
    expect(await gather(github.octokit, { owner: OWNER, repo: REPO, pr, prd, config, pulls })).toBeNull();
    expect(await gather(github.octokit, { owner: OWNER, repo: REPO, pr, prd, config, pulls: [] })).toBeNull();
    expect(github.state.requests).toEqual([]);
  });
});

describe('ci — detect', () => {
  it('counts, per check, its runs, its red runs, the commits and slices it was red in, and red then green on one commit', async () => {
    const { records, context } = await gathered();
    const { facts } = detect(records, context);
    expect(facts.slices).toEqual(['s1', 's2', 's3']);
    expect(facts.totals).toEqual({ runs: 13, red: 7, checks: 4, commits: 4, slices: 3 });
    expect(facts.checks).toEqual([
      { check: 'e2e', runs: 4, red: 1, redCommits: ['aaa1111'], redSlices: ['s1'], redThenGreen: [{ commit: 'aaa1111', slice: 's1' }] },
      { check: 'lint', runs: 3, red: 1, redCommits: ['ccc3333'], redSlices: ['s2'], redThenGreen: [] },
      { check: 'py', runs: 2, red: 2, redCommits: ['ccc3333', 'eee5555'], redSlices: ['s2', 's3'], redThenGreen: [] },
      { check: 'unit', runs: 4, red: 3, redCommits: ['aaa1111', 'ccc3333'], redSlices: ['s1', 's2'], redThenGreen: [] },
    ]);
  });

  it('names the failing tests of each red run from its log, with the reporter and its counts', async () => {
    const { records, context } = await gathered();
    const { facts } = detect(records, context);
    const brief = facts.redRuns.map(({ id, check, slice, commit, attempt, reporter, tests, counts, log }) => ({
      id, check, slice, commit, attempt, reporter, tests: tests.length, counts, log,
    }));
    expect(brief).toEqual([
      { id: 1011, check: 'unit', slice: 's1', commit: 'aaa1111', attempt: 1, reporter: 'vitest', tests: 2, counts: { failed: 2, passed: 5, total: 7 }, log: 'read' },
      { id: 1012, check: 'e2e', slice: 's1', commit: 'aaa1111', attempt: 1, reporter: 'playwright', tests: 1, counts: { failed: 1, flaky: 1, skipped: 1, passed: 3 }, log: 'read' },
      { id: 1015, check: 'unit', slice: 's1', commit: 'aaa1111', attempt: 2, reporter: 'vitest', tests: 1, counts: { failed: 1, passed: 6, total: 7 }, log: 'read' },
      { id: 2013, check: 'lint', slice: 's2', commit: 'ccc3333', attempt: 1, reporter: null, tests: 0, counts: null, log: 'read' },
      { id: 2011, check: 'unit', slice: 's2', commit: 'ccc3333', attempt: 1, reporter: 'jest', tests: 3, counts: { failed: 2, passed: 6, total: 8 }, log: 'read' },
      { id: 2014, check: 'py', slice: 's2', commit: 'ccc3333', attempt: 1, reporter: 'pytest', tests: 2, counts: { failed: 2, passed: 10, skipped: 1 }, log: 'read' },
      { id: 3011, check: 'py', slice: 's3', commit: 'eee5555', attempt: 1, reporter: null, tests: 0, counts: null, log: 'not read (410)' },
    ]);
    expect(facts.redRuns[0]!.url).toBe(jobUrl(101, 1011));
  });

  it('keeps a log in no known format as an excerpt with no count, and no excerpt for the others', async () => {
    const { records, context } = await gathered();
    const { facts } = detect(records, context);
    const lint = facts.redRuns.find((redRun) => redRun.id === 2013)!;
    expect(lint.excerpt).toBe(records.logs[2013]!.tail);
    expect(lint.excerpt).toContain('test colour::reads_it_back ... FAILED');
    expect(facts.redRuns.filter((redRun) => 'excerpt' in redRun).map((redRun) => redRun.id)).toEqual([2013]);
  });

  it('counts each failing test by the red runs that name it, most runs first', async () => {
    const { records, context } = await gathered();
    const { facts } = detect(records, context);
    expect(facts.tests[0]).toEqual({ test: 'src/cart/cart.test.ts > cart > adds an item', runs: 2, checks: ['unit'], slices: ['s1'] });
    expect(facts.tests.slice(1).every((test) => test.runs === 1)).toBe(true);
    expect(facts.tests.map((test) => test.test)).toContain('tests/test_cart.py::TestCheckout::test_pays[card]');
  });

  it('finds a check red on two commits or in two slices, a check red then green on one commit, and a test failing in two runs', async () => {
    const { records, context } = await gathered();
    const { findings } = detect(records, context);
    expect(findings.map((finding) => [finding.id, finding.kind])).toEqual([
      ['repeated-red:unit', 'repeated-red'],
      ['repeated-red:py', 'repeated-red'],
      ['flaky:e2e', 'flaky'],
      ['failing-test:src/cart/cart.test.ts > cart > adds an item', 'failing-test'],
    ]);
  });

  it('says what happened with the counts, and links every red run as evidence, its last lines kept for the model', async () => {
    const { records, context } = await gathered();
    const [unit, py, e2e, test] = detect(records, context).findings as [Finding, Finding, Finding, Finding];
    expect(unit.title).toBe('Check unit was red again and again');
    expect(unit.happened).toBe(
      'The check `unit` was red on 2 commits in 2 slices (s1, s2): 3 of its 4 runs were red. The rules flag a check red on 2 or more commits, or in 2 or more slices.',
    );
    expect(unit.evidence.map(({ label, url }) => [label, url])).toEqual([
      ['unit on aaa1111 in s1', jobUrl(101, 1011)],
      ['unit on aaa1111 in s1, attempt 2', jobUrl(101, 1015)],
      ['unit on ccc3333 in s2', jobUrl(201, 2011)],
    ]);
    expect(unit.evidence[0]!.excerpt).toBe(records.logs[1011]!.tail);

    expect(py.evidence.map((item) => [item.label, 'excerpt' in item])).toEqual([
      ['py on ccc3333 in s2', true],
      ['py on eee5555 in s3', false],
    ]);

    expect(e2e.title).toBe('Check e2e turned green on a re-run of the same commit');
    expect(e2e.happened).toBe(
      'The check `e2e` was red, then green on the same commit with no change to the code, on 1 commit: `aaa1111` in s1.',
    );
    expect(e2e.evidence.map(({ label, url }) => [label, url])).toEqual([
      ['e2e red on aaa1111 in s1', jobUrl(101, 1012)],
      ['e2e green on aaa1111 in s1, attempt 2', jobUrl(101, 1016)],
    ]);
    expect(e2e.evidence[0]!.excerpt).toBe(records.logs[1012]!.tail);
    expect('excerpt' in e2e.evidence[1]!).toBe(false);

    expect(test.title).toBe('Test “adds an item” failed in several runs');
    expect(test.happened).toBe(
      'The test `src/cart/cart.test.ts > cart > adds an item` failed in 2 red runs, of the check `unit`, in s1. The rules flag a test failing in 2 or more runs.',
    );
    expect(test.evidence.map(({ label }) => label)).toEqual(['unit on aaa1111 in s1', 'unit on aaa1111 in s1, attempt 2']);
  });

  it('finds nothing below the thresholds', async () => {
    const { records, context } = await gathered();
    const oneRed = { ...records, jobs: records.jobs.filter((j) => ![1015, 2011, 2014, 3011, 1016].includes(j.id)) };
    expect(detect(oneRed, context).findings).toEqual([]);
  });

  it('ignores jobs still running, and counts a cancelled or skipped job as no run', async () => {
    const { records, context } = await gathered();
    const extra = [
      { ...records.jobs[0], id: 9001, status: 'in_progress', conclusion: null },
      { ...records.jobs[0], id: 9002, conclusion: 'cancelled' },
    ];
    const { facts } = detect({ ...records, jobs: [...records.jobs, ...extra] }, context);
    expect(facts.totals.runs).toBe(13);
  });

  it('has no facts without records', () => {
    expect(detect(null, {})).toEqual({ facts: null, findings: [] });
  });
});

describe('ci — its section', () => {
  it('describes the totals, one row per check, the failing tests and one row per red run', async () => {
    const { records, context } = await gathered();
    const lines = section(detect(records, context).facts);
    expect(lines[0]).toBe('- 13 runs of 4 checks on 4 commits in 3 slices, read from GitHub Actions: 7 red.');
    expect(lines).toContain('| check | runs | red | commits red | slices red | red then green |');
    expect(lines).toContain('| unit | 4 | 3 | 2 | s1, s2 | 0 |');
    expect(lines).toContain('| e2e | 4 | 1 | 1 | s1 | 1 |');
    expect(lines).toContain('| `src/cart/cart.test.ts > cart > adds an item` | 2 | unit | s1 |');
    expect(lines).toContain('| `tests/test_cart.py::TestCheckout::test_pays[card]` | 1 | py | s2 |');
    expect(lines).toContain(`| [unit](${jobUrl(101, 1011)}) | s1 | \`aaa1111\` | Vitest: 2 failed, 5 passed, 7 total |`);
    expect(lines).toContain(`| [unit, attempt 2](${jobUrl(101, 1015)}) | s1 | \`aaa1111\` | Vitest: 1 failed, 6 passed, 7 total |`);
    expect(lines).toContain(`| [e2e](${jobUrl(101, 1012)}) | s1 | \`aaa1111\` | Playwright: 1 failed, 1 flaky, 3 passed, 1 skipped |`);
    expect(lines).toContain(`| [lint](${jobUrl(201, 2013)}) | s2 | \`ccc3333\` | no test named: its last lines are kept as an excerpt |`);
    expect(lines).toContain(`| [py](${jobUrl(301, 3011)}) | s3 | \`eee5555\` | not read (410) |`);
  });

  it('writes no number its facts do not hold', async () => {
    const { records, context } = await gathered();
    const { facts } = detect(records, context);
    const held = new Set(JSON.stringify(facts).match(/\d+/g));
    const written = section(facts).join('\n').match(/\d+/g) ?? [];
    expect(written.filter((n) => !held.has(n))).toEqual([]);
  });

  it('says which slices’ runs GitHub refused, and why', async () => {
    const { records, context } = await gathered({ s3Runs: runsOf('feat/widget--s3', [], 403) });
    const lines = section(detect(records, context).facts);
    expect(lines).toContain('- Not read: the runs of s3 (GitHub answered 403). The app reads them with the `actions: read` permission.');
  });

  it('says only that when no run could be read', () => {
    const facts = detect({ slices: [], unread: [{ slice: 's1', status: 403 }], jobs: [], logs: {} }, {}).facts;
    expect(section(facts)).toEqual([
      '- Not read: the runs of s1 (GitHub answered 403). The app reads them with the `actions: read` permission.',
    ]);
  });

  it('is left out when no check ran on any slice', () => {
    const facts = detect({ slices: ['s1'], unread: [], jobs: [], logs: {} }, {}).facts;
    expect(section(facts)).toBeNull();
    expect(section(null)).toBeNull();
  });
});

describe('ci — through the retro function', () => {
  const FOLDER = '.omni-loop/delivery/shipped/0007-widget';
  const BRANCH = 'docs/retro-widget';

  async function retroOf() {
    const widget = scenario({ recording: recording() });
    const fn = retroFunction({ client: inngest, octokitFor: () => widget.github.octokit, env: JUDGE_ENV, fetch: judge() });
    const { error } = await new InngestTestEngine({ function: fn, events: [widget.event] }).execute();
    const files = widget.github.filesAt(BRANCH, [`${FOLDER}/retro.md`, `${FOLDER}/retro.json`]);
    return { error, github: widget.github, markdown: files[`${FOLDER}/retro.md`]!, json: files[`${FOLDER}/retro.json`]! };
  }

  it('writes the Checks section and its findings into retro.md, and keeps its facts in retro.json', async () => {
    const { error, markdown, json } = await retroOf();
    expect(error).toBeUndefined();
    expect(markdown).toContain('\n## Checks\n\n- 13 runs of 4 checks on 4 commits in 3 slices, read from GitHub Actions: 7 red.\n');
    expect(markdown).toContain('— `repeated-red:unit`');
    expect(markdown).toContain('— `flaky:e2e`');
    expect(markdown).toContain('— `failing-test:src/cart/cart.test.ts > cart > adds an item`');
    expect(markdown).toMatch(/Findings: F\d · Check unit was red again and again(?: · \[#\d+\]\([^)]+\))?; /);
    const doc = JSON.parse(json);
    expect(doc.runs[0].kinds.ci.totals).toEqual({ runs: 13, red: 7, checks: 4, commits: 4, slices: 3 });
  });

  it('keeps the logs’ last lines out of retro.md: they are evidence for the model, in retro.json', async () => {
    const { markdown, json } = await retroOf();
    expect(markdown).not.toContain('test colour::reads_it_back ... FAILED');
    expect(json).toContain('test colour::reads_it_back ... FAILED');
  });

  it('writes no number in retro.md that retro.json does not hold', async () => {
    const { markdown, json } = await retroOf();
    const held = new Set(json.match(/\d+/g));
    expect((markdown.match(/\d+/g) ?? []).filter((n: string) => !held.has(n))).toEqual([]);
  });

  it('never reads a check run: only Actions runs, their jobs and their logs', async () => {
    const { github } = await retroOf();
    expect(github.state.requests.filter((r) => r.route.includes('check-runs'))).toEqual([]);
    expect(github.state.requests.filter((r) => r.route.includes('/actions/')).length).toBeGreaterThan(0);
  });
});
