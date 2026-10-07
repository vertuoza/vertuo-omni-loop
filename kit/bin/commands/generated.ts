// `omni generated <range> [--json]` (PRD 1138): each output of the config's `generated` section, stale
// or fresh for a range's diff, with the build that rebuilds it. Read-only: the skills run the builds,
// never the kit. Exit 0 whatever it finds; `no generated files` (or `[]` with --json) when the config
// has no such section; exit 2 when the range is missing or git cannot read it.
import { rangePaths, staleness } from '../../lib/generated/stale.ts';
import { messageOf } from '../../lib/narrow.ts';
import { parseArgs, println, usageError } from '../args.ts';
import type { Command, CommandIo } from '../io.ts';
import { synchronous } from '../synchronous.ts';

const USAGE = 'usage: omni generated <range> [--json]';

/** The range's changed paths; a usage error naming the range when git cannot read it. */
function changedPaths({ ctx, exec }: CommandIo, range: string): string[] {
  try {
    return rangePaths({ root: ctx.root, range, exec });
  } catch (error) {
    throw usageError(`omni generated: cannot read ${range} — fetch it or pass another range. ${messageOf(error).split('\n')[0] ?? ''}`.trim());
  }
}

export const generated: Command = {
  run: synchronous((args: string[], io: CommandIo): number => {
    const { positional, flags } = parseArgs('generated', args, { booleans: ['json'] });
    const [range] = positional;
    if (positional.length !== 1 || range === undefined) throw usageError(USAGE);
    const entries = io.ctx.config.generated;
    if (entries === undefined || entries.length === 0) {
      println(io.stdout, flags.json ? '[]' : 'no generated files');
      return 0;
    }
    const states = staleness(entries, changedPaths(io, range));
    if (flags.json) println(io.stdout, JSON.stringify(states, null, 2));
    else for (const { path, stale, build } of states) println(io.stdout, `${path}: ${stale ? 'stale' : 'fresh'} — ${build}`);
    return 0;
  }),
};
