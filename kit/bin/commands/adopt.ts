// @ts-nocheck
// `omni adopt <item-text-file>` — adopts a medium item, at raise time or an already-open one: reads
// the file, appends its "Verdict: adopted" entry to its PRD's settled ledger, then removes the file
// it adopted — just as `omni settle` removes a settled one. Refuses a file that is not under the
// item's own PRD's outbox directory, leaving the tree untouched.
// Ported from vertuo-ai-domain@c4a210122:scripts/outbox-settle.mjs (its CLI half, `adopt`) — changes in kit/porting/bin--commands.md.
import { rmSync } from 'node:fs';
import { isAbsolute, relative } from 'node:path';
import { parseOutboxItem } from '../../lib/outbox/outbox.ts';
import { adoptItem } from '../../lib/outbox/settle.ts';
import { inRoot, parseArgs, println, readUserFile, usageError, withPrdFolder } from '../args.ts';

/** Whether `file` (absolute) sits inside `dir` (absolute) — itself does not count. */
function isUnder(dir, file) {
  const rel = relative(dir, file);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
}

export const adopt = {
  async run(args, { ctx, stdout, stderr }) {
    const { positional } = parseArgs('adopt', args);
    if (positional.length !== 1) throw usageError('usage: omni adopt <item-text-file>');
    const file = relative(ctx.root, inRoot(ctx, positional[0]));
    const itemText = readUserFile('adopt', ctx, positional[0]);

    // A malformed item is left for `adoptItem` itself to refuse (exit 1, "nothing was written") —
    // this guard only fires once the item parses, so it can name the PRD's own outbox directory.
    const parsedItem = parseOutboxItem(itemText, { file: null });
    if (parsedItem.ok) {
      const outboxDir = ctx.layout.outboxDir(parsedItem.item.prd);
      if (outboxDir !== null && !isUnder(inRoot(ctx, outboxDir), inRoot(ctx, positional[0]))) {
        throw usageError(`omni adopt: ${file} is not under ${outboxDir}, PRD ${parsedItem.item.prd}'s outbox directory.`);
      }
    }

    const result = withPrdFolder('adopt', () => adoptItem({ ctx, itemText }));
    if (!result.ok) {
      println(stderr, 'omni adopt — nothing was written:');
      for (const error of result.errors) println(stderr, `  - ${error}`);
      return 1;
    }
    rmSync(inRoot(ctx, positional[0]));
    println(
      stdout,
      `omni adopt — ${result.item.id} adopted; appended to ${result.settledFile}; removed ${file}. Commit the append and the deletion together.`,
    );
    return 0;
  },
};
