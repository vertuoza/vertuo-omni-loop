#!/usr/bin/env node
// node scripts/security-settings.ts [--apply] [--repo <owner/name>] — secret scanning and push
// protection, switched on and kept on (PRD 1717). It reads, through `gh api`, the repository's
// `security_and_analysis` and its open secret scanning alerts, prints one line per setting and per open
// alert, and ends on one summary line. Each red line names its fix: the `--apply` command for a
// setting, the alert's link for an alert.
//
// --apply switches secret scanning and push protection on with one PATCH of `security_and_analysis`
// (it needs an admin's `gh`), then reads back as above.
// --repo names the repository; by default it is `repo.slug` of `.omni-loop/config.yml`, read from the
// working directory.
//
// The daily `security` workflow runs it with a read-only token, before any install: Node built-ins
// only.
//
// Exit codes: 0 both settings enabled and no alert open, 1 anything else (a setting off, an alert open,
// a read that failed, a bad argument).
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const USAGE = 'usage: node scripts/security-settings.ts [--apply] [--repo <owner/name>]';
const SETTINGS = ['secret_scanning', 'secret_scanning_push_protection'] as const;
type Setting = (typeof SETTINGS)[number];
const SLUG = /^[\w.-]+\/[\w.-]+$/;

export interface Args {
  apply: boolean;
  repo: string | null;
}

/** The arguments, or null when one is unknown, repeated or malformed. */
export function parseArgs(argv: string[]): Args | null {
  const args: Args = { apply: false, repo: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--apply' && !args.apply) args.apply = true;
    else if (arg === '--repo' && args.repo === null && SLUG.test(argv[i + 1] ?? '')) args.repo = argv[++i] ?? null;
    else return null;
  }
  return args;
}

