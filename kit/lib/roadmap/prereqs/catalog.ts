/**
 * **The base catalog** (PRD 1218, slice s2): the checks every roadmap may name as `base:<name>`, and
 * the few fixes the agent may run itself, keyed by the names the grade knows
 * (`PREREQUISITE_BASE_CHECKS`, `PREREQUISITE_BASE_FIXES`).
 *
 * A fix only touches what is inside the repository and can be undone: the install from the lockfile,
 * the loop's labels when `labels.autoCreate` is true, a missing `.env` copied from its example (never
 * over one). Nothing here installs software, starts a service, writes a secret or changes access.
 *
 * Every command goes through `env.shell` and every file through `env.files`, so a test stubs the
 * machine: no test runs Docker, an install or `gh`. A row's own shell `check` runs through `sh -c`
 * in the repository, within the same limit; a shell command is never a fix.
 */
import { loopLabels } from '../../init/labels.ts';
import type { LoopLabel } from '../../init/labels.ts';
import type { RoadmapPrerequisite } from '../parse.ts';
import { BASE_CARDS } from './cards.ts';
import type { BaseCard, BaseCheckName } from './cards.ts';
import { CHECK_LIMIT_MS, FIX_LIMIT_MS } from './run.ts';
import type { Outcome, Probes } from './run.ts';

/** What a command printed and how it ended; `code` is `null` when it was stopped. */
export type ShellResult = { code: number | null; stdout: string; stderr: string };

/** Runs one command, never through a shell unless `file` is one. */
export type Shell = (file: string, args: readonly string[], options: { cwd: string; timeoutMs: number }) => Promise<ShellResult>;

/** The repository's files, by path relative to its root. `copyNew` never overwrites: false when `to`
 * exists or the copy failed. */
export type RepoFiles = { exists(path: string): boolean; read(path: string): string | null; copyNew(from: string, to: string): boolean };

/** What a base check or fix runs against. `labels` is the config's `labels.*`. */
export type PrereqEnv = { root: string; shell: Shell; files: RepoFiles; labels: Readonly<Record<string, unknown>>; signedIn: () => boolean };

type Run = (env: PrereqEnv) => Promise<Outcome>;

/** One base check: its category and card, its check, and its fix when the agent may run one. */
type BaseEntry =BaseCard & { check: Run; fix?: Run };

const OK: Outcome = { ok: true };
const notOk = (detail: string): Outcome => ({ ok: false, detail });

/** The last line a command printed on stderr, else on stdout. */
function lastLine({ stdout, stderr }: ShellResult): string {
  const lines = (stderr.trim() === '' ? stdout : stderr).split('\n').map((line) => line.trim()).filter((line) => line !== '');
  return lines.at(-1) ?? '';
}

/** Why a command that did not exit 0 failed, in one line. */
function failure(line: string, result: ShellResult): string {
  const how = result.code === null ? 'was stopped' : `exited ${result.code}`;
  const last = lastLine(result);
  return last === '' ? `${line} ${how}` : `${line} ${how}: ${last}`;
}

/** Runs one command in the repository: ok on exit 0, else why not, naming it as `shown`. */
async function command(env: PrereqEnv, file: string, args: readonly string[], timeoutMs = CHECK_LIMIT_MS, shown = [file, ...args].join(' ')): Promise<{ result: ShellResult; outcome: Outcome }> {
  const result = await env.shell(file, args, { cwd: env.root, timeoutMs });
  return { result, outcome: result.code === 0 ? OK : notOk(failure(shown, result)) };
}

const exitsZero = (file: string, ...args: string[]): Run => async (env) => (await command(env, file, args)).outcome;

/** The package.json, parsed; `{}` when there is none or it is no object. */
function packageJson(env: PrereqEnv): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(env.files.read('package.json') ?? '{}');
    return typeof value === 'object' && value !== null ? { ...value } : {};
  } catch {
    return {};
  }
}

const ghAuth: Run = async (env) => {
  const result = await env.shell('gh', ['auth', 'status'], { cwd: env.root, timeoutMs: CHECK_LIMIT_MS });
  if (result.code !== 0) return notOk(`gh is not signed in: ${lastLine(result)}`);
  const scopes = /Token scopes:(.*)/.exec(`${result.stdout}\n${result.stderr}`)?.[1];
  return scopes === undefined || /'repo'/.test(scopes) ? OK : notOk('gh is signed in without the repo scope');
};

const VERSION = /(\d+)(?:\.(\d+))?(?:\.(\d+))?/;

