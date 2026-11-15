// The acceptance report of a feature PR's head commit, as CI writes it (PRD 2898, s5): what proved each
// `AC-<n>` criterion of the PRD's spec, in the one format `kit/lib/ready/report.ts` holds, which the
// ready rule's check 3 reads. Three commands, each a step of .github/workflows/checks.yml:
//
// - `e2e-plan --branch <head> --key-set <true|false>`: whether the e2e job has anything to run, as
//   `state` (and the PRD as `prd`) in the step's outputs. `ran`, or why not: `no-prd` (the branch is
//   no PRD's feature branch), `no-criterion` (its spec has no `e2e` criterion), `not-ci` (`e2e.ci` is
//   false: a runner of the workspace runs the scenarios), `no-url` (`e2e.url` is not set) or `no-key`
//   (the job has no model key). The key itself never reaches this script: only whether it is set.
// - `preview --repo <owner/name> --head <sha>`: the address the scenarios run on, as `url`. A fixed
//   `e2e.url` is that address; `github-deployment` waits for the newest deployment of the head commit
//   (only those of `e2e.deployment`, when it is set) to succeed, looking every 20 seconds for up to
//   15 minutes, and fails when it fails or never comes.
// - `post --repo --branch --head --base --vitest <dir> --e2e-state <state> --e2e-report <file> --out
//   <file> [--details-url <url>]`: the report. A `test` criterion is proven by a vitest test titled
//   `AC-<n>: …` in a test file the pull request changed (so an older PRD's `AC-1` never proves this
//   one's), read from the shards' JSON reports; an `e2e` one by the e2e run's test of that title tagged
//   `prd-<n>`. While the e2e scenarios wait on a runner (`not-ci`, `no-key`, `no-url`), each `e2e`
//   criterion is `pending`, and the report is kept but not posted: the App writes the `acceptance`
//   check run once a runner ran them. Otherwise it writes the check run `acceptance` on the head
//   commit, its text the report itself, its summary one line per criterion: `success` when every
//   criterion is proven, `failure` when one is not, `neutral` for a spec with no `AC-<n>` criterion.
//   A pull request that is no PRD's feature PR gets no report.
//
// Arguments, never the environment, carry what the workflow knows; GitHub is reached through `gh`,
// which reads its own token. Nothing here calls a model.
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { loadConfig } from '../kit/lib/config.ts';
import { processEnv, readEnv } from '../kit/lib/env/read.ts';
import type { PrdNumber } from '../kit/lib/ids.ts';
import { foldersLayout, parseFolderName, prdFoldersIn } from '../kit/lib/layout.ts';
import { acNumberOfTitle, parseCriteria, type Criterion, type ParsedCriteria } from '../kit/lib/ready/criteria.ts';
import { ACCEPTANCE_CHECK_NAME, ACCEPTANCE_REPORT_FORMAT, renderAcceptanceReport, type AcceptanceReport } from '../kit/lib/ready/report.ts';

type Config = ReturnType<typeof loadConfig>;
type Result = AcceptanceReport['results'][number];

/** How the e2e job's plan ended: it ran, or why it did not. */
const E2E_STATES = ['ran', 'no-prd', 'no-criterion', 'not-ci', 'no-url', 'no-key'] as const;
type E2eState = (typeof E2E_STATES)[number];

/** The states in which the `e2e` criteria wait on a runner of the workspace, and why each says so. */
const WAITING: Partial<Record<E2eState, string>> = {
  'not-ci': 'no runner has run the e2e scenarios yet',
  'no-key': 'no model key is set for CI, and no runner has run the e2e scenarios yet',
  'no-url': 'e2e.url is not set, and no runner has run the e2e scenarios yet',
};

/** What the workflow's steps run: `gh` and `git`, with their arguments, answering their stdout. */
export type Exec = (file: string, args: readonly string[]) => string;

/** The PRD a feature branch is for, and its spec's path, or null when the branch is no PRD's. */
export function prdOfBranch(root: string, config: Config, branch: string): { prd: PrdNumber; spec: string } | null {
  const [before = '', after] = config.branches.feature.split('{topic}');
  if (after === undefined || branch.length <= before.length + after.length || !branch.startsWith(before) || !branch.endsWith(after)) return null;
  const topic = branch.slice(before.length, branch.length - after.length);
  const { dirs } = foldersLayout(root, config.paths);
  for (const dir of [dirs.inbox, dirs.shipped]) {
    const folder = prdFoldersIn(join(root, dir)).find(({ name }) => parseFolderName(name)?.topic === topic);
    if (folder) return { prd: folder.prd, spec: `${dir}/${folder.name}/spec.md` };
  }
  return null;
}

