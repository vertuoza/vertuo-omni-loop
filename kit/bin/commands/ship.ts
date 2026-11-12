// `omni ship <prd>` — moves the PRD's inbox folder to shipped (its outbox inside it) and rewrites the
// paths that named them. Stages the moves; never commits. Exit 1 when refused, naming every reason;
// exit 2, one line, when the delivery folder holds uncommitted changes.
//
// PRD 2739, s3: before it moves anything, a PRD in the inbox has its review read through the loop's
// reads (`ship-review.ts`): a `later` care reply on its feature PR or a merged sub-PR with no follow-up
// file, or with no outbox item of its thread, is one more reason it refuses. When the threads cannot be
// read it prints one `not judged` line and exits 1: it never ships unchecked (BL-GATE-1).
import { applyShip, DirtyDeliveryError, movedPath } from '../../lib/delivery/ship.ts';
import { reviewPromises } from '../../lib/delivery/ship-review.ts';
import { loadContext } from '../../lib/context.ts';
import { errorMessage, parseArgs, prdArg, println, usageError } from '../args.ts';
import type { FreeCommand } from '../io.ts';
import { loopReadsFor } from './board.ts';
import type { TargetsIo } from './board.ts';

export const ship = {
  withoutContext: true,
  async run(args: string[], io: TargetsIo): Promise<number> {
    const { stdout, stderr, exec } = io;
    const { positional } = parseArgs('ship', args);
    if (positional.length !== 1) throw usageError('usage: omni ship <prd>');
    const prd = prdArg('ship', '<prd>', positional[0]);
    const ctx = loadContext(io.cwd, { exec });
    const review = ctx.layout.whereIs(prd)?.state === 'inbox' ? await reviewPromises(ctx, prd, loopReadsFor(ctx, io)) : { judged: true as const, reasons: [] };
    if (!review.judged) {
      println(stderr, `not judged: could not read the review threads of PRD ${prd}'s pull requests: ${review.why}`);
      return 1;
    }
    let plan;
    try {
      plan = applyShip(ctx, prd, { exec, held: review.reasons });
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
  },
} satisfies FreeCommand;
