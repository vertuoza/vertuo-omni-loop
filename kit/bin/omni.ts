#!/usr/bin/env node
// omni — the kit's one entry point. Installed into a repository as .omni-loop/bin/omni.mjs (bundled),
// called by the skills and by the outbox workflow. Exit 0 ok, 1 red, 2 usage or configuration.
//
// Before a command runs, the one PRD or fix it names is recorded for the Claude session it runs in
// (PRD 324's spec, "The record", widened by PRD 1208's), so that the status line and `omni now` can
// show it on a branch that names none: when `CLAUDE_CODE_SESSION_ID` is set and safe,
// `../lib/statusline/sessions.ts` writes its kind and number in the main checkout. `omni bug <n>`
// and `omni dossier push <n> --kind bug` record bug `<n>`; `omni visual <n>` and
// `omni dossier push <n> --kind visual` record visual fix `<n>`; every other command naming a PRD
// records it as kind `prd`. `omni roadmap check <n>`, `omni roadmap push <n>` and
// `omni next --roadmap <n>` record roadmap `<n>` (PRD 1208's s3). A record that cannot be written is ignored: the command runs, prints and exits exactly as
// it does without one.
import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ConfigError } from '../lib/config.ts';
import { loadContext } from '../lib/context.ts';
import { processEnv, readEnv } from '../lib/env/read.ts';
import type { IssueNumber, PrdNumber } from '../lib/ids.ts';
import { propertyOf } from '../lib/narrow.ts';
import { handOver, planLaunch } from '../lib/launch/launch.ts';
import { recordSession } from '../lib/statusline/sessions.ts';
import type { RecordedWork } from '../lib/statusline/sessions.ts';
import { issueArg, prdArg } from './args.ts';
import { COMMAND_TABLE } from './commands/index.ts';
import type { Env, Exec, Out, Vars } from './io.ts';

const USAGE = `usage: omni <command> [args]\ncommands: ${Object.keys(COMMAND_TABLE).join(', ')}\nomni help: what each command does\n`;
// `omni --help` and `omni -h` are `omni help`; `omni --version` is `omni version`.
const HELP_FLAGS = ['--help', '-h'];
const VERSION_FLAG = '--version';
// The errors a command stops on with their first line and exit 2, by name: a bundle's copy of a class
// is not the source's.
const STOPPING_ERRORS = ['ConfigError', 'UsageError', 'EnvError'];

// The commands that name their PRD by position: the argument right after the command, or right after
// the subcommand listed here (`omni prd 7`, `omni dossier push 7`). Any command names one with
// `--prd <n>` as well.
const PRD_BY_POSITION: Readonly<Record<string, readonly string[]>> = Object.freeze({
  prd: [],
  board: [],
  status: [],
  phase0: [],
  ship: [],
  harvest: [],
  dossier: ['push'],
  plan: ['check'],
  rework: ['plan'],
});
const PRD_FLAG = '--prd';

// The fixes a command names: `omni bug <n>` and `omni visual <n>` by the command, `omni dossier push
// <n>` by its one `--kind`.
const FIX_KINDS = ['bug', 'visual'] as const;
type FixKind = (typeof FIX_KINDS)[number];
const KIND_FLAG = '--kind';
const PRD_KIND = 'prd';

// The roadmap a command names (PRD 1208's s3): `omni roadmap check <n>`, `omni roadmap push <n>`,
// `omni next --roadmap <n>`.
const ROADMAP_KIND = 'roadmap';
const ROADMAP_SUBCOMMANDS: readonly string[] = ['check', 'push'];
const ROADMAP_FLAG = '--roadmap';

// The file that runs this `omni`: the bundle when bundled (the build inlines this module into it),
// else this, the kit source's entry. `main()` hands it to the commands that start `omni` again, so
// that no library module names the command line by its path.
const self = fileURLToPath(import.meta.url);