/** The criteria of the spec at `path`, or none when it is not there. */
function criteriaAt(root: string, path: string): ParsedCriteria {
  const file = join(root, path);
  return existsSync(file) ? parseCriteria(readFileSync(file, 'utf8')) : { criteria: [], problems: [] };
}

/** Whether the e2e job has anything to run, and why not. */
export function planE2e(config: Config, criteria: readonly Criterion[] | null, keySet: boolean): E2eState {
  if (criteria === null) return 'no-prd';
  if (!criteria.some((criterion) => criterion.kind === 'e2e')) return 'no-criterion';
  if (!config.e2e.ci) return 'not-ci';
  if (config.e2e.url === null) return 'no-url';
  return keySet ? 'ran' : 'no-key';
}

/** One test of vitest's JSON report, as far as the report reads it. */
const VitestReportSchema = z.object({
  testResults: z.array(z.object({ name: z.string(), assertionResults: z.array(z.object({ title: z.string(), status: z.string() })) })),
});
type VitestReport = z.infer<typeof VitestReportSchema>;

/** One result of the e2e run's `report.json` (its `report-1` schema), as far as the report reads it. */
const E2eReportSchema = z.object({
  schemaVersion: z.literal('report-1'),
  run: z.object({ results: z.array(z.object({ titlePath: z.array(z.string()).min(1), status: z.string(), tags: z.array(z.string()).default([]), file: z.string() })) }),
});
type E2eReport = z.infer<typeof E2eReportSchema>;

const VITEST_STATES: Readonly<Record<string, Result['state']>> = { passed: 'passed', failed: 'failed' };
const E2E_RESULT_STATES: Readonly<Record<string, Result['state']>> = { passed: 'passed', flaky: 'passed', failed: 'failed', 'timed-out': 'failed', interrupted: 'failed' };

/** A test file's path in the repository when the pull request changed it, else null. The shards ran in
 * a checkout of their own, so a path that is not under `root` is matched by its ending. */
function changedPath(root: string, file: string, changed: ReadonlySet<string>): string | null {
  const path = relative(root, file).split(sep).join('/');
  if (changed.has(path)) return path;
  const posix = file.split(sep).join('/');
  return [...changed].find((candidate) => posix.endsWith(`/${candidate}`)) ?? null;
}

/** The `AC-<n>` tests of the changed test files, for the criteria the spec holds. */
function testResults(root: string, numbers: ReadonlySet<number>, vitest: readonly VitestReport[], changed: ReadonlySet<string>): Result[] {
  return vitest.flatMap(({ testResults: files }) =>
    files.flatMap((file) => {
      const path = changedPath(root, file.name, changed);
      if (path === null) return [];
      return file.assertionResults.flatMap(({ title, status }): Result[] => {
        const ac = acNumberOfTitle(title);
        return ac !== null && numbers.has(ac) ? [{ ac, kind: 'test', state: VITEST_STATES[status] ?? 'skipped', title, proof: path }] : [];
      });
    }),
  );
}

/** The e2e run's `AC-<n>` tests tagged `prd-<n>`, for the criteria the spec holds. */
function ranResults(dir: string, prd: PrdNumber, numbers: ReadonlySet<number>, report: E2eReport | null): Result[] {
  return (report?.run.results ?? []).flatMap((result): Result[] => {
    const title = result.titlePath.at(-1) ?? '';
    const ac = acNumberOfTitle(title);
    if (ac === null || !numbers.has(ac) || !result.tags.includes(`prd-${String(prd)}`)) return [];
    return [{ ac, kind: 'e2e', state: E2E_RESULT_STATES[result.status] ?? 'skipped', title, proof: `${dir}/${result.file}` }];
  });
}

