// `omni adopt <item-text-file>` — adopts a medium item at raise time: appends a "Verdict: adopted"
// entry to its PRD's settled ledger. Reads no open item file and deletes none.
// Ported from vertuo-ai-domain@c4a210122:scripts/outbox-settle.mjs (its CLI half, `adopt`) — changes in kit/porting/bin--commands.md.
import { readFileSync } from 'node:fs';
import { adoptItem } from '../../lib/outbox/settle.mjs';
import { inRoot, parseArgs, println, usageError } from '../args.mjs';

export const adopt = {
  async run(args, { ctx, stdout, stderr }) {
    const { positional } = parseArgs('adopt', args);
    if (positional.length !== 1) throw usageError('usage: omni adopt <item-text-file>');
    const itemText = readFileSync(inRoot(ctx, positional[0]), 'utf8');
    const result = adoptItem({ ctx, itemText });
    if (!result.ok) {
      println(stderr, 'omni adopt — nothing was written:');
      for (const error of result.errors) println(stderr, `  - ${error}`);
      return 1;
    }
    println(
      stdout,
      `omni adopt — ${result.item.id} adopted; appended to ${result.settledFile}. No open item file was read or written.`,
    );
    return 0;
  },
};
