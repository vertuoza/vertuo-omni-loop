// `omni e2e status <n>` (PRD 1233, beta): the tests tagged `prd-<n>` under `e2e.dir`, each with whether
// it has a recording, as JSON. Exit 1 when one has none, when `e2e` is off, or when a recording does not
// read or is not `trace-1` (the message names the file); exit 2 for a usage error. It reads files only:
// no network, no browser, no model.
import { RecordingError, readRecordings, readTaggedTests } from '../../lib/e2e/recording.ts';
import { testStatus } from '../../lib/e2e/status.ts';
import { messageOf } from '../../lib/narrow.ts';
import { parseArgs, prdArg, println, usageError } from '../args.ts';
import type { Command, CommandIo } from '../io.ts';
import { synchronous } from '../synchronous.ts';

const USAGE = 'usage: omni e2e status <prd>';

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

export const e2e: Command = {
  run: synchronous((args: string[], io: CommandIo): number => {
    const [sub, ...rest] = args;
    if (sub === 'status') return status(rest, io);
    throw usageError(`${USAGE}\nomni e2e: unknown subcommand ${sub ?? '(none)'}`);
  }),
};