/** The `e2e` criteria as they stand: run, waiting on a runner, or not reported at all. */
function e2eResults(dir: string, prd: PrdNumber, criteria: readonly Criterion[], state: E2eState | null, report: E2eReport | null): Result[] {
  const numbers = new Set(criteria.map((criterion) => criterion.number));
  if (state === 'ran') return ranResults(dir, prd, numbers, report);
  const why = state === null ? undefined : WAITING[state];
  if (why === undefined) return [];
  return criteria
    .filter((criterion) => criterion.kind === 'e2e')
    .map((criterion) => ({ ac: criterion.number, kind: 'e2e', state: 'pending', title: `AC-${String(criterion.number)}: ${criterion.scenario ?? 'its scenario'}`, proof: null, why }));
}

/** What the report is built from. */
export type ReportInput = {
  root: string;
  dir: string;
  prd: PrdNumber;
  head: string;
  criteria: readonly Criterion[];
  vitest: readonly VitestReport[];
  changed: ReadonlySet<string>;
  e2eState: E2eState | null;
  e2eReport: E2eReport | null;
};

/** The report of the head commit: every `AC-<n>` result found for the spec's criteria. */
export function buildReport(input: ReportInput): AcceptanceReport {
  const numbers = new Set(input.criteria.map((criterion) => criterion.number));
  const results = [...testResults(input.root, numbers, input.vitest, input.changed), ...e2eResults(input.dir, input.prd, input.criteria, input.e2eState, input.e2eReport)];
  return { format: ACCEPTANCE_REPORT_FORMAT, commit: input.head, results: results.sort((a, b) => a.ac - b.ac) };
}

/** How one criterion stands in the report. */
function standing(criterion: Criterion, report: AcceptanceReport): { mark: '✓' | '✗' | '…'; why: string; proof: string } {
  const own = report.results.filter((result) => result.ac === criterion.number && result.kind === criterion.kind);
  const proof = [...new Set(own.flatMap((result) => (result.proof === null ? [] : [result.proof])))].join(', ') || '—';
  if (own.some((result) => result.state === 'failed')) return { mark: '✗', why: 'failed', proof };
  if (own.some((result) => result.state === 'passed')) return { mark: '✓', why: 'proven', proof };
  const pending = own.find((result) => result.state === 'pending');
  if (pending) return { mark: '…', why: pending.why ?? 'waiting', proof };
  return { mark: '✗', why: own.length > 0 ? 'skipped' : 'no proof on this commit', proof };
}

/** The check run the report makes: whether to post it now, its conclusion, its title and its summary. */
export function verdictOf(parsed: ParsedCriteria, report: AcceptanceReport): { post: boolean; conclusion: 'success' | 'failure' | 'neutral'; title: string; summary: string } {
  const rows = parsed.criteria.map((criterion) => ({ criterion, ...standing(criterion, report) }));
  const table = ['| criterion | kind | state | proof |', '| --- | --- | --- | --- |', ...rows.map(({ criterion, mark, why, proof }) => `| AC-${String(criterion.number)} | ${criterion.kind} | ${mark} ${why} | ${proof} |`)];
  const problems = parsed.problems.map(({ problem }) => `- ${problem}`);
  const summary = [...(rows.length > 0 ? table : []), ...(problems.length > 0 ? ['', 'Criteria the spec writes wrong:', ...problems] : [])].join('\n');
  const proven = rows.filter((row) => row.mark === '✓').length;
  const count = `${String(proven)} of ${String(rows.length)} criteria proven`;
  if (rows.some((row) => row.mark === '…')) return { post: false, conclusion: 'neutral', title: `${count}; the e2e scenarios wait on a runner`, summary };
  if (rows.length === 0 && problems.length === 0) return { post: true, conclusion: 'neutral', title: 'The spec has no criterion written ### AC-<n> · <kind>', summary };
  const failed = problems.length > 0 || proven < rows.length;
  return { post: true, conclusion: failed ? 'failure' : 'success', title: count, summary };
}

/** The files the pull request changed, from the merge-base of `base` and `head`. */
function changedFiles(exec: Exec, base: string, head: string): Set<string> {
  return new Set(exec('git', ['diff', '--name-only', `${base}...${head}`]).split('\n').filter(Boolean));
}

/** Every vitest JSON report in `dir`; none when the shards left none. */
function vitestReports(dir: string): VitestReport[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => VitestReportSchema.parse(JSON.parse(readFileSync(join(dir, name), 'utf8'))));
}

