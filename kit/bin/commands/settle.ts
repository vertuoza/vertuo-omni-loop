// `omni settle <item> --by --at --channel --number (--answer | --answer-file) [--url] [--verdict]` —
// settles one open outbox item: appends its settled entry and deletes the open file, through the
// PRD's outbox store (PRD 1548, s6).
// Ported from vertuo-ai-domain@c4a210122:scripts/outbox-settle.mjs (its CLI half) — changes in kit/porting/bin--commands.md.
import { relative } from 'node:path';
import { outboxStore } from '../../lib/outbox/stores.ts';
import { inRoot, parseArgs, println, readUserFile, usageError, withPrdFolder } from '../args.ts';
import type { Command, CommandIo } from '../io.ts';

const USAGE =
  'usage: omni settle <item-file> --by <who> --at <iso> --channel prd-issue|feature-pull-request ' +
  '--number <n> (--answer "<text>" | --answer-file <path>) [--url <u>] [--verdict agreed|drifted]';

/** The answer `omni settle` hands the store, from its flags and the answer's text. */
function answerOf(flags: Partial<Record<'by' | 'at' | 'channel' | 'number' | 'url' | 'verdict', string>>, text: string | undefined) {
  return {
    text: text ?? '',
    approvedBy: flags.by ?? '',
    approvedAt: flags.at ?? '',
    channel: {
      kind: flags.channel ?? '',
      number: flags.number ?? 0,
      ...(flags.url ? { url: flags.url } : {}),
    },
    ...(flags.verdict ? { statedVerdict: flags.verdict } : {}),
  };
}

export const settle: Command = {
  async run(args: string[], { ctx, stdout, stderr }: CommandIo): Promise<number> {
    const { positional, flags } = parseArgs('settle', args, {
      values: ['by', 'at', 'channel', 'number', 'answer', 'answer-file', 'url', 'verdict'],
    });
    const [path] = positional;
    if (positional.length !== 1 || path === undefined) throw usageError(USAGE);
    if (flags.answer !== undefined && flags['answer-file'] !== undefined) {
      throw usageError('omni settle: give --answer or --answer-file, not both.');
    }
    const file = relative(ctx.root, inRoot(ctx, path));
    const text = flags['answer-file'] ? readUserFile('settle', ctx, flags['answer-file']) : flags.answer;

    const answer = answerOf(flags, text);
    const result = await outboxStore(ctx)
      .settle(file, answer)
      .catch((error: unknown) => withPrdFolder('settle', () => { throw error; }));

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
