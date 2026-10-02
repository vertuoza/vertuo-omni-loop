// `omni ship <prd>` — moves the PRD's inbox folder to shipped (its outbox inside it) and rewrites the
// paths that named them. Stages the moves; never commits. Exit 1 when refused, naming every reason;
// exit 2, one line, when the delivery folder holds uncommitted changes.
import { applyShip, DirtyDeliveryError, movedPath } from '../../lib/delivery/ship.ts';
import { parseArgs, positiveInt, println, usageError } from '../args.ts';
import type { Command, CommandIo } from '../io.ts';

export const ship: Command = {
  async run(args: string[], { ctx, stdout, stderr, exec }: CommandIo) {
    const { positional } = parseArgs('ship', args);
    if (positional.length !== 1) throw usageError('usage: omni ship <prd>');
    const prd = positiveInt('ship', '<prd>', positional[0]);
    let plan;
    try {
      plan = applyShip(ctx, prd, { exec });
    } catch (error) {
      if (error instanceof DirtyDeliveryError) throw usageError(`omni ship: ${error.message}.`);
      println(stderr, (error as Error).message); // ts-allow: applyShip throws only Error
      return 1;
    }
    const lines = [`omni ship — PRD ${prd}:`];
    for (const { from, to } of plan.moves) lines.push(`  moved ${from} → ${to}`);
    for (const { file } of plan.rewrites) lines.push(`  rewrote paths in ${movedPath(plan.moves, file)}`);
    lines.push('Review the diff and commit it on the feature branch.');
    println(stdout, lines.join('\n'));
    return 0;
  },
};