/** The e2e run's report, or null when the run left none. */
function e2eReport(file: string): E2eReport | null {
  return existsSync(file) ? E2eReportSchema.parse(JSON.parse(readFileSync(file, 'utf8'))) : null;
}

/** What a command writes beside its output: the step's outputs and its summary, when GitHub gives them. */
export type Io = { exec: Exec; say: (line: string) => void; output: string | null; summary: string | null; sleep: (seconds: number) => Promise<void>; now: () => number };

function stepOutput(io: Io, values: Readonly<Record<string, string>>) {
  if (io.output === null) return;
  appendFileSync(io.output, Object.entries(values).map(([key, value]) => `${key}=${value}\n`).join(''));
}

const OPTIONS = {
  branch: { type: 'string' },
  'key-set': { type: 'string' },
  repo: { type: 'string' },
  head: { type: 'string' },
  base: { type: 'string' },
  vitest: { type: 'string' },
  'e2e-state': { type: 'string' },
  'e2e-report': { type: 'string' },
  out: { type: 'string' },
  'details-url': { type: 'string' },
} as const;

type Options = Partial<Record<keyof typeof OPTIONS, string>>;

/** The option the command needs, or a usage error naming it. */
function need(options: Options, name: keyof typeof OPTIONS): string {
  const value = options[name];
  if (value === undefined || value === '') throw new UsageError(`--${name} is required`);
  return value;
}

class UsageError extends Error {}

function runPlan(root: string, config: Config, options: Options, io: Io): number {
  const found = prdOfBranch(root, config, need(options, 'branch'));
  const state = planE2e(config, found === null ? null : criteriaAt(root, found.spec).criteria, options['key-set'] === 'true');
  stepOutput(io, { state, prd: found === null ? '' : String(found.prd) });
  io.say(`acceptance-report: e2e ${state}${found === null ? '' : ` for PRD ${String(found.prd)}`}`);
  return 0;
}

/** The address of the newest successful deployment of `head`, or why there is none yet. */
function deployedUrl(config: Config, repo: string, head: string, exec: Exec): { url: string } | { failed: string } | null {
  const deployments = z.array(z.object({ id: z.number(), environment: z.string() })).parse(JSON.parse(exec('gh', ['api', `repos/${repo}/deployments?sha=${head}&per_page=100`])));
  const newest = deployments.find((deployment) => config.e2e.deployment === null || deployment.environment === config.e2e.deployment);
  if (newest === undefined) return null;
  const statuses = z.array(z.object({ state: z.string(), environment_url: z.string().optional() })).parse(JSON.parse(exec('gh', ['api', `repos/${repo}/deployments/${String(newest.id)}/statuses?per_page=100`])));
  const [latest] = statuses;
  if (latest?.state === 'success' && latest.environment_url) return { url: latest.environment_url };
  if (latest?.state === 'failure' || latest?.state === 'error') return { failed: `the deployment ${newest.environment} of ${head.slice(0, 7)} ended ${latest.state}` };
  return null;
}

const PREVIEW_EVERY_SECONDS = 20;
const PREVIEW_WAIT_SECONDS = 15 * 60;

async function runPreview(config: Config, options: Options, io: Io): Promise<number> {
  const [repo, head] = [need(options, 'repo'), need(options, 'head')];
  const url = config.e2e.url;
  if (url === null) throw new UsageError('e2e.url is not set: there is no address to run the scenarios on');
  if (url !== 'github-deployment') {
    stepOutput(io, { url });
    io.say(`acceptance-report: e2e runs on ${url}, the fixed e2e.url`);
    return 0;
  }
  const deadline = io.now() + PREVIEW_WAIT_SECONDS * 1000;
  for (;;) {
    const found = deployedUrl(config, repo, head, io.exec);
    if (found !== null && 'url' in found) {
      stepOutput(io, { url: found.url });
      io.say(`acceptance-report: e2e runs on ${found.url}, the preview of ${head.slice(0, 7)}`);
      return 0;
    }
    if (found !== null) return fail(io, found.failed);
    if (io.now() >= deadline) return fail(io, `no preview of ${head.slice(0, 7)} succeeded within ${String(PREVIEW_WAIT_SECONDS / 60)} minutes`);
    await io.sleep(PREVIEW_EVERY_SECONDS);
  }
}

