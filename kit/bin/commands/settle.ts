// `omni settle <item> --by --at --channel --number (--answer | --answer-file) [--url] [--verdict]` —
// settles one open outbox item: appends its settled entry and deletes the open file, through the
// PRD's outbox store (PRD 1548, s6).
//
// `omni settle <item-id> --prd <key>-<n> (--answer | --answer-file) [--verdict] [--by] [--at]` (PRD 1548,
// s7) settles a product PRD's open item, a row on the Omni page, through the `server` store: the answer
// is recorded as given in the terminal by whoever is signed in, so `--channel` and `--number` name
// nothing there. While the server cannot be reached it holds, exit 1. It runs before a context exists,
// like `omni status`, so that a test can hand it `tokens`, `home`, `fetch`, `callMs` and `now`.
// Ported from vertuo-ai-domain@c4a210122:scripts/outbox-settle.mjs (its CLI half) — changes in kit/porting/bin--commands.md.
import { relative } from 'node:path';
import { loadContext } from '../../lib/context.ts';
import type { Context } from '../../lib/context.ts';
import { isProductPrdId } from '../../lib/ids.ts';
import type { ProductPrdId } from '../../lib/ids.ts';
import { serverFailure } from '../../lib/outbox/server-store.ts';
import { outboxStore } from '../../lib/outbox/stores.ts';
import type { OutboxSignIn } from '../../lib/outbox/stores.ts';
import { inRoot, parseArgs, prdIdArg, println, readUserFile, usageError, withPrdFolder } from '../args.ts';
import type { FreeCommand, FreeIo } from '../io.ts';

const USAGE =
  'usage: omni settle <item-file> --by <who> --at <iso> --channel prd-issue|feature-pull-request ' +
  '--number <n> (--answer "<text>" | --answer-file <path>) [--url <u>] [--verdict agreed|drifted] | ' +
  'omni settle <item-id> --prd <key>-<n> (--answer "<text>" | --answer-file <path>) [--verdict agreed|drifted]';

type Flags = Partial<Record<'by' | 'at' | 'channel' | 'number' | 'url' | 'verdict', string>>;

/** The answer `omni settle` hands the store, from its flags and the answer's text. */
function answerOf(flags: Flags, text: string | undefined) {
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

/** The answer to a product PRD's item: its text and verdict, and who approved it and when, if given. */
function productAnswerOf(flags: Flags, text: string | undefined) {
  return {
    text: text ?? '',
    ...(flags.by === undefined ? {} : { approvedBy: flags.by }),
    ...(flags.at === undefined ? {} : { approvedAt: flags.at }),
    ...(flags.verdict ? { statedVerdict: flags.verdict } : {}),
  };
}

/** The answer's text: `--answer`, or the file `--answer-file` names, never both. */
function answerText(flags: Partial<Record<'answer' | 'answer-file', string>>, ctx: Context): string | undefined {
  if (flags.answer !== undefined && flags['answer-file'] !== undefined) {
    throw usageError('omni settle: give --answer or --answer-file, not both.');
  }
  return flags['answer-file'] ? readUserFile('settle', ctx, flags['answer-file']) : flags.answer;
}

/** The product PRD `--prd` names, or null when it names a repository's PRD or none. */
function productOf(prd: string | undefined): ProductPrdId | null {
  const named = prd === undefined ? null : prdIdArg('settle', '--prd', prd);
  return named !== null && isProductPrdId(named) ? named : null;
}

/** What `omni settle` was asked: the product PRD (null for a repository's), the item, and the answer. */
function settleRequest(args: string[], ctx: Context) {
  const { positional, flags } = parseArgs('settle', args, {
    values: ['by', 'at', 'channel', 'number', 'answer', 'answer-file', 'url', 'verdict', 'prd'],
  });
  const [path] = positional;
  if (positional.length !== 1 || path === undefined) throw usageError(USAGE);
  const text = answerText(flags, ctx);
  const product = productOf(flags.prd);
  return product === null
    ? { product, file: relative(ctx.root, inRoot(ctx, path)), answer: answerOf(flags, text) }
    : { product, file: `${product}/${path}`, answer: productAnswerOf(flags, text) };
}

export const settle = {
  withoutContext: true,
  async run(args: string[], { cwd, stdout, stderr, exec, ...signIn }: FreeIo & OutboxSignIn): Promise<number> {
    const ctx = loadContext(cwd, { exec });
    const { product, file, answer } = settleRequest(args, ctx);
    const result = await outboxStore(ctx, product, signIn)
      .settle(file, answer)
      .catch((error: unknown) => withPrdFolder('settle', () => { throw error; }))
      .catch((error: unknown) => serverFailure('settle', error, stderr));
    if (typeof result === 'number') return result;

    if (!result.ok) {
      println(stderr, 'omni settle — nothing was written:');
      for (const error of result.errors) println(stderr, `  - ${error}`);
      return 1;
    }
    const where = product === null ? `appended to ${result.settledFile}. Commit the append and the deletion together.` : `recorded on ${result.settledFile}.`;
    println(stdout, `omni settle — ${result.removedFile} settled as "${result.verdict}" (${result.basis}); ${where}`);
    return 0;
  },
} satisfies FreeCommand;
