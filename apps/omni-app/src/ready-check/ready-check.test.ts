// The `omni / ready` check against the stubbed GitHub of the outbox check (PRD 2898 s7), as `budgets-check`
// is tested: each commit a folder on disk, the head's CI runs and the compare served beside it, the store a
// fake. The App posts the five states the kit's rule gives, each with its evidence, signed as its own, and
// saves the verdict; it posts nothing where the gate is off or the PRD is in no mission, posts nothing new
// when it would say the same, and says not judged once the job gave up. No test calls GitHub or Supabase.
import { rmSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { CONFIG_FILE } from 'omni-loop/kit/lib/config.ts';
import { parsePr } from 'omni-loop/kit/lib/ids.ts';
import { READY_CHECK_NAME } from 'omni-loop/kit/lib/ready/checks.ts';
import { ACCEPTANCE_REPORT_FORMAT, renderAcceptanceReport } from 'omni-loop/kit/lib/ready/report.ts';
import { makeRepo } from 'omni-loop/kit/test/fixture.ts';
import { claimedJob, fakeGitHub, outputOf } from '../outbox-check/fake-github.ts';
import { READY_KIND, readyFailureHook, readyHandler } from './job.ts';
import { NOT_MERGED, POSTED_BY, READY_EXTERNAL_ID } from './output.ts';
import type { ReadyStore, SavedVerdict } from './store.ts';

const BASE = 'b2'.repeat(20);
const HEAD = 'a1'.repeat(20);
const FOLDER = '.omni-loop/delivery/inbox/0007-ready';
const RUNS = 'GET /repos/{owner}/{repo}/commits/{ref}/check-runs';
const COMPARE = 'GET /repos/{owner}/{repo}/compare/{basehead}';

const folders: string[] = [];
afterAll(() => {
  for (const folder of folders) rmSync(folder, { recursive: true, force: true });
});

type Files = Record<string, string>;

const config = (checks: 'off' | 'mission' | 'all') => `kit: 1\nrepo:\n  slug: acme/widgets\nready:\n  checks: ${checks}\n  full: [test, lint]\n`;

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
].join('\n');

const PLAN = ['| id | slice | territory | blocked by | wave |', '| --- | --- | --- | --- | --- |', '| s1 | the total | `src/` | — | 1 |', ''].join('\n');

const TEST = "import { it, expect } from 'vitest';\nit('AC-1: A total adds up', () => {\n  expect(1 + 1).toBe(2);\n});\n";

/** The base's files: the gate as `checks` says, PRD 7's spec and plan, the code and its test. */
const baseFiles = (checks: 'off' | 'mission' | 'all' = 'all'): Files => ({
  [CONFIG_FILE]: config(checks),
  [`${FOLDER}/spec.md`]: SPEC,
  [`${FOLDER}/plan.md`]: PLAN,
  'src/total.ts': 'export const total = (a: number, b: number) => a + b;\n',
  'src/total.test.ts': TEST,
});

/** A commit's folder. */
function folderOf(files: Files): string {
  const { root } = makeRepo({ files });
  folders.push(root);
  return root;
}

/** The report the test job writes for the head: AC-1 passed. */
const REPORT = renderAcceptanceReport({ format: ACCEPTANCE_REPORT_FORMAT, commit: HEAD, results: [{ ac: 1, kind: 'test', state: 'passed', title: 'AC-1: A total adds up', proof: 'src/total.test.ts' }] });

type CiRun = { name: string; status: string; conclusion: string | null; html_url: string; output?: { title: string; summary: string; text: string } };
const run = (name: string, conclusion: string | null = 'success', status = 'completed'): CiRun => ({ name, status, conclusion, html_url: `https://github.com/acme/widgets/runs/${name}` });
const GREEN: CiRun[] = [run('test'), run('lint'), { ...run('acceptance'), output: { title: 'AC 1 of 1', summary: 'AC-1 passed', text: REPORT } }];

/** The changed files the compare lists. */
type Change = { filename: string; status: string; previous_filename?: string };
const CHANGES: Change[] = [{ filename: 'src/total.ts', status: 'modified' }];

/**
 * The stubbed GitHub: the base and the head as folders, the head's CI runs listed beside the App's own, and the
 * compare with its merge base. `ci` and `changes` are read at each request, so a test may move them.
 */
function setUp({ base = baseFiles(), head = { ...baseFiles(), 'src/total.ts': 'export const total = (a: number, b: number) => b + a;\n' }, ci = GREEN, changes = CHANGES }: { base?: Files; head?: Files; ci?: CiRun[]; changes?: Change[] } = {}) {
  const github = fakeGitHub({ commits: { [BASE]: folderOf(base), [HEAD]: folderOf(head) }, pull: { number: parsePr(31), base: { ref: 'main', sha: BASE }, head: { ref: 'feat/ready', sha: HEAD }, labels: [] } });
  const world = { ci, changes };
  const request = async (route: string, params: Record<string, unknown> = {}) => {
    if (route === RUNS && params.check_name === undefined) {
      github.state.requests.push({ route, ...params });
      const own = github.state.checkRuns.filter((one) => one.head_sha === params.ref);
      return { data: { check_runs: params.page === 1 ? [...world.ci, ...own] : [] } };
    }
    if (route === COMPARE) {
      github.state.requests.push({ route, ...params });
      return { data: { merge_base_commit: { sha: BASE }, files: params.page === 1 ? world.changes : [] } };
    }
    return github.octokit.request(route, params);
  };
  return { github, world, octokit: { request } };
}