function fail(io: Io, why: string): number {
  io.say(`::error::acceptance-report: ${why}`);
  return 1;
}

/** The e2e state the workflow handed over, or null when the e2e job ended before its plan said. */
function e2eStateOf(text: string | undefined): E2eState | null {
  return E2E_STATES.find((state) => state === text) ?? null;
}

/** Writes the check run `acceptance` on the head commit, through a body file, never the shell. */
function postCheckRun(io: Io, repo: string, head: string, report: AcceptanceReport, verdict: ReturnType<typeof verdictOf>, details: string | undefined) {
  const body = {
    name: ACCEPTANCE_CHECK_NAME,
    head_sha: head,
    status: 'completed',
    conclusion: verdict.conclusion,
    ...(details === undefined ? {} : { details_url: details }),
    output: { title: verdict.title, summary: verdict.summary || verdict.title, text: renderAcceptanceReport(report) },
  };
  const dir = mkdtempSync(join(tmpdir(), 'acceptance-'));
  try {
    writeFileSync(join(dir, 'body.json'), JSON.stringify(body));
    io.exec('gh', ['api', '-X', 'POST', `repos/${repo}/check-runs`, '--input', join(dir, 'body.json')]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function runPost(root: string, config: Config, options: Options, io: Io): number {
  const [repo, head, out] = [need(options, 'repo'), need(options, 'head'), need(options, 'out')];
  const found = prdOfBranch(root, config, need(options, 'branch'));
  if (found === null) {
    io.say('acceptance-report: the branch is no PRD\'s feature branch: no acceptance report');
    return 0;
  }
  const parsed = criteriaAt(root, found.spec);
  const report = buildReport({
    root,
    dir: config.e2e.dir,
    prd: found.prd,
    head,
    criteria: parsed.criteria,
    vitest: vitestReports(resolve(root, need(options, 'vitest'))),
    changed: changedFiles(io.exec, need(options, 'base'), head),
    e2eState: e2eStateOf(options['e2e-state']),
    e2eReport: e2eReport(resolve(root, options['e2e-report'] ?? join(config.e2e.dir, '.e2e', 'report.json'))),
  });
  mkdirSync(dirname(resolve(root, out)), { recursive: true });
  writeFileSync(resolve(root, out), renderAcceptanceReport(report));
  const verdict = verdictOf(parsed, report);
  if (io.summary !== null) appendFileSync(io.summary, `## Acceptance of PRD ${String(found.prd)}: ${verdict.title}\n\n${verdict.summary}\n`);
  if (verdict.post) postCheckRun(io, repo, head, report, verdict, options['details-url']);
  io.say(`acceptance-report: PRD ${String(found.prd)}: ${verdict.title}${verdict.post ? `, written as ${ACCEPTANCE_CHECK_NAME} (${verdict.conclusion})` : ', kept for the App to write'}`);
  return 0;
}

const USAGE = 'usage: node scripts/acceptance-report.ts e2e-plan|preview|post [options] (see the header of scripts/acceptance-report.ts)';

/** Runs one command from the repository at `root`; its exit code. */
export async function main(argv: readonly string[], root: string, io: Io): Promise<number> {
  const [command, ...rest] = argv;
  try {
    const { values } = parseArgs({ args: [...rest], options: OPTIONS, strict: true });
    const config = loadConfig(root);
    if (command === 'e2e-plan') return runPlan(root, config, values, io);
    if (command === 'preview') return await runPreview(config, values, io);
    if (command === 'post') return runPost(root, config, values, io);
    io.say(USAGE);
    return 2;
  } catch (error) {
    if (!(error instanceof UsageError || (error instanceof TypeError && 'code' in error))) throw error;
    io.say(`acceptance-report: ${error.message}\n${USAGE}`);
    return 2;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { githubActions } = readEnv(processEnv());
  const io: Io = {
    exec: (file, args) => execFileSync(file, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }),
    say: (line) => {
      console.log(line);
    },
    output: githubActions?.output ?? null,
    summary: githubActions?.summary ?? null,
    sleep: (seconds) => new Promise((done) => setTimeout(done, seconds * 1000)),
    now: () => Date.now(),
  };
  process.exit(await main(process.argv.slice(2), process.cwd(), io));
}
