// The e2e fallback a runner runs (PRD 2898 s8): when the e2e scenarios of a gated feature PR do not run in CI
// (`e2e.ci` false, or no model key there), the Omni App queues `/omni:acceptance <prd> --pr <n> --sha <sha>` for a
// runner of the workspace. The line runs no agent and no skill: the job's process (./job.ts) runs it as plain code,
//
//   checkout   `git fetch origin <sha>`, then the worktree detached on that commit, the PR's head: its e2e tests
//              are the ones the feature branch holds
//   install    `pnpm install --frozen-lockfile` when the commit has a lockfile
//   target     the address the scenarios run on: a fixed `e2e.url`, or with `github-deployment` the newest
//              successful deployment of the commit (only `e2e.deployment`'s, when set), asked through `gh`,
//              every 20 seconds for up to 15 minutes, as CI's e2e job waits for it
//   run        in `e2e.dir`, the browser installed (`e2e-web install chromium`, a failure only noted), then
//              `e2e run --tag prd-<n> --pass-with-no-tests`, with `APP_URL` the target and
//              `E2E_TELEMETRY_DISABLED=1`; the model key and the preview's bypass come from the runner's own
//              environment, never from the line, and every secret of it reads `***` in the log (L-GDPR-2)
//   result     the run's `report.json` read into the acceptance report's `e2e` results (kit/lib/ready/report.ts),
//              one test titled `AC-<n>: …` and tagged `prd-<n>` each, printed as the log's last line
//              `omni-acceptance: <report>`; a step that fails prints `omni-acceptance: failed — <why>` instead
//
// The App reads that line from the job's log tail once the job ended (`acceptanceOfLog`), and writes the
// `acceptance` check run of the commit from it, in its own name: the runner never writes to GitHub.
import { execFile, spawn } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { loadConfig } from '../config.ts';
import { messageOf } from '../narrow.ts';
import { acNumberOfTitle } from '../ready/criteria.ts';
import { ACCEPTANCE_REPORT_FORMAT, parseAcceptanceReport, type AcceptanceReport } from '../ready/report.ts';

/** The runner line's skill: no plugin skill, the job's process runs it itself. */
export const ACCEPTANCE_SKILL = 'acceptance';

/** What an acceptance line names: the PRD, its feature PR and the commit the scenarios prove. */
export type AcceptanceTarget = { prd: number; pr: number; sha: string };

const LINE = /^\/omni:acceptance ([1-9]\d*) --pr ([1-9]\d*) --sha ([0-9a-f]{40})$/;

/** The line the App queues for `target`. */
export function acceptanceLine({ prd, pr, sha }: AcceptanceTarget): string {
  return `/omni:${ACCEPTANCE_SKILL} ${String(prd)} --pr ${String(pr)} --sha ${sha}`;
}

/** What an acceptance line names; null for any other line, or one out of shape. */
export function parseAcceptanceLine(line: string): AcceptanceTarget | null {
  const match = LINE.exec(line.trim());
  if (!match) return null;
  return { prd: Number(match[1]), pr: Number(match[2]), sha: match[3] ?? '' };
}

/** The mark of the result line the job ends its log on. */
const ACCEPTANCE_MARK = 'omni-acceptance:';

/** What a finished job's log says: the e2e results it proved, or why it proved none. */
export type AcceptanceOutcome = { ok: true; report: AcceptanceReport } | { ok: false; why: string };

/** The result line of a report, on one line. */
const resultLine = (report: AcceptanceReport) => `${ACCEPTANCE_MARK} ${JSON.stringify(report)}`;

/** The result line of a run that proved nothing. */
const failedLine = (why: string) => `${ACCEPTANCE_MARK} failed — ${why.replace(/\s+/g, ' ').trim()}`;

/** What the last result line of `log` says; null when it holds none, the job not ended or not an acceptance run. */
export function acceptanceOfLog(log: string): AcceptanceOutcome | null {
  const line = log.split('\n').reverse().find((each) => each.includes(ACCEPTANCE_MARK));
  if (line === undefined) return null;
  const said = line.slice(line.indexOf(ACCEPTANCE_MARK) + ACCEPTANCE_MARK.length).trim();
  if (!said.startsWith('{')) return { ok: false, why: said.replace(/^failed — /, '') || 'the run said nothing' };
  const read = parseAcceptanceReport(said);
  return read.ok ? { ok: true, report: read.report } : { ok: false, why: read.why };
}

/** One result of the e2e run's `report.json` (its `report-1` schema), as far as the fallback reads it. */
const E2eTestSchema = z.object({
  /** The describe blocks, then the test's own title, last. */
  titlePath: z.array(z.string()).min(1),
  status: z.string(),
  tags: z.array(z.string()).default([]),
  file: z.string(),
});
const E2eRunSchema = z.object({ schemaVersion: z.literal('report-1'), run: z.object({ results: z.array(E2eTestSchema) }) });