/** `repo.slug` of a config file's text, or null. Reads the one key it needs, so it runs before any install. */
export function slugFromConfig(text: string): string | null {
  let inRepo = false;
  for (const line of text.split('\n')) {
    if (/^\S/.test(line)) inRepo = /^repo:\s*(#.*)?$/.test(line);
    else if (inRepo) {
      const match = /^\s+slug:\s*['"]?([^'"\s#]+)['"]?\s*(#.*)?$/.exec(line);
      if (match?.[1] && SLUG.test(match[1])) return match[1];
    }
  }
  return null;
}

interface Run {
  status: number | null;
  stdout: string;
  stderr: string;
}

function gh(args: string[], input?: string): Run {
  const run = spawnSync('gh', args, { encoding: 'utf8', input });
  if (run.error) return { status: 1, stdout: '', stderr: `gh: ${run.error.message}` };
  return { status: run.status, stdout: run.stdout, stderr: run.stderr };
}

/** Why a `gh` call failed, as its HTTP status when it printed one. */
function failure(run: Run): string {
  const status = /\(HTTP (\d{3})\)/.exec(run.stderr)?.[1];
  if (status) return `HTTP ${status}`;
  return run.stderr.trim().split('\n')[0] || `gh exited ${String(run.status)}`;
}

export type SettingsRead =
  | { kind: 'ok'; settings: Record<Setting, string> }
  | { kind: 'unreadable'; why: string }
  | { kind: 'hidden' };

export interface Alert {
  number: number;
  type: string;
  url: string;
}

export type AlertsRead = { kind: 'ok'; alerts: Alert[] } | { kind: 'disabled' } | { kind: 'unreadable'; why: string };

function field(value: unknown, key: string): unknown {
  return value && typeof value === 'object' ? (Reflect.get(value, key) as unknown) : undefined;
}

function readSettings(repo: string): SettingsRead {
  const run = gh(['api', `repos/${repo}`]);
  if (run.status !== 0) return { kind: 'unreadable', why: failure(run) };
  let json: unknown;
  try {
    json = JSON.parse(run.stdout);
  } catch {
    return { kind: 'unreadable', why: 'the answer was not JSON' };
  }
  const analysis = field(json, 'security_and_analysis');
  if (!analysis || typeof analysis !== 'object') return { kind: 'hidden' };
  const status = (setting: Setting): string => {
    const value = field(field(analysis, setting), 'status');
    return typeof value === 'string' ? value : 'missing';
  };
  return { kind: 'ok', settings: { secret_scanning: status('secret_scanning'), secret_scanning_push_protection: status('secret_scanning_push_protection') } };
}

function text(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

/** One alert of the `--jq '.[]'` answer, one JSON object per line. Throws on a line that is not JSON. */
function parseAlert(line: string): Alert {
  const alert: unknown = JSON.parse(line);
  const number = field(alert, 'number');
  return {
    number: typeof number === 'number' ? number : 0,
    type: text(field(alert, 'secret_type_display_name') ?? field(alert, 'secret_type'), 'unknown secret'),
    url: text(field(alert, 'html_url'), ''),
  };
}

function readAlerts(repo: string): AlertsRead {
  const run = gh(['api', '--paginate', '--jq', '.[]', `repos/${repo}/secret-scanning/alerts?state=open&per_page=100`]);
  if (run.status !== 0) {
    const why = failure(run);
    return why === 'HTTP 404' && /disabled/i.test(run.stderr) ? { kind: 'disabled' } : { kind: 'unreadable', why };
  }
  try {
    return { kind: 'ok', alerts: run.stdout.split('\n').filter((line) => line.trim()).map(parseAlert) };
  } catch {
    return { kind: 'unreadable', why: 'the answer was not JSON' };
  }
}

interface Part {
  text: string[];
  wrong: string[];
}

function settingsPart(repo: string, fix: string, read: SettingsRead): Part {
  if (read.kind === 'unreadable') {
    return { text: [`repository ${repo}: unreadable (${read.why}), check the token in GH_TOKEN`], wrong: [`repository unreadable (${read.why})`] };
  }
  if (read.kind === 'hidden') {
    return { text: ['security_and_analysis: unreadable, the token needs Administration: read'], wrong: ['settings unreadable'] };
  }
  const off = SETTINGS.filter((setting) => read.settings[setting] !== 'enabled');
  return {
    text: SETTINGS.map((setting) => (off.includes(setting) ? `${setting}: ${read.settings[setting]} → ${fix}` : `${setting}: enabled`)),
    wrong: off.map((setting) => `${setting} ${read.settings[setting]}`),
  };
}

function alertsPart(fix: string, alerts: AlertsRead): Part {
  if (alerts.kind === 'disabled') {
    return { text: [`open secret scanning alerts: unreadable, secret_scanning is disabled → ${fix}`], wrong: ['secret_scanning disabled'] };
  }
  if (alerts.kind === 'unreadable') {
    return {
      text: [`open secret scanning alerts: unreadable (${alerts.why}), the token needs Secret scanning alerts: read`],
      wrong: [`alerts unreadable (${alerts.why})`],
    };
  }
  const count = alerts.alerts.length;
  if (count === 0) return { text: ['open secret scanning alerts: none'], wrong: [] };
  return {
    text: [`open secret scanning alerts: ${String(count)}`, ...alerts.alerts.map((alert) => `alert #${String(alert.number)}: ${alert.type} → ${alert.url}`)],
    wrong: [`${String(count)} open alert${count === 1 ? '' : 's'}`],
  };
}

/** The report's lines, and whether it is green. `fix` is the `--apply` command for this repository. */
export function render({ repo, fix, read, alerts }: { repo: string; fix: string; read: SettingsRead; alerts: AlertsRead }): { ok: boolean; text: string[] } {
  const settings = settingsPart(repo, fix, read);
  const open = alertsPart(fix, alerts);
  // A disabled secret_scanning is named once in the summary, whether the settings or the alerts call saw it.
  const wrong = [...new Set([...settings.wrong, ...open.wrong])];
  const summary = wrong.length === 0 ? 'security settings: green' : `security settings: red: ${wrong.join(', ')}`;
  return { ok: wrong.length === 0, text: [...settings.text, ...open.text, summary] };
}

function apply(repo: string): string | null {
  const body = {
    security_and_analysis: {
      secret_scanning: { status: 'enabled' },
      secret_scanning_push_protection: { status: 'enabled' },
    },
  };
  const run = gh(['api', '-X', 'PATCH', `repos/${repo}`, '--input', '-'], JSON.stringify(body));
  return run.status === 0 ? null : `--apply: refused (${failure(run)}), it needs an admin of ${repo}`;
}

/** The repository: --repo, else repo.slug of the config in `cwd`, else null. */
function repoOf(args: Args, cwd: string): string | null {
  if (args.repo) return args.repo;
  try {
    return slugFromConfig(readFileSync(join(cwd, '.omni-loop', 'config.yml'), 'utf8'));
  } catch {
    return null;
  }
}

/** Applies when asked, then reads and prints the report; the exit code. */
function check(args: Args, repo: string): number {
  const refused = args.apply ? apply(repo) : null;
  const fix = `node scripts/security-settings.ts --apply${args.repo ? ` --repo ${args.repo}` : ''}`;
  const report = render({ repo, fix, read: readSettings(repo), alerts: readAlerts(repo) });
  console.log([refused, ...report.text].filter((line) => line !== null).join('\n'));
  return report.ok && !refused ? 0 : 1;
}

function main(argv: string[], cwd: string): number {
  const args = parseArgs(argv);
  if (!args) {
    console.error(USAGE);
    return 1;
  }
  const repo = repoOf(args, cwd);
  if (repo) return check(args, repo);
  console.error(`no repository: .omni-loop/config.yml has no repo.slug here; pass --repo <owner/name>\n${USAGE}`);
  return 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) process.exit(main(process.argv.slice(2), process.cwd()));