/** `value` as a PRD number, read as the commands read it (`prdArg`), or `null`. */
function prdNumber(value: string | undefined): PrdNumber | null {
  try {
    return prdArg('record', '<prd>', value);
  } catch {
    return null;
  }
}

/** `value` as an issue number, read as the fix commands read it (`issueArg`), or `null`. */
function issueNumber(value: string | undefined): IssueNumber | null {
  try {
    return issueArg('record', '<n>', value);
  } catch {
    return null;
  }
}

const isFixKind = (value: unknown): value is FixKind => FIX_KINDS.some((kind) => kind === value);

/** `rest` without its `--kind <value>` pairs. */
function withoutKind(rest: readonly string[]): string[] {
  return rest.filter((arg, index) => arg !== KIND_FLAG && rest[index - 1] !== KIND_FLAG);
}

/** The fix of `kind` numbered `value`, or `null` when `value` is no issue number. */
function fixOf(kind: FixKind, value: string | undefined): RecordedWork | null {
  const number = issueNumber(value);
  return number === null ? null : { kind, number };
}

/** The fix `omni dossier push <n> --kind <kind>` names (`rest` after `dossier`): as `fixNamedBy`. */
function pushedFix(rest: readonly string[]): RecordedWork | null | undefined {
  const kinds = [...new Set(rest.filter((_arg, index) => rest[index - 1] === KIND_FLAG))];
  const [kind] = kinds;
  if (kinds.length !== 1) return kinds.length === 0 ? undefined : null;
  if (kind === PRD_KIND) return undefined;
  return isFixKind(kind) ? fixOf(kind, withoutKind(rest)[1]) : null;
}

/**
 * The fix `argv` (`[command, ...args]`) names: `{ kind, number }`, or `null` when it names a fix
 * kind with no issue number, or two kinds. `undefined` when the command names no fix at all: a PRD
 * may be named instead.
 */
function fixNamedBy([name = '', ...rest]: readonly string[]): RecordedWork | null | undefined {
  if (isFixKind(name)) return fixOf(name, rest[0]);
  return name === 'dossier' && rest[0] === 'push' ? pushedFix(rest) : undefined;
}

/**
 * The roadmap `argv` (`[command, ...args]`) names: `omni roadmap check <n>`, `omni roadmap push <n>`
 * and `omni next --roadmap <n>` (given once). `null` when it names one with no issue number;
 * `undefined` when the command names no roadmap at all.
 */
function roadmapNamedBy([name = '', ...rest]: readonly string[]): RecordedWork | null | undefined {
  let value: string | undefined;
  if (name === 'roadmap' && ROADMAP_SUBCOMMANDS.includes(rest[0] ?? '')) value = rest[1];
  else if (name === 'next' && rest.includes(ROADMAP_FLAG)) {
    const named = rest.filter((_arg, index) => rest[index - 1] === ROADMAP_FLAG);
    if (named.length !== 1) return null;
    value = named[0];
  } else return undefined;
  const number = issueNumber(value);
  return number === null ? null : { kind: ROADMAP_KIND, number };
}

/**
 * The one PRD, fix or roadmap `argv` (`[command, ...args]`) names, as `{ kind, number }`: the fix of
 * `omni bug`, `omni visual` and `omni dossier push --kind bug|visual`, the roadmap of
 * `omni roadmap check|push <n>` and `omni next --roadmap <n>`, else the PRD `prdNamedBy` reads, else
 * `null`.
 */
export function workNamedBy(argv: readonly string[]): RecordedWork | null {
  const fix = fixNamedBy(argv);
  if (fix !== undefined) return fix;
  const roadmap = roadmapNamedBy(argv);
  if (roadmap !== undefined) return roadmap;
  const prd = prdNamedBy(argv);
  return prd === null ? null : { kind: PRD_KIND, number: prd };
}

/**
 * The one PRD `argv` (`[command, ...args]`) names: the number at the command's position, and the
 * value of every `--prd`. `null` when none of them is a positive integer, or when they name two
 * different PRDs.
 */
