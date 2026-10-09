// `omni e2e status <n>` (PRD 1233, beta): the tests tagged `prd-<n>` under `e2e.dir`, each with whether
// it has a recording, as JSON. Exit 1 when one has none, when `e2e` is off, or when a recording does not
// read or is not `trace-1` (the message names the file); exit 2 for a usage error. It reads files only:
// no network, no browser, no model.
import type { ExecFileSyncOptionsWithStringEncoding } from 'node:child_process';
import { fillBranch } from '../../lib/board.ts';
import { compareRecordings, readRecordingsAt } from '../../lib/e2e/heals.ts';
import { confirmHeld, holdHealed, readLedgerAt, rejectHeld, withoutConfirmed } from '../../lib/e2e/hold.ts';
import { parseFolderName } from '../../lib/layout.ts';
import { screenshotsFor } from '../../lib/e2e/screenshots.ts';
import { RecordingError, readRecordings, readTaggedTests } from '../../lib/e2e/recording.ts';
import { testStatus } from '../../lib/e2e/status.ts';
import type { PrdNumber } from '../../lib/ids.ts';
import { messageOf } from '../../lib/narrow.ts';
import { parseArgs, prdArg, println, usageError } from '../args.ts';
import type { Command, CommandIo } from '../io.ts';
import { synchronous } from '../synchronous.ts';

// `omni e2e heals <n>` pairs the recordings' steps at the merge-base of the PRD's feature branch with
// the default branch and at the head (`--head <ref>`, the feature branch when absent); it exits 0, or 1
// on the same refusals. Each healed step carries `screenshots` (PRD 1274): the framework keeps none per
// step, so each side says why.
const USAGE = ['status <prd>', 'heals <prd> [--head <ref>]', 'hold <prd>', 'confirm <prd>', 'reject <prd>']
  .map((sub, i) => `${i === 0 ? 'usage:' : '      '} omni e2e ${sub}`)
  .join('\n');

function status(args: string[], { ctx, stdout, stderr }: CommandIo): number {
  const { positional } = parseArgs('e2e status', args);
  if (positional.length !== 1) throw usageError(USAGE);
  const prd = prdArg('e2e status', '<prd>', positional[0]);
  const { enabled, dir } = ctx.config.e2e;
  if (!enabled) {
    println(stderr, 'omni e2e: e2e.enabled is false in the config, so nothing was read');
    return 1;
  }
  try {
    const tests = testStatus(readTaggedTests(ctx.root, dir, prd), readRecordings(ctx.root, dir));
    println(stdout, JSON.stringify({ prd, dir, tests }, null, 2));
    return tests.some((test) => !test.recording) ? 1 : 0;
  } catch (error) {
    if (!(error instanceof RecordingError)) throw error;
    println(stderr, `omni e2e: ${messageOf(error)}`);
    return 1;
  }
}