/** The Node version the repository names: package.json's `engines.node`, `.nvmrc`, `.node-version`. */
function wantedNode(env: PrereqEnv): string | null {
  const engines = packageJson(env).engines;
  const fromEngines = typeof engines === 'object' && engines !== null && 'node' in engines ? engines.node : undefined;
  const candidates = [typeof fromEngines === 'string' ? fromEngines : null, env.files.read('.nvmrc'), env.files.read('.node-version')];
  for (const text of candidates) {
    const found = text === null ? null : VERSION.exec(text);
    if (found) return found[0];
  }
  return null;
}

/** `version`'s three numbers, missing ones as 0. */
const numbers = (version: string): number[] => {
  const found = VERSION.exec(version);
  return [found?.[1], found?.[2], found?.[3]].map((part) => Number(part ?? 0));
};

function atLeast(have: string, want: string): boolean {
  const [a, b] = [numbers(have), numbers(want)];
  for (let index = 0; index < 3; index += 1) {
    const diff = (a[index] ?? 0) - (b[index] ?? 0);
    if (diff !== 0) return diff > 0;
  }
  return true;
}

const node: Run = async (env) => {
  const { result, outcome } = await command(env, 'node', ['--version']);
  if (!outcome.ok) return outcome;
  const have = result.stdout.trim();
  const want = wantedNode(env);
  return want === null || atLeast(have, want) ? OK : notOk(`node is ${have}; the repository needs ${want} or later`);
};

const MANAGERS = ['pnpm', 'npm', 'yarn'] as const;
type Manager = (typeof MANAGERS)[number];
const LOCKFILES: readonly (readonly [string, Manager])[] = [['pnpm-lock.yaml', 'pnpm'], ['yarn.lock', 'yarn'], ['package-lock.json', 'npm'], ['npm-shrinkwrap.json', 'npm']];
const FROZEN_INSTALL: Record<Manager, readonly string[]> = { pnpm: ['install', '--frozen-lockfile'], yarn: ['install', '--frozen-lockfile'], npm: ['ci'] };

/** The repository's package manager: package.json's `packageManager`, else its lockfile's. */
function managerOf(env: PrereqEnv): Manager | null {
  const declared = packageJson(env).packageManager;
  const named = typeof declared === 'string' ? MANAGERS.find((name) => declared.startsWith(`${name}@`)) : undefined;
  if (named) return named;
  return LOCKFILES.find(([file]) => env.files.exists(file))?.[1] ?? null;
}

const installed: Run = (env) => {
  if (!env.files.exists('package.json') || env.files.exists('node_modules')) return Promise.resolve(OK);
  return Promise.resolve(notOk('the dependencies are not installed'));
};

const install: Run = async (env) => {
  const manager = managerOf(env);
  if (manager === null || !LOCKFILES.some(([file]) => env.files.exists(file))) return notOk('no lockfile to install from');
  return (await command(env, manager, FROZEN_INSTALL[manager], FIX_LIMIT_MS)).outcome;
};

const DEFAULT_REGISTRY = 'https://registry.npmjs.org/';

/** Every registry `.npmrc` names, scoped ones included, and the default one when it sets none. */
function registries(env: PrereqEnv): string[] {
  const lines = (env.files.read('.npmrc') ?? '').split('\n');
  const urls = (pattern: RegExp) => lines.map((line) => pattern.exec(line)?.[1]).filter((url) => url !== undefined);
  const main = urls(/^\s*registry\s*=\s*(\S+)/)[0] ?? DEFAULT_REGISTRY;
  return [...new Set([main, ...urls(/^\s*@[^:\s]+:registry\s*=\s*(\S+)/)])];
}

const registry: Run = async (env) => {
  for (const url of registries(env)) {
    const result = await env.shell('npm', ['ping', '--registry', url], { cwd: env.root, timeoutMs: CHECK_LIMIT_MS });
    if (result.code !== 0) return notOk(`the registry ${url} does not answer: ${lastLine(result)}`);
  }
  return OK;
};

const LABEL_LIST = ['label', 'list', '--json', 'name', '--limit', '1000'] as const;

/** The names of the labels `listed` holds, lower-cased; null when it is no JSON. */
function labelNames(listed: string): Set<string> | null {
  try {
    const value: unknown = JSON.parse(listed);
    const names = (Array.isArray(value) ? value : []).map((label: unknown) => (typeof label === 'object' && label !== null && 'name' in label ? String(label.name) : ''));
    return new Set(names.map((name) => name.toLowerCase()));
  } catch {
    return null;
  }
}

