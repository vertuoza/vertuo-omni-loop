// `omni settle <item> --by --at --channel --number (--answer | --answer-file) [--url] [--verdict]` —
// settles one open outbox item: appends its settled entry and deletes the open file.
// Ported from vertuo-ai-domain@c4a210122:scripts/outbox-settle.mjs (its CLI half) — changes in kit/porting/bin--commands.md.
import { relative } from 'node:path';
import { settleItem } from '../../lib/outbox/settle.mjs';
import { inRoot, parseArgs, println, readUserFile, usageError, withPrdFolder } from '../args.mjs';

const USAGE =
  'usage: omni settle <item-file> --by <who> --at <iso> --channel prd-issue|feature-pull-request ' +
  '--number <n> (--answer "<text>" | --answer-file <path>) [--url <u>] [--verdict agreed|drifted]';

export const settle = {
  async run(args, { ctx, stdout, stderr }) {
    const { positional, flags } = parseArgs('settle', args, {
      values: ['by', 'at', 'channel', 'number', 'answer', 'answer-file', 'url', 'verdict'],
    });
    if (positional.length !== 1) throw usageError(USAGE);
    if (flags.answer !== undefined && flags['answer-file'] !== undefined) {
      throw usageError('omni settle: give --answer or --answer-file, not both.');
    }
    const file = relative(ctx.root, inRoot(ctx, positional[0]));
    const text = flags['answer-file'] ? readUserFile('settle', ctx, flags['answer-file']) : flags.answer;

    const result = withPrdFolder('settle', () => settleItem({
      ctx,
      file,
      answer: {
        text: text ?? '',
        approvedBy: flags.by ?? '',
        approvedAt: flags.at ?? '',
        channel: {
          kind: flags.channel ?? '',
          number: flags.number ?? 0,
          ...(flags.url ? { url: flags.url } : {}),
        },
        ...(flags.verdict ? { statedVerdict: flags.verdict } : {}),
      },
    }));

    if (!result.ok) {
      println(stderr, 'omni settle — nothing was written:');
      for (const error of result.errors) println(stderr, `  - ${error}`);
      return 1;
    }
    println(
      stdout,
      `omni settle — ${result.removedFile} settled as "${result.verdict}" (${result.basis}); appended to ${result.settledFile}. Commit the append and the deletion together.`,
    );
    return 0;
  },
};
