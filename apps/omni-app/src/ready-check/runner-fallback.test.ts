// The e2e fallback of the ready check (PRD 2898 s8), through the `pr-ready` job's real handler against the stubbed
// GitHub of the outbox check, as ./ready-check.test.ts runs it: CI kept the head commit's report as the
// `acceptance-report` artifact, its e2e criterion waiting on a runner, and wrote no `acceptance` run. The App queues
// the runner's job, writes the `acceptance` run in progress, then, once the job's log ends on its result, completes it.
// The store is a fake holding the runner jobs; no test calls GitHub or Supabase.
import { rmSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { CONFIG_FILE } from 'omni-loop/kit/lib/config.ts';
import { parsePr } from 'omni-loop/kit/lib/ids.ts';
import { READY_CHECK_NAME } from 'omni-loop/kit/lib/ready/checks.ts';
import { ACCEPTANCE_REPORT_FORMAT, parseAcceptanceReport, renderAcceptanceReport, type AcceptanceReport } from 'omni-loop/kit/lib/ready/report.ts';
import { acceptanceLine, readyRefreshOf } from 'omni-loop/kit/lib/runner/acceptance-line.ts';
import { makeRepo } from 'omni-loop/kit/test/fixture.ts';
import { prCheckJob } from '../jobs/pr-checks.ts';
import { claimedJob, fakeGitHub, outputOf } from '../outbox-check/fake-github.ts';
import { READY_KIND, readyHandler } from './job.ts';
import { ACCEPTANCE_EXTERNAL_ID } from './runner-fallback.ts';
import type { AppJob, AppLineOfInstallation, ReadyStore, SavedVerdict } from './store.ts';
import { zipOf } from './zip.fake.ts';

const BASE = 'b2'.repeat(20);
const HEAD = 'a1'.repeat(20);
const FOLDER = '.omni-loop/delivery/inbox/0007-ready';
const RUNS = 'GET /repos/{owner}/{repo}/commits/{ref}/check-runs';
const COMPARE = 'GET /repos/{owner}/{repo}/compare/{basehead}';
const ARTIFACTS = 'GET /repos/{owner}/{repo}/actions/artifacts';
const DOWNLOAD = 'GET /repos/{owner}/{repo}/actions/artifacts/{artifact_id}/{archive_format}';

const folders: string[] = [];
afterAll(() => {
  for (const folder of folders) rmSync(folder, { recursive: true, force: true });
});

type Files = Record<string, string>;

/** The gate on for every feature PR, the e2e scenarios not run in CI (`e2e.ci` false), on a fixed address. */
const CONFIG = (url: string | null) => `kit: 1\nrepo:\n  slug: acme/widgets\nready:\n  checks: all\n  full: [test, lint]\ne2e:\n  ci: false\n  url: ${url ?? 'null'}\n`;

const SPEC = [
  '# Ready',
  '',
  '## Acceptance criteria',
  '',
  '### AC-1 · test',
  '',
  '```gherkin',
  'Scenario: A total adds up',
  '  Given a quote of two lines',
  '  When it is totalled',
  '  Then the total is their sum',
  '```',
  '',
  '### AC-2 · e2e',
  '',
  '```gherkin',
  'Scenario: The total shows',
  '  Given a quote of two lines',
  '  When a member opens it',
  '  Then its total shows',
  '```',
  '',
].join('\n');

const PLAN = ['| id | slice | territory | blocked by | wave |', '| --- | --- | --- | --- | --- |', '| s1 | the total | `src/` | — | 1 |', ''].join('\n');

const files = (url: string | null = 'https://preview.example.test'): Files => ({
  [CONFIG_FILE]: CONFIG(url),
  [`${FOLDER}/spec.md`]: SPEC,
  [`${FOLDER}/plan.md`]: PLAN,
  'src/total.ts': 'export const total = (a: number, b: number) => a + b;\n',
});

function folderOf(all: Files): string {
  const { root } = makeRepo({ files: all });
  folders.push(root);
  return root;
}

/** What CI kept: AC-1 proven by its test, AC-2 waiting on a runner, in CI's own words. */
const KEPT: AcceptanceReport = {
  format: ACCEPTANCE_REPORT_FORMAT,
  commit: HEAD,
  results: [
    { ac: 1, kind: 'test', state: 'passed', title: 'AC-1: A total adds up', proof: 'src/total.test.ts' },
    { ac: 2, kind: 'e2e', state: 'pending', title: 'AC-2: The total shows', proof: null, why: 'no runner has run the e2e scenarios yet' },
  ],
};

type CiRun = { name: string; status: string; conclusion: string | null; html_url: string };
const run = (name: string): CiRun => ({ name, status: 'completed', conclusion: 'success', html_url: `https://github.com/acme/widgets/runs/${name}` });
const CI: CiRun[] = [run('test'), run('lint'), run('acceptance report')];

/** The stubbed GitHub: the commits as folders, CI's runs beside the App's own, the compare, and the kept artifact. */
function setUp({ url = 'https://preview.example.test', kept = [KEPT] }: { url?: string | null; kept?: AcceptanceReport[] } = {}) {
  const github = fakeGitHub({ commits: { [BASE]: folderOf(files(url)), [HEAD]: folderOf({ ...files(url), 'src/total.ts': 'export const total = (a: number, b: number) => b + a;\n' }) }, pull: { number: parsePr(31), base: { ref: 'main', sha: BASE }, head: { ref: 'feat/ready', sha: HEAD }, labels: [] } });
  const world = { kept };
  const request = async (route: string, params: Record<string, unknown> = {}) => {
    if (route === RUNS && params.check_name === undefined) {
      github.state.requests.push({ route, ...params });
      const own = github.state.checkRuns.filter((one) => one.head_sha === params.ref);
      return { data: { check_runs: params.page === 1 ? [...CI, ...own] : [] } };
    }
    if (route === COMPARE) return { data: { merge_base_commit: { sha: BASE }, files: params.page === 1 ? [{ filename: 'src/total.ts', status: 'modified' }] : [] } };
    if (route === ARTIFACTS) {
      github.state.requests.push({ route, ...params });
      return { data: { artifacts: world.kept.map((report, i) => ({ id: 100 + i, name: params.name, expired: false, workflow_run: { head_sha: report.commit } })) } };
    }
    if (route === DOWNLOAD) {
      github.state.requests.push({ route, ...params });
      const report = world.kept[Number(params.artifact_id) - 100];
      return { data: new Uint8Array(zipOf({ 'report.json': report === undefined ? '' : renderAcceptanceReport(report) })).buffer };
    }
    return github.octokit.request(route, params);
  };
  return { github, world, octokit: { request } };
}

type Setup = ReturnType<typeof setUp>;

/** A store holding the runner jobs the App queued, keyed by line; `runners` false, and the queue finds no runner's home. */
function fakeStore({ runners = true } = {}) {
  const jobs = new Map<string, AppJob>();
  const queued: AppLineOfInstallation[] = [];
  const saved: SavedVerdict[] = [];
  const store: ReadyStore = {
    inMission: () => Promise.resolve(true),
    save: (verdict) => Promise.resolve({ saved: saved.push(verdict) > 0, reason: null }),
    appJob: ({ line }) => Promise.resolve(jobs.get(line) ?? null),
    queueApp: (input) => {
      queued.push(input);
      if (!runners) return Promise.resolve({ job: null, created: false, reason: 'the workspace removed acme/widgets' });
      jobs.set(input.line, { status: 'queued', logTail: '', reason: null });
      return Promise.resolve({ job: 'job-1', created: true, reason: null });
    },
  };
  return { store, jobs, queued, saved };
}

const PAYLOAD = { installationId: 7, owner: 'acme', repo: 'widgets', repository: 'acme/widgets', prNumber: 31, headSha: HEAD };
const LINE = acceptanceLine({ prd: 7, pr: 31, sha: HEAD });

const runJob = ({ octokit }: Setup, store: ReadyStore | null) => readyHandler({ octokitFor: () => octokit, store, log: () => undefined })(claimedJob(READY_KIND, PAYLOAD));

const named = ({ github }: Setup, name: string) => github.state.checkRuns.filter((one) => one.name === name);
const only = <T>(list: readonly T[]): T => {
  expect(list).toHaveLength(1);
  return list[0] as T;
};
const textOf = (one: { output: unknown }) => String((one.output as { text?: unknown }).text);
const check3 = (world: Setup) => outputOf(only(named(world, READY_CHECK_NAME))).summary.split('\n').find((line) => line.startsWith('3. ')) ?? '';

/** The log tail of a runner's acceptance job that proved AC-2 `state`. */
const provedTail = (state: 'passed' | 'failed') =>
  `$ pnpm exec e2e run --tag prd-7 --pass-with-no-tests\nomni-acceptance: ${JSON.stringify({ format: ACCEPTANCE_REPORT_FORMAT, commit: HEAD, results: [{ ac: 2, kind: 'e2e', state, title: 'AC-2: The total shows', proof: 'e2e/tests/total.e2e.ts' }] })}\n`;

describe('the e2e fallback — a runner runs the scenario, the App writes the acceptance run (PRD 2898 s8)', () => {
  it('AC-10: e2e falls back to a runner', async () => {
    // Given e2e.ci is false and the PRD has an e2e criterion
    const world = setUp();
    const { store, jobs, queued, saved } = fakeStore();
    // When its pull request gets a new commit
    expect(await runJob(world, store)).toEqual({ outcome: 'done' });
    expect(queued).toEqual([{ installationId: 7, repository: 'acme/widgets', line: LINE }]);
    const going = only(named(world, 'acceptance'));
    expect(going).toMatchObject({ head_sha: HEAD, status: 'in_progress', conclusion: null });
    expect(world.github.state.requests.find((one) => one.route === 'POST /repos/{owner}/{repo}/check-runs' && one.name === 'acceptance')).toMatchObject({ external_id: ACCEPTANCE_EXTERNAL_ID });
    expect(saved.at(-1)).toMatchObject({ state: 'not finished' });

    // Then a runner job runs the scenario against the preview and the App writes the acceptance check run
    jobs.set(LINE, { status: 'done', logTail: provedTail('passed'), reason: null });
    expect(await runJob(world, store)).toEqual({ outcome: 'done' });
    const written = only(named(world, 'acceptance'));
    expect(written).toMatchObject({ id: going.id, status: 'completed', conclusion: 'success' });
    const report = parseAcceptanceReport(textOf(written));
    expect(report.ok && report.report.results.map(({ ac, kind, state }) => [ac, kind, state])).toEqual([[1, 'test', 'passed'], [2, 'e2e', 'passed']]);
    expect(outputOf(written).title).toBe('2 of 2 criteria proven');
    expect(outputOf(only(named(world, READY_CHECK_NAME))).title).toBe('Ready for review · 5 of 5');
    expect(saved.at(-1)).toMatchObject({ state: 'ready', passed: 5 });
    expect(queued).toHaveLength(1);
  });

  it('with no runner, check 3 reads not finished, no runner has run the e2e scenarios yet, and the verdict stays not ready', async () => {
    for (const store of [fakeStore({ runners: false }).store, null]) {
      const world = setUp();
      await runJob(world, store);
      expect(only(named(world, 'acceptance'))).toMatchObject({ status: 'in_progress' });
      expect(check3(world)).toContain('· not finished — AC-2: no runner has run the e2e scenarios yet');
      expect(outputOf(only(named(world, READY_CHECK_NAME))).title).toMatch(/^Not finished · /);
      expect(only(named(world, READY_CHECK_NAME))).toMatchObject({ status: 'in_progress' });
    }
  });

  it('queues no job without e2e.url, keeping CI\'s words, and queues one job for the commit however often it runs', async () => {
    const noUrl = setUp({ url: null });
    const none = fakeStore();
    await runJob(noUrl, none.store);
    expect(none.queued).toEqual([]);
    expect(check3(noUrl)).toContain('no runner has run the e2e scenarios yet');

    const world = setUp();
    const once = fakeStore();
    await runJob(world, once.store);
    await runJob(world, once.store);
    expect(once.queued).toHaveLength(1);
    expect(named(world, 'acceptance')).toHaveLength(1);
    const acceptanceId = only(named(world, 'acceptance')).id;
    const writes = world.github.state.requests.filter((one) => (one.route === 'POST /repos/{owner}/{repo}/check-runs' && one.name === 'acceptance') || one.check_run_id === acceptanceId);
    expect(writes).toHaveLength(1);
  });

  it('fails the acceptance run, and check 3, when the runner\'s scenario failed', async () => {
    const world = setUp();
    const { store, jobs } = fakeStore();
    jobs.set(LINE, { status: 'done', logTail: provedTail('failed'), reason: null });
    await runJob(world, store);
    expect(only(named(world, 'acceptance'))).toMatchObject({ status: 'completed', conclusion: 'failure' });
    expect(check3(world)).toContain('· fail — ');
    expect(check3(world)).toContain('AC-2 failed');
  });

  it('keeps the criterion waiting, saying how, when the runner\'s run ended with no result', async () => {
    const world = setUp();
    const { store, jobs } = fakeStore();
    jobs.set(LINE, { status: 'failed', logTail: '$ git fetch\nomni-acceptance: failed — no preview of a1a1a1a succeeded within 15 minutes\n', reason: 'exit 1' });
    await runJob(world, store);
    expect(only(named(world, 'acceptance'))).toMatchObject({ status: 'in_progress' });
    expect(check3(world)).toContain("AC-2: the runner's e2e run gave no result (no preview of a1a1a1a succeeded within 15 minutes); a new commit runs it again");
  });

  it('does nothing once an acceptance run of the commit is completed, nor before CI kept a report, nor for a spec with no e2e criterion', async () => {
    const written = setUp();
    written.github.state.checkRuns.push({ id: 900, name: 'acceptance', head_sha: HEAD, status: 'completed', conclusion: 'success', output: { title: 't', summary: 's', text: renderAcceptanceReport(KEPT) } });
    const one = fakeStore();
    await runJob(written, one.store);
    expect(one.queued).toEqual([]);
    expect(written.github.state.requests.map((request) => request.route)).not.toContain(ARTIFACTS);

    const early = setUp({ kept: [] });
    const two = fakeStore();
    await runJob(early, two.store);
    expect([two.queued, named(early, 'acceptance')]).toEqual([[], []]);
  });

  it('is woken by the Omni page on the job the App keys: the kit\'s refresh of the line is the App\'s own pr-ready job', () => {
    const refresh = readyRefreshOf({ installationId: 7, repo: 'acme/widgets', line: LINE });
    const own = prCheckJob(READY_KIND, { ...PAYLOAD, prNumber: parsePr(31), trigger: 'runner.acceptance' }, 0);
    expect(refresh).toEqual({ ...own, delaySeconds: 0 });
  });
});