/** The loop labels the repository lacks, or why they could not be listed. */
async function missingLabels(env: PrereqEnv): Promise<LoopLabel[] | Outcome> {
  const { result, outcome } = await command(env, 'gh', LABEL_LIST);
  if (!outcome.ok) return outcome;
  const names = labelNames(result.stdout);
  if (names === null) return notOk('the label list could not be read');
  return loopLabels(env.labels).filter((label) => !names.has(label.name.toLowerCase()));
}

const labels: Run = async (env) => {
  const missing = await missingLabels(env);
  if (!Array.isArray(missing)) return missing;
  return missing.length === 0 ? OK : notOk(`missing labels: ${missing.map((label) => label.name).join(', ')}`);
};

const createLabels: Run = async (env) => {
  if (env.labels.autoCreate !== true) return notOk('labels.autoCreate is false: a person creates the labels');
  const missing = await missingLabels(env);
  if (!Array.isArray(missing)) return missing;
  for (const { name, color, description } of missing) {
    const { outcome } = await command(env, 'gh', ['label', 'create', name, '--color', color, '--description', description]);
    if (!outcome.ok) return outcome;
  }
  return OK;
};

const EXAMPLE = '.env.example';

/** Each tracked `.env.example` whose `.env` is missing, as `[example, env]`. */
async function missingEnvFiles(env: PrereqEnv): Promise<[string, string][] | Outcome> {
  const { result, outcome } = await command(env, 'git', ['ls-files', '--', EXAMPLE, `**/${EXAMPLE}`]);
  if (!outcome.ok) return outcome;
  const examples = [...new Set(result.stdout.split('\n').map((line) => line.trim()).filter((line) => line.endsWith(EXAMPLE)))];
  return examples.map((example): [string, string] => [example, `${example.slice(0, -EXAMPLE.length)}.env`]).filter(([, file]) => !env.files.exists(file));
}

const envFiles: Run = async (env) => {
  const missing = await missingEnvFiles(env);
  if (!Array.isArray(missing)) return missing;
  return missing.length === 0 ? OK : notOk(`missing: ${missing.map(([, file]) => file).join(', ')}`);
};

const copyEnvFiles: Run = async (env) => {
  const missing = await missingEnvFiles(env);
  if (!Array.isArray(missing)) return missing;
  const failed = missing.filter(([example, file]) => !env.files.copyNew(example, file)).map(([, file]) => file);
  return failed.length === 0 ? OK : notOk(`could not write: ${failed.join(', ')}`);
};

const signedIn: Run = (env) => Promise.resolve(env.signedIn() ? OK : notOk('not signed in to the Omni app'));

const CHECKS: Record<BaseCheckName, Run> = {
  'gh-auth': ghAuth,
  node,
  pnpm: exitsZero('pnpm', '--version'),
  npm: exitsZero('npm', '--version'),
  yarn: exitsZero('yarn', '--version'),
  install: installed,
  registry,
  docker: exitsZero('docker', 'info'),
  labels,
  'env-file': envFiles,
  'omni-signin': signedIn,
};

const FIXES: Partial<Record<BaseCheckName, Run>> = { install, labels: createLabels, 'env-file': copyEnvFiles };

/** Every base check, by name. */
export const BASE_CATALOG = Object.fromEntries(
  Object.entries(BASE_CARDS).map(([name, card]) => {
    const fix = FIXES[name as BaseCheckName];
    return [name, { ...card, check: CHECKS[name as BaseCheckName], ...(fix ? { fix } : {}) }];
  }),
) as Record<BaseCheckName, BaseEntry>;

const BASE = /^base:(.+)$/;

/** The catalog's entry `cell` names (`base:<name>`), or null. */
function baseEntry(cell: string): BaseEntry | null {
  const name = BASE.exec(cell)?.[1];
  return name !== undefined && Object.hasOwn(BASE_CATALOG, name) ? BASE_CATALOG[name as BaseCheckName] : null;
}

/** A row's check and fix against `env`: a base check or a shell command, and only a base fix. */
export function probesFor(prerequisite: RoadmapPrerequisite, env: PrereqEnv): Probes {
  const { check, fix } = prerequisite;
  if (check === null) return { check: null, fix: null };
  const fixRun = fix === null ? undefined : baseEntry(fix)?.fix;
  const fixProbe = fixRun ? () => fixRun(env) : null;
  if (!BASE.test(check)) return { check: async () => (await command(env, 'sh', ['-c', check], CHECK_LIMIT_MS, check)).outcome, fix: fixProbe };
  const entry = baseEntry(check);
  return { check: entry ? () => entry.check(env) : () => Promise.resolve(notOk(`${check} is no base check`)), fix: fixProbe };
}