const gitOptions = (root: string): ExecFileSyncOptionsWithStringEncoding => ({ cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

/** The first of `<remote>/<name>` and `<name>` that git knows, else a usage error. */
function resolveRef(name: string, { ctx, exec }: CommandIo, command: string): string {
  for (const ref of [`${ctx.config.repo.remote}/${name}`, name]) {
    try {
      exec('git', ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], gitOptions(ctx.root));
      return ref;
    } catch {
      // try the next
    }
  }
  throw usageError(`omni e2e ${command}: cannot find ref ${name} - fetch it first`);
}

/** The PRD's merge-base and head (`--head <ref>`, else the feature branch), or null (with a line on stderr) when e2e is off; a usage error otherwise. */
function range(command: string, args: string[], io: CommandIo): { prd: PrdNumber; dir: string; base: string; head: string } | null {
  const { ctx, stderr, exec } = io;
  const { positional, flags } = parseArgs(`e2e ${command}`, args, { values: ['head'] });
  if (positional.length !== 1) throw usageError(USAGE);
  const prd = prdArg(`e2e ${command}`, '<prd>', positional[0]);
  const { enabled, dir } = ctx.config.e2e;
  if (!enabled) {
    println(stderr, 'omni e2e: e2e.enabled is false in the config, so nothing was read');
    return null;
  }
  const where = ctx.layout.whereIs(prd);
  const parsed = where ? parseFolderName(where.name) : null;
  if (!parsed) throw usageError(`omni e2e ${command}: PRD ${prd} has no inbox or shipped folder`);
  const head = resolveRef(flags.head ?? fillBranch(ctx.config.branches.feature, { topic: parsed.topic }), io, command);
  const trunk = resolveRef(ctx.config.repo.defaultBranch, io, command);
  try {
    return { prd, dir, head, base: exec('git', ['merge-base', trunk, head], gitOptions(ctx.root)).trim() };
  } catch {
    throw usageError(`omni e2e ${command}: no merge-base between ${trunk} and ${head}`);
  }
}

/** Runs `act`, turning a recording that does not read into the one-line refusal. */
function refusing(io: CommandIo, act: () => number): number {
  try {
    return act();
  } catch (error) {
    if (!(error instanceof RecordingError)) throw error;
    println(io.stderr, `omni e2e: ${messageOf(error)}`);
    return 1;
  }
}

function heals(args: string[], io: CommandIo): number {
  const { ctx, stdout, exec } = io;
  const found = range('heals', args, io);
  if (!found) return 1;
  const { prd, dir, base, head } = found;
  return refusing(io, () => {
    const result = compareRecordings(
      readRecordingsAt({ root: ctx.root, rev: base, dir, exec }),
      readRecordingsAt({ root: ctx.root, rev: head, dir, exec }),
    );
    // A step a person confirmed (`omni e2e confirm`) and that has not changed since is not healed any more.
    const screenshots = screenshotsFor(ctx.root, dir);
    const healed = withoutConfirmed(result.healed, readLedgerAt({ root: ctx.root, rev: head, dir, exec })).map((step) => ({ ...step, screenshots }));
    println(stdout, JSON.stringify({ prd, base, head, ...result, healed }, null, 2));
    return 0;
  });
}

const summary = ({ testId, callIndex, file }: { testId: string; callIndex: number; file: string }) => ({ testId, callIndex, file });

// `omni e2e hold <n>` moves the healed recordings of the working tree out of the branch, `confirm` commits
// the held ones, `reject` drops them and exits 1 so the test stays red (PRD 1274).
function hold(args: string[], io: CommandIo): number {
  const { ctx, stdout, exec } = io;
  const found = range('hold', args, io);
  if (!found) return 1;
  return refusing(io, () => {
    const held = holdHealed({ root: ctx.root, dir: found.dir, prd: found.prd, base: found.base, exec });
    println(stdout, JSON.stringify({ prd: found.prd, held: held.map((entry) => ({ ...summary(entry), summary: entry.summary })) }, null, 2));
    return 0;
  });
}

function confirm(args: string[], io: CommandIo): number {
  const { ctx, stdout, exec } = io;
  const found = range('confirm', args, io);
  if (!found) return 1;
  const confirmed = confirmHeld({ root: ctx.root, dir: found.dir, prd: found.prd, exec });
  println(stdout, JSON.stringify({ prd: found.prd, confirmed: confirmed.map(summary) }, null, 2));
  return 0;
}

function reject(args: string[], io: CommandIo): number {
  const { ctx, stdout, exec } = io;
  const found = range('reject', args, io);
  if (!found) return 1;
  const rejected = rejectHeld({ root: ctx.root, dir: found.dir, prd: found.prd, exec });
  println(stdout, JSON.stringify({ prd: found.prd, rejected: rejected.map(summary) }, null, 2));
  return rejected.length === 0 ? 0 : 1;
}

export const e2e: Command = {
  run: synchronous((args: string[], io: CommandIo): number => {
    const [sub, ...rest] = args;
    if (sub === 'status') return status(rest, io);
    if (sub === 'heals') return heals(rest, io);
    if (sub === 'hold') return hold(rest, io);
    if (sub === 'confirm') return confirm(rest, io);
    if (sub === 'reject') return reject(rest, io);
    throw usageError(`${USAGE}\nomni e2e: unknown subcommand ${sub ?? '(none)'}`);
  }),
};
