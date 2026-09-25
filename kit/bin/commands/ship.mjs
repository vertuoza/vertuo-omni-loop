// `omni ship <prd>` — moves the PRD's inbox folder to shipped (its outbox inside it) and rewrites the
// paths that named them. Stages the moves; never commits. Exit 1 when refused, naming every reason;
// exit 2, one line, when the delivery folder holds uncommitted changes.
import { applyShip, DirtyDeliveryError } from '../../lib/delivery/ship.mjs';
import { parseArgs, positiveInt, println, usageError } from '../args.mjs';

export const ship = {
  async run(args, { ctx, stdout, stderr, exec }) {
    const { positional } = parseArgs('ship', args);
    if (positional.length !== 1) throw usageError('usage: omni ship <prd>');
    const prd = positiveInt('ship', '<prd>', positional[0]);
    let plan;
    try {
      plan = applyShip(ctx, prd, { exec });
    } catch (error) {
      if (error instanceof DirtyDeliveryError) throw usageError(`omni ship: ${error.message}.`);
      println(stderr, error.message);
      return 1;
    }
    const lines = [`omni ship — PRD ${prd}:`];
    for (const { from, to } of plan.moves) lines.push(`  moved ${from} → ${to}`);
    for (const { file } of plan.rewrites) lines.push(`  rewrote paths in ${file}`);
    lines.push('Review the diff and commit it on the feature branch.');
    println(stdout, lines.join('\n'));
    return 0;
  },
};