export function prdNamedBy(argv: readonly string[]): PrdNumber | null {
  const [name = '', ...rest] = argv;
  const named: (string | undefined)[] = [];
  const subcommands = Object.hasOwn(PRD_BY_POSITION, name) ? PRD_BY_POSITION[name] : null;
  if (subcommands && subcommands.every((sub, index) => rest[index] === sub)) named.push(rest[subcommands.length]);
  rest.forEach((arg, index) => {
    if (arg === PRD_FLAG) named.push(rest[index + 1]);
  });
  const numbers = new Set(named.map(prdNumber).filter((number) => number !== null));
  return numbers.size === 1 ? ([...numbers][0] ?? null) : null;
}

/** Records the PRD or fix `argv` names for the Claude session `env` names; never throws, never prints. */
function recordWork(argv: readonly string[], { cwd, vars, exec }: { cwd: string; vars: Vars; exec: Exec }): void {
  try {
    const work = workNamedBy(argv);
    if (work !== null) recordSession({ cwd, exec, sessionId: vars.claudeSession?.id, kind: work.kind, number: work.number, now: Date.now() });
  } catch {
    // A record that cannot be written changes nothing: the command runs as it does without one.
  }
}

export async function main(
  argv: readonly string[],
  {
    cwd = process.cwd(),
    stdout = process.stdout,
    stderr = process.stderr,
    exec = execFileSync,
    env = processEnv(),
    ...more
  }: { cwd?: string; stdout?: Out; stderr?: Out; exec?: Exec; env?: Env; [option: string]: unknown } = {},
): Promise<number> {
  const [first = '', ...rest] = argv;
  const name = HELP_FLAGS.includes(first) ? 'help' : first === VERSION_FLAG ? 'version' : first;
  const command = Object.hasOwn(COMMAND_TABLE, name) ? COMMAND_TABLE[name] : undefined;
  if (!command) {
    stderr.write(USAGE);
    return 2;
  }
  try {
    // The environment is read once, here: a half-set or malformed setting stops every command with
    // one `EnvError` line, naming each variable concerned and never a value, before any work.
    const vars = readEnv(env);
    recordWork(argv, { cwd, vars, exec });
    // `init` runs before a config exists: it finds the root itself. `more` is its injected stdin,
    // bundle and prompt; an option left out keeps the command's own default. `script` is this
    // `omni`'s own file, which the status line's background refresh runs.
    if (command.withoutContext) return await command.run(rest, { cwd, stdout, stderr, exec, env, vars, script: self, ...more });
    const ctx = loadContext(cwd, { exec });
    return await command.run(rest, { ctx, stdout, stderr, exec, env, vars });
  } catch (error) {
    if (error instanceof ConfigError || (error instanceof Error && STOPPING_ERRORS.includes(error.name))) {
      stderr.write(`${error.message.split('\n')[0]}\n`);
      return 2;
    }
    throw error;
  }
}

// Run as a program (the global `omni` a person installs with npm, or this file), the entry is first a
// launcher (PRD 420, `../lib/launch/launch.ts`): a checkout with its own bin runs that bin instead,
// and outside a repository with the kit only the commands that need none run. `main()` never
// launches, so a repository's bin, which calls it, runs exactly as before.
const invoked = process.argv[1] && realpathSync(process.argv[1]) === realpathSync(self);
if (invoked) {
  const argv = process.argv.slice(2);
  const fail = (error: unknown) => {
    const stack = propertyOf(error, 'stack');
    process.stderr.write(`${typeof stack === 'string' ? stack : String(error)}\n`);
    process.exit(1);
  };
  try {
    const launch = planLaunch(argv, { self });
    if (launch.kind === 'handover') process.exit(handOver(launch.bin, argv));
    if (launch.kind === 'refuse') {
      process.stderr.write(`${launch.message}\n`);
      process.exit(2);
    }
    main(argv).then((code) => process.exit(code), fail);
  } catch (error) {
    fail(error);
  }
}
