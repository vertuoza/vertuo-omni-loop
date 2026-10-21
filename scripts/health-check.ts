// The hourly health check (PRD 1723 s4), run by .github/workflows/health.yml. For each app it is
// given, it probes `<base URL>/api/health`: a status other than 200, a body whose `ok` is not `true`,
// or no answer within 10 seconds is a failed probe, and an app is down only when two probes 30 seconds
// apart both fail, so a cold start or a blip raises nothing. Then it keeps one issue per app, found
// among the open issues by its exact title, `Health: <app> is down`: down with none open, it opens
// one; down with one open, it comments once; up with one open, it comments that the app is back,
// naming the commit, and closes it. It adds no label (the repository creates none on its own).
//
// Node built-ins and the `gh` command only, so the workflow runs it with no install. Its repository
// and URLs are arguments; it reads no environment (gh reads its own token):
//   node scripts/health-check.ts --repo <owner>/<repo> --app galaxy=<url> [--app omni-app=<url>]
// It exits 0 whatever it found: a down app is reported by its issue, never by a red run. It exits 1
// only when its arguments are wrong or gh could not write what it found, so the alert is not lost.
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { findOpenIssue, gh } from './gh-issues.ts';

export const PROBE_LIMIT_MS = 10_000;
export const BETWEEN_PROBES_MS = 30_000;

export interface Deps {
  /** One GET of a health URL; the signal aborts it once the limit passed. */
  fetch: (url: string, init: { signal: AbortSignal }) => Promise<Response>;
  /** Runs `gh` with these arguments and resolves to its stdout; rejects when it fails. */
  gh: (args: string[]) => Promise<string>;
  now: () => Date;
  /** Resolves after `ms`; the signal, when given, ends the wait early (it is no longer needed). */
  wait: (ms: number, signal?: AbortSignal) => Promise<void>;
}

export interface App {
  app: string;
  url: string;
}

export interface Options {
  repo: string;
  apps: App[];
}

export interface Probe {
  up: boolean;
  /** The HTTP status, or null when nothing answered in time. */
  status: number | null;
  /** The names of the checks the body did not report `ok`. */
  failedChecks: string[];
  commit: string | null;
}

