// `omni ship <prd>` — moves the PRD's inbox folder to shipped (its outbox inside it) and rewrites the
// paths that named them. Stages the moves; never commits. Exit 1 when refused, naming every reason;
// exit 2, one line, when the delivery folder holds uncommitted changes.
//
// PRD 2739, s3: a `later` care reply whose item names a thread with no follow-up file is one more
// reason it refuses (`ship-review.ts`). BR-PRODUCT-130: it reads that from the repository alone, never
// the review threads, so a PRD with no review is never held by it.
import { applyShip, DirtyDeliveryError, movedPath } from '../../lib/delivery/ship.ts';
import { reviewPromises } from '../../lib/delivery/ship-review.ts';
import { errorMessage, parseArgs, prdArg, println, usageError } from '../args.ts';
import type { Command, CommandIo } from '../io.ts';
import { synchronous } from '../synchronous.ts';

export const ship: Command = {
  run: synchronous((args: string[], { ctx, stdout, stderr, exec }: CommandIo): number => {
    const { positional } = parseArgs('ship', args);
    if (positional.length !== 1) throw usageError('usage: omni ship <prd>');
    const prd = prdArg('ship', '<prd>', positional[0]);
    let plan;
    try {
      plan = applyShip(ctx, prd, { exec, held: reviewPromises(ctx, prd) });
    } catch (error) {
      if (error instanceof DirtyDeliveryError) throw usageError(`omni ship: ${error.message}.`);
      println(stderr, errorMessage(error));
      return 1;
    }
    const lines = [`omni ship — PRD ${prd}:`];
    for (const { from, to } of plan.moves) lines.push(`  moved ${from} → ${to}`);
    for (const { file } of plan.rewrites) lines.push(`  rewrote paths in ${movedPath(plan.moves, file)}`);
    lines.push('Review the diff and commit it on the feature branch.');
    println(stdout, lines.join('\n'));
    return 0;
  }),
};