type Result = AcceptanceReport['results'][number];

/** How the e2e run's statuses read as proofs: a flaky test passed in the end, a timed-out one failed. */
const PROVED: Readonly<Record<string, Result['state']>> = { passed: 'passed', flaky: 'passed', failed: 'failed', 'timed-out': 'failed', interrupted: 'failed' };

/** The `e2e` results of a run's `report.json` text: each test titled `AC-<n>: …` and tagged `prd-<prd>`. */
export function e2eResultsOf(text: string, { prd, dir }: { prd: number; dir: string }): Result[] {
  const { run } = E2eRunSchema.parse(JSON.parse(text));
  return run.results.flatMap((result): Result[] => {
    const title = result.titlePath.at(-1) ?? '';
    const ac = acNumberOfTitle(title);
    if (ac === null || !result.tags.includes(`prd-${String(prd)}`)) return [];
    return [{ ac, kind: 'e2e', state: PROVED[result.status] ?? 'skipped', title, proof: `${dir}/${result.file}` }];
  });
}

/** The variables whose values never reach the log: the preview's bypass, and every key, token or secret. */
const SECRET_NAME = /(?:_API_KEY|_TOKEN|_SECRET|_PASSWORD)$/;

/** The secret values of `env`, longest first, so a value inside another is masked whole. */
export function secretsOf(env: Readonly<Record<string, string | undefined>>, bypassEnv: string | null): string[] {
  return Object.entries(env)
    .filter(([name, value]) => value !== undefined && value.length >= 8 && (name === bypassEnv || SECRET_NAME.test(name)))
    .map(([, value]) => value ?? '')
    .sort((a, b) => b.length - a.length);
}

/** `text` with every secret read `***`. */
const masked = (text: string, secrets: readonly string[]) => secrets.reduce((all, secret) => all.split(secret).join('***'), text);

/** What the run writes to and how it waits: the job's log and pane, its variables, its clock. */
export type AcceptanceIo = {
  cwd: string;
  log: string;
  out: { write(text: string): unknown };
  env: Readonly<Record<string, string | undefined>>;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
};

/** One run of a command: its exit code, and its standard output when it was kept. */
type Ran = { code: number; stdout: string };

/** A failed step: why, in one line. */
class StepFailed extends Error {}

/** The log's writer: each line masked, to the log and the pane. */
function writer(io: AcceptanceIo, secrets: () => readonly string[]) {
  return (text: string): void => {
    const safe = masked(text, secrets());
    appendFileSync(io.log, safe);
    io.out.write(safe);
  };
}

