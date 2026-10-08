// `omni e2e status <n>` (PRD 1233, beta): the tests tagged `prd-<n>` under `e2e.dir`, each with whether
// it has a recording, as JSON. Exit 1 when one has none, when `e2e` is off, or when a recording does not
// read or is not `trace-1` (the message names the file); exit 2 for a usage error. It reads files only:
// no network, no browser, no model.
import type { ExecFileSyncOptionsWithStringEncoding } from 'node:child_process';
import { fillBranch } from '../../lib/board.ts';
import { compareRecordings, readRecordingsAt } from '../../lib/e2e/heals.ts';
import { parseFolderName } from '../../lib/layout.ts';
import { RecordingError, readRecordings, readTaggedTests } from '../../lib/e2e/recording.ts';
import { testStatus } from '../../lib/e2e/status.ts';
import { messageOf } from '../../lib/narrow.ts';
import { parseArgs, prdArg, println, usageError } from '../args.ts';
import type { Command, CommandIo } from '../io.ts';
import { synchronous } from '../synchronous.ts';

// `omni e2e heals <n>` pairs the recordings' steps at the merge-base of the PRD's feature branch with
// the default branch and at the feature branch's head; it exits 0, or 1 on the same refusals.
const USAGE = 'usage: omni e2e status <prd>\n       omni e2e heals <prd>';

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
function resolveRef(name: string, { ctx, exec }: CommandIo): string {
  for (const ref of [`${ctx.config.repo.remote}/${name}`, name]) {
    try {
      exec('git', ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], gitOptions(ctx.root));
      return ref;
    } catch {
      // try the next
    }
  }
  throw usageError(`omni e2e heals: cannot find branch ${name} - fetch it first`);
}

function heals(args: string[], io: CommandIo): number {
  const { ctx, stdout, stderr, exec } = io;
  const { positional } = parseArgs('e2e heals', args);
  if (positional.length !== 1) throw usageError(USAGE);
  const prd = prdArg('e2e heals', '<prd>', positional[0]);
  const { enabled, dir } = ctx.config.e2e;
  if (!enabled) {
    println(stderr, 'omni e2e: e2e.enabled is false in the config, so nothing was read');
    return 1;
  }
  const where = ctx.layout.whereIs(prd);
  const parsed = where ? parseFolderName(where.name) : null;
  if (!parsed) throw usageError(`omni e2e heals: PRD ${prd} has no inbox or shipped folder`);
  const head = resolveRef(fillBranch(ctx.config.branches.feature, { topic: parsed.topic }), io);
  const trunk = resolveRef(ctx.config.repo.defaultBranch, io);
  let base: string;
  try {
    base = exec('git', ['merge-base', trunk, head], gitOptions(ctx.root)).trim();
  } catch {
    throw usageError(`omni e2e heals: no merge-base between ${trunk} and ${head}`);
  }
  try {
    const result = compareRecordings(
      readRecordingsAt({ root: ctx.root, rev: base, dir, exec }),
      readRecordingsAt({ root: ctx.root, rev: head, dir, exec }),
    );
    println(stdout, JSON.stringify({ prd, base, head, ...result }, null, 2));
    return 0;
  } catch (error) {
    if (!(error instanceof RecordingError)) throw error;
    println(stderr, `omni e2e: ${messageOf(error)}`);
    return 1;
  }
}

export const e2e: Command = {
  run: synchronous((args: string[], io: CommandIo): number => {
    const [sub, ...rest] = args;
    if (sub === 'status') return status(rest, io);
    if (sub === 'heals') return heals(rest, io);
    throw usageError(`${USAGE}\nomni e2e: unknown subcommand ${sub ?? '(none)'}`);
  }),
};
