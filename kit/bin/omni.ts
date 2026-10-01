#!/usr/bin/env node
// @ts-nocheck
// omni — the kit's one entry point. Installed into a repository as .omni-loop/bin/omni.mjs (bundled),
// called by the skills and by the outbox workflow. Exit 0 ok, 1 red, 2 usage or configuration.
//
// Before a command runs, the one PRD it names is recorded for the Claude session it runs in (PRD
// 324's spec, "The record"), so that the status line can show it on a branch that names no PRD: when
// `CLAUDE_CODE_SESSION_ID` is set and safe, `../lib/statusline/sessions.ts` writes it in the main
// checkout. A record that cannot be written is ignored: the command runs, prints and exits exactly as
// it does without one.
import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ConfigError } from '../lib/config.ts';
import { loadContext } from '../lib/context.ts';
import { handOver, planLaunch } from '../lib/launch/launch.ts';
import { recordSession } from '../lib/statusline/sessions.ts';
import { positiveInt } from './args.ts';
import { COMMAND_TABLE } from './commands/index.ts';

const USAGE = `usage: omni <command> [args]\ncommands: ${Object.keys(COMMAND_TABLE).join(', ')}\nomni help: what each command does\n`;
// `omni --help` and `omni -h` are `omni help`; `omni --version` is `omni version`.
const HELP_FLAGS = ['--help', '-h'];
const VERSION_FLAG = '--version';

// The commands that name their PRD by position: the argument right after the command, or right after
// the subcommand listed here (`omni prd 7`, `omni dossier push 7`). Any command names one with
// `--prd <n>` as well.
const PRD_BY_POSITION = Object.freeze({
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

/** `value` as a PRD number, read as the commands read it (`positiveInt`), or `null`. */
function prdNumber(value) {
  try {
    return positiveInt('record', '<prd>', value);
  } catch {
    return null;
  }
}

/**
 * The one PRD `argv` (`[command, ...args]`) names: the number at the command's position, and the
 * value of every `--prd`. `null` when none of them is a positive integer, or when they name two
 * different PRDs.
 */
export function prdNamedBy(argv) {
  const [name, ...rest] = argv;
  const named = [];
  const subcommands = Object.hasOwn(PRD_BY_POSITION, name ?? '') ? PRD_BY_POSITION[name] : null;
  if (subcommands && subcommands.every((sub, index) => rest[index] === sub)) named.push(rest[subcommands.length]);
  rest.forEach((arg, index) => {
    if (arg === PRD_FLAG) named.push(rest[index + 1]);
  });
  const numbers = new Set(named.map(prdNumber).filter((number) => number !== null));
  return numbers.size === 1 ? [...numbers][0] : null;
}

/** Records the PRD `argv` names for the Claude session `env` names; never throws, never prints. */
function recordPrd(argv, { cwd, env, exec }) {
  try {
    const prd = prdNamedBy(argv);
    if (prd !== null) recordSession({ cwd, exec, sessionId: env?.CLAUDE_CODE_SESSION_ID, prd, now: Date.now() });
  } catch {
    // A record that cannot be written changes nothing: the command runs as it does without one.
  }
}

export async function main(
  argv,
  { cwd = process.cwd(), stdout = process.stdout, stderr = process.stderr, exec = execFileSync, env = process.env, ...more } = {},
) {
  const [first, ...rest] = argv;
  const name = HELP_FLAGS.includes(first) ? 'help' : first === VERSION_FLAG ? 'version' : first;
  const command = Object.hasOwn(COMMAND_TABLE, name ?? '') ? COMMAND_TABLE[name] : undefined;
  if (!command) {
    stderr.write(USAGE);
    return 2;
  }
  recordPrd(argv, { cwd, env, exec });
  try {
    // `init` runs before a config exists: it finds the root itself. `more` is its injected stdin,
    // bundle and prompt; an option left out keeps the command's own default.
    if (command.withoutContext) return await command.run(rest, { cwd, stdout, stderr, exec, env, ...more });
    const ctx = loadContext(cwd, { exec });
    return await command.run(rest, { ctx, stdout, stderr, exec, env });
  } catch (error) {
    if (error instanceof ConfigError || error?.name === 'ConfigError' || error?.name === 'UsageError') {
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
const self = fileURLToPath(import.meta.url);
const invoked = process.argv[1] && realpathSync(process.argv[1]) === realpathSync(self);
if (invoked) {
  const argv = process.argv.slice(2);
  const fail = (error) => {
    process.stderr.write(`${error?.stack ?? error}\n`);
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
