// `omni dashboard [--fetch]` — the repository's overview, read from git: exactly what `omni status`
// prints with no PRD number (PRD 2906, slice s3). `/omni:dashboard` runs it. `omni status` keeps its
// overview and its outbox gate; this command only names the overview, and refuses a PRD number,
// which belongs to the gate.
import { parseArgs, usageError } from '../args.ts';
import type { FreeCommand, FreeIo } from '../io.ts';
import { status } from './status.ts';

const USAGE = 'usage: omni dashboard [--fetch]';

export const dashboard = {
  withoutContext: true,
  run(args: string[], io: FreeIo) {
    const { positional, flags } = parseArgs('dashboard', args, { booleans: ['fetch'] });
    if (positional.length > 0) throw usageError(USAGE);
    return status.run(flags.fetch === true ? ['--fetch'] : [], io);
  },
} satisfies FreeCommand;