type Setup = ReturnType<typeof setUp>;

/** A store that answers whether the PRD is in a mission, and keeps what it saved. */
function fakeStore(inMission = true) {
  const saved: SavedVerdict[] = [];
  const asked: unknown[] = [];
  const store: ReadyStore = {
    inMission: (input) => Promise.resolve(asked.push(input) > 0 && inMission),
    save: (verdict) => Promise.resolve({ saved: saved.push(verdict) > 0, reason: null }),
  };
  return { store, saved, asked };
}

const PAYLOAD = { installationId: 7, owner: 'acme', repo: 'widgets', repository: 'acme/widgets', prNumber: 31, headSha: HEAD };

/** One run of the `pr-ready` job through its real handler. */
async function runJob({ octokit }: Setup, store: ReadyStore | null) {
  return readyHandler({ octokitFor: () => octokit, store, log: () => undefined })(claimedJob(READY_KIND, PAYLOAD));
}

/** The App's `omni / ready` runs on the head. */
const readyRuns = ({ github }: Setup) => github.state.checkRuns.filter((one) => one.name === READY_CHECK_NAME);

/** The five check lines of a summary, each from its number to its state. */
const stateLines = (summary: string) => summary.split('\n').filter((line) => /^[1-5]\. /.test(line));

describe('omni / ready — the App runs the kit\'s ready rule on a gated feature PR\'s latest commit (PRD 2898 s7)', () => {
  it('AC-8: The App posts the same verdict', async () => {
    // Given a gated feature PR with a new commit
    const world = setUp();
    const { store, saved } = fakeStore();
    // When the App runs its check
    expect(await runJob(world, store)).toEqual({ outcome: 'done' });
    // Then omni / ready shows the same five states omni ready prints, each with a link, and the verdict is saved for the PRD page
    const [posted, ...more] = readyRuns(world);
    expect(more).toEqual([]);
    expect(posted).toMatchObject({ head_sha: HEAD, status: 'completed', conclusion: 'success' });
    expect(world.github.state.requests.find((one) => one.route === 'POST /repos/{owner}/{repo}/check-runs')).toMatchObject({ external_id: READY_EXTERNAL_ID });
    const { title, summary } = outputOf(posted ?? { id: 0, name: '', head_sha: '', status: '', conclusion: '', output: null });
    expect(title).toBe('Ready for review · 5 of 5');
    const lines = stateLines(summary);
    expect(lines.map((line) => /· (pass|fail|not finished|not judged)/.exec(line)?.[1])).toEqual(['pass', 'pass', 'pass', 'pass', 'pass']);
    for (const line of lines) expect(line).toMatch(/\[evidence\]\(https:\/\/github\.com\/acme\/widgets\/\S+\)$/);
    expect(summary).toContain(NOT_MERGED);
    expect(summary).toContain(POSTED_BY);
    expect(summary).toContain('<!-- omni-loop:signed -->');
    const [row] = saved;
    expect(row).toMatchObject({ installationId: 7, repository: 'acme/widgets', prd: 7, prNumber: 31, headSha: HEAD, state: 'ready', passed: 5, headline: title });
    expect((row?.checks as { state: string }[]).map((check) => check.state)).toEqual(['pass', 'pass', 'pass', 'pass', 'pass']);
    expect(row?.criteria).toEqual([
      { number: 1, kind: 'test', scenario: 'A total adds up', lines: ['Scenario: A total adds up', '  Given a quote of two lines', '  When it is totalled', '  Then the total is their sum'], proof: 'src/total.test.ts', state: 'passed' },
    ]);
  });

  it('names the loosened test and posts the check red, not ready, when a test gained a skip no item excuses', async () => {
    const head = { ...baseFiles(), 'src/total.test.ts': TEST.replace("it('AC-1", "it.skip('AC-1") };
    const world = setUp({ head, changes: [{ filename: 'src/total.test.ts', status: 'modified' }] });
    const { store, saved } = fakeStore();
    await runJob(world, store);
    const [posted] = readyRuns(world);
    expect(posted).toMatchObject({ status: 'completed', conclusion: 'failure' });
    const { title, summary } = outputOf(posted ?? { id: 0, name: '', head_sha: '', status: '', conclusion: '', output: null });
    expect(title).toBe('Not ready · 4 of 5 · No test was loosened: fail');
    expect(stateLines(summary)[3]).toContain('src/total.test.ts: .skip added');
    expect(summary).not.toContain(NOT_MERGED);
    expect(saved[0]).toMatchObject({ state: 'not ready', passed: 4 });
  });

  it('shows a test job still running as not finished, in progress and never green, then completes the same run once CI ends', async () => {
    const world = setUp({ ci: [run('test', null, 'in_progress'), run('lint'), ...GREEN.slice(2)] });
    const { store } = fakeStore();
    await runJob(world, store);
    const [going] = readyRuns(world);
    expect(going).toMatchObject({ status: 'in_progress', conclusion: null });
    expect(outputOf(going ?? { id: 0, name: '', head_sha: '', status: '', conclusion: '', output: null }).title).toMatch(/^Not finished · 3 of 5 · CI green on the latest commit: not finished/);

    world.world.ci = GREEN;
    await runJob(world, store);
    expect(readyRuns(world)).toEqual([expect.objectContaining({ id: going?.id, status: 'completed', conclusion: 'success' })]);
    expect(world.github.state.requests.filter((one) => one.route === 'PATCH /repos/{owner}/{repo}/check-runs/{check_run_id}')).toHaveLength(1);
  });

  it('posts nothing new when its latest run on the commit already says the same', async () => {
    const world = setUp();
    const { store } = fakeStore();
    await runJob(world, store);
    await runJob(world, store);
    expect(readyRuns(world)).toHaveLength(1);
    expect(world.github.state.requests.filter((one) => one.route.startsWith('POST') || one.route.startsWith('PATCH'))).toHaveLength(1);
  });

  it('posts nothing at all, not even skipped, under ready.checks: off, and asks the store nothing', async () => {
    const world = setUp({ base: baseFiles('off') });
    const { store, saved, asked } = fakeStore();
    expect(await runJob(world, store)).toEqual({ outcome: 'skipped', reason: 'the ready checks are off here, or the loop is not installed' });
    expect(world.github.state.checkRuns).toEqual([]);
    expect([saved, asked]).toEqual([[], []]);
    expect(world.github.state.requests.map((one) => one.route)).not.toContain(RUNS);
  });

  it('posts nothing on a base without the loop, on a pull request that is no feature PR, or on a branch whose topic has no PRD folder', async () => {
    const noLoop = Object.fromEntries(Object.entries(baseFiles()).filter(([path]) => path !== CONFIG_FILE));
    const noConfig = setUp({ base: noLoop });
    expect(await runJob(noConfig, fakeStore().store)).toMatchObject({ outcome: 'skipped' });
    const fix = setUp();
    fix.github.state.pull.head.ref = 'fix/7-total';
    expect(await runJob(fix, fakeStore().store)).toEqual({ outcome: 'skipped', reason: 'not a feature pull request into the default branch' });
    const other = setUp();
    other.github.state.pull.head.ref = 'feat/elsewhere';
    expect(await runJob(other, fakeStore().store)).toEqual({ outcome: 'skipped', reason: "no PRD folder at the head carries feat/elsewhere's topic" });
    expect([noConfig, fix, other].flatMap(readyRuns)).toEqual([]);
  });

  it('under ready.checks: mission, posts only for a PRD in a live mission, asked of the installation\'s workspace', async () => {
    const outside = setUp({ base: baseFiles('mission') });
    const none = fakeStore(false);
    expect(await runJob(outside, none.store)).toEqual({ outcome: 'skipped', reason: 'PRD 7 is in no running or paused mission' });
    expect(none.asked).toEqual([{ installationId: 7, repository: 'acme/widgets', prd: 7 }]);
    expect(readyRuns(outside)).toEqual([]);

    expect(await runJob(setUp({ base: baseFiles('mission') }), null)).toEqual({ outcome: 'skipped', reason: 'the missions cannot be read here' });

    const inside = setUp({ base: baseFiles('mission') });
    expect(await runJob(inside, fakeStore(true).store)).toEqual({ outcome: 'done' });
    expect(readyRuns(inside)).toHaveLength(1);
  });

  it('under ready.checks: all, posts the check with no database, saving nothing', async () => {
    const world = setUp();
    expect(await runJob(world, null)).toEqual({ outcome: 'done' });
    expect(readyRuns(world)).toEqual([expect.objectContaining({ conclusion: 'success' })]);
  });

  it('says not judged, neutral, once the job gave up on a gated pull request; nothing where the gate is off', async () => {
    const world = setUp();
    await readyFailureHook({ octokitFor: () => world.octokit, store: null })(claimedJob(READY_KIND, PAYLOAD, 5), 'GitHub answered 502\nmore');
    const [posted] = readyRuns(world);
    expect(posted).toMatchObject({ status: 'completed', conclusion: 'neutral' });
    expect(outputOf(posted ?? { id: 0, name: '', head_sha: '', status: '', conclusion: '', output: null }).summary).toContain('Not judged: the check could not run — GitHub answered 502.');

    const off = setUp({ base: baseFiles('off') });
    await readyFailureHook({ octokitFor: () => off.octokit })(claimedJob(READY_KIND, PAYLOAD, 5), 'boom');
    expect(off.github.state.checkRuns).toEqual([]);
  });
});