/** The repository and the apps, or null when an argument is missing or malformed. */
export function parseArgs(argv: readonly string[]): Options | null {
  let repo = '';
  const apps: App[] = [];
  for (let k = 0; k < argv.length; k += 2) {
    const flag = argv[k];
    const value = argv[k + 1] ?? '';
    if (flag === '--repo') repo = value;
    else if (flag === '--app') {
      const match = /^([a-z][a-z0-9-]*)=(https?:\/\/\S+)$/.exec(value);
      if (!match?.[1] || !match[2]) return null;
      apps.push({ app: match[1], url: match[2].replace(/\/+$/, '') });
    } else return null;
  }
  if (!/^[^/\s]+\/[^/\s]+$/.test(repo) || apps.length === 0) return null;
  return { repo, apps };
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

async function read(response: Response): Promise<Probe> {
  let body: unknown = null;
  try {
    body = JSON.parse(await response.text());
  } catch {
    body = null;
  }
  const record = isRecord(body) ? body : {};
  const checks = isRecord(record.checks) ? record.checks : {};
  return {
    up: response.status === 200 && record.ok === true,
    status: response.status,
    failedChecks: Object.keys(checks).filter((name) => checks[name] !== 'ok'),
    commit: typeof record.commit === 'string' ? record.commit : null,
  };
}

/** One probe of a health URL, limited to 10 seconds, reading the answer's body too. */
export async function probe(url: string, deps: Deps): Promise<Probe> {
  const noAnswer: Probe = { up: false, status: null, failedChecks: [], commit: null };
  const request = new AbortController();
  const limit = new AbortController();
  try {
    const answer = deps.fetch(url, { signal: request.signal }).then(read, () => noAnswer);
    const late = deps.wait(PROBE_LIMIT_MS, limit.signal).then(() => noAnswer);
    return await Promise.race([answer, late]);
  } catch {
    return noAnswer;
  } finally {
    request.abort();
    limit.abort();
  }
}

/** Up after the first good probe; down only when a second, 30 seconds later, fails too. */
async function check(target: App, deps: Deps): Promise<Probe> {
  const url = `${target.url}/api/health`;
  const first = await probe(url, deps);
  if (first.up) return first;
  await deps.wait(BETWEEN_PROBES_MS);
  return probe(url, deps);
}

export const title = (app: string): string => `Health: ${app} is down`;

function describeDown(result: Probe, at: Date): string {
  const lines = [
    `- Status: ${result.status === null ? 'no answer within 10 seconds' : String(result.status)}`,
    ...(result.failedChecks.length > 0 ? [`- Failed checks: ${result.failedChecks.join(', ')}`] : []),
    ...(result.commit ? [`- Commit: ${result.commit}`] : []),
    `- Time: ${at.toISOString()}`,
  ];
  return lines.join('\n');
}

/** Probes one app and keeps its issue; returns what it did, in one line. */
async function keep(repo: string, target: App, deps: Deps): Promise<string> {
  const result = await check(target, deps);
  const openNumber = await findOpenIssue(repo, title(target.app), deps.gh);
  const at = deps.now();
  if (result.up) {
    if (openNumber === null) return `${target.app}: up`;
    const back = `\`${target.app}\` is back: \`/api/health\` answered 200 with \`ok: true\` at ${at.toISOString()}, commit ${result.commit ?? 'unknown'}.`;
    await deps.gh(['api', '-X', 'POST', `repos/${repo}/issues/${openNumber}/comments`, '-f', `body=${back}`]);
    await deps.gh(['api', '-X', 'PATCH', `repos/${repo}/issues/${openNumber}`, '-f', 'state=closed', '-f', 'state_reason=completed']);
    return `${target.app}: up, closed #${openNumber}`;
  }
  if (openNumber === null) {
    const body = [
      `\`${target.app}\` failed two health probes of \`/api/health\`, 30 seconds apart.`,
      '',
      describeDown(result, at),
      '',
      'The hourly health check comments here while it stays down and closes this issue once it answers again.',
    ].join('\n');
    await deps.gh(['api', '-X', 'POST', `repos/${repo}/issues`, '-f', `title=${title(target.app)}`, '-f', `body=${body}`]);
    return `${target.app}: down, opened an issue`;
  }
  const still = [`Still down.`, '', describeDown(result, at)].join('\n');
  await deps.gh(['api', '-X', 'POST', `repos/${repo}/issues/${openNumber}/comments`, '-f', `body=${still}`]);
  return `${target.app}: down, commented on #${openNumber}`;
}

/** Checks every app on its own; 0 whatever it found, 1 when gh could not read or write. */
export async function run(options: Options, deps: Deps, say: (line: string) => void = () => undefined): Promise<number> {
  let code = 0;
  for (const target of options.apps) {
    try {
      say(`health-check: ${await keep(options.repo, target, deps)}`);
    } catch (error) {
      code = 1;
      say(`health-check: ${target.app}: gh failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return code;
}

const realDeps: Deps = {
  fetch: (url, init) => fetch(url, { signal: init.signal, headers: { accept: 'application/json' }, cache: 'no-store' }),
  gh,
  now: () => new Date(),
  wait: (ms, signal) => delay(ms, undefined, signal ? { signal } : {}).catch(() => undefined),
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = parseArgs(process.argv.slice(2));
  if (!options) {
    process.stderr.write('health-check: needs --repo <owner>/<repo> and at least one --app <name>=<https URL>\n');
    process.exit(1);
  }
  process.exit(await run(options, realDeps, (line) => { console.log(line); }));
}