/** Runs `file args` in `cwd`, its output to the log (masked), or kept when `keep`. Never throws: 127 when it cannot start. */
function runIn(file: string, args: readonly string[], { cwd, env, write, keep = false }: { cwd: string; env: Readonly<Record<string, string | undefined>>; write: (text: string) => void; keep?: boolean }): Promise<Ran> {
  return new Promise((resolve) => {
    const child = keep
      ? execFile(file, [...args], { cwd, env, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }, (error, stdout) => {
          const code = error === null ? 0 : typeof error.code === 'number' ? error.code : 127;
          resolve({ code, stdout });
        })
      : spawn(file, [...args], { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    if (keep) return;
    let pending = '';
    const lines = (chunk: Buffer): void => {
      pending += chunk.toString('utf8');
      const cut = pending.lastIndexOf('\n');
      if (cut === -1) return;
      write(pending.slice(0, cut + 1));
      pending = pending.slice(cut + 1);
    };
    child.stdout?.on('data', lines);
    child.stderr?.on('data', lines);
    child.on('error', () => {
      write(`${file}: could not be started\n`);
      resolve({ code: 127, stdout: '' });
    });
    child.on('close', (code) => {
      if (pending !== '') write(`${pending}\n`);
      resolve({ code: code ?? 1, stdout: '' });
    });
  });
}

const DEPLOYMENTS = z.array(z.object({ id: z.number(), environment: z.string() }));
const STATUSES = z.array(z.object({ state: z.string(), environment_url: z.string().optional() }));

const PREVIEW_EVERY_MS = 20_000;
const PREVIEW_WAIT_MS = 15 * 60_000;

/** The address of the newest successful deployment of `sha`; null while there is none yet. */
async function deployed(step: (file: string, args: readonly string[]) => Promise<Ran>, { slug, sha, environment }: { slug: string; sha: string; environment: string | null }): Promise<string | null> {
  const asked = async (path: string) => {
    const ran = await step('gh', ['api', path]);
    if (ran.code !== 0) throw new StepFailed(`the preview's address could not be read: gh api ${path.replace(/\?.*$/, '')} exited ${String(ran.code)}`);
    return JSON.parse(ran.stdout) as unknown;
  };
  const deployments = DEPLOYMENTS.parse(await asked(`repos/${slug}/deployments?sha=${sha}&per_page=100`));
  const newest = deployments.find((deployment) => environment === null || deployment.environment === environment);
  if (newest === undefined) return null;
  const [latest] = STATUSES.parse(await asked(`repos/${slug}/deployments/${String(newest.id)}/statuses?per_page=100`));
  if (latest?.state === 'success' && latest.environment_url) return latest.environment_url;
  if (latest?.state === 'failure' || latest?.state === 'error') throw new StepFailed(`the deployment ${newest.environment} of ${sha.slice(0, 7)} ended ${latest.state}`);
  return null;
}

/** The address the scenarios run on: the fixed `e2e.url`, or the preview of `sha` once it is up. */
async function targetOf(io: AcceptanceIo, step: (file: string, args: readonly string[]) => Promise<Ran>, { url, slug, sha, environment }: { url: string | null; slug: string | null; sha: string; environment: string | null }): Promise<string> {
  if (url === null) throw new StepFailed('e2e.url is not set: there is no address to run the scenarios on');
  if (url !== 'github-deployment') return url;
  if (slug === null) throw new StepFailed('repo.slug is not set: the preview of the commit cannot be asked for');
  const now = io.now ?? Date.now;
  const sleep = io.sleep ?? ((ms: number) => new Promise<void>((done) => setTimeout(done, ms)));
  const deadline = now() + PREVIEW_WAIT_MS;
  for (;;) {
    const found = await deployed(step, { slug, sha, environment });
    if (found !== null) return found;
    if (now() >= deadline) throw new StepFailed(`no preview of ${sha.slice(0, 7)} succeeded within ${String(PREVIEW_WAIT_MS / 60_000)} minutes`);
    await sleep(PREVIEW_EVERY_MS);
  }
}

/** Runs a step whose failure ends the run, naming it. */
async function must(ran: Promise<Ran>, what: string): Promise<Ran> {
  const done = await ran;
  if (done.code !== 0) throw new StepFailed(`${what} exited ${String(done.code)}`);
  return done;
}

/**
 * Runs the acceptance line `line` in the job's worktree: the scenarios of its PRD, on its commit, against its
 * target. Ends the log on the result line, and answers 0 once a report was read (its tests may have failed: the
 * report says so), 1 when a step failed.
 */
export async function runAcceptance(line: string, io: AcceptanceIo): Promise<number> {
  const target = parseAcceptanceLine(line);
  let secrets: readonly string[] = secretsOf(io.env, null);
  const write = writer(io, () => secrets);
  const step = (file: string, args: readonly string[], cwd = io.cwd, keep = false, env = io.env) => {
    if (!keep) write(`$ ${[file, ...args].join(' ')}\n`);
    return runIn(file, args, { cwd, env, write, keep });
  };
  try {
    if (target === null) throw new StepFailed('the line does not read /omni:acceptance <prd> --pr <n> --sha <40-character sha>');
    const { prd, sha } = target;
    await must(step('git', ['fetch', 'origin', sha]), 'git fetch');
    await must(step('git', ['checkout', '--detach', sha]), 'git checkout');
    if (existsSync(join(io.cwd, 'pnpm-lock.yaml'))) await must(step('pnpm', ['install', '--frozen-lockfile']), 'pnpm install');
    const config = loadConfig(io.cwd);
    secrets = secretsOf(io.env, config.e2e.bypassEnv);
    const url = await targetOf(io, (file, args) => step(file, args, io.cwd, true), { url: config.e2e.url, slug: config.repo.slug, sha, environment: config.e2e.deployment });
    write(`acceptance: PRD ${String(prd)}'s e2e scenarios run on ${url}, commit ${sha.slice(0, 7)}\n`);
    const dir = join(io.cwd, config.e2e.dir);
    if ((await step('pnpm', ['exec', 'e2e-web', 'install', 'chromium'], dir)).code !== 0) write('acceptance: the browser could not be installed here; the run goes on with the one already there\n');
    const env = { ...io.env, APP_URL: url, E2E_TELEMETRY_DISABLED: '1' };
    const ran = await step('pnpm', ['exec', 'e2e', 'run', '--tag', `prd-${String(prd)}`, '--pass-with-no-tests'], dir, false, env);
    const report = join(dir, '.e2e', 'report.json');
    if (!existsSync(report)) throw new StepFailed(`the e2e run wrote no report (it exited ${String(ran.code)})`);
    const results = e2eResultsOf(readFileSync(report, 'utf8'), { prd, dir: config.e2e.dir });
    write(`${resultLine({ format: ACCEPTANCE_REPORT_FORMAT, commit: sha, results })}\n`);
    return 0;
  } catch (error) {
    write(`${failedLine(error instanceof StepFailed ? error.message : `the run broke: ${messageOf(error).split('\n')[0] ?? ''}`)}\n`);
    return 1;
  }
}
