// `omni answers ask <prd> --pr <n> [--repo owner/name] [--json]` and
// `omni answers post --prd <n> --pr <n> --answers <file> [--repo owner/name] [--print]` — the terminal
// door of an outbox (PRD 251).
//
// - `ask` reads the feature pull request's comments, takes the numbering from its outbox comment, and
//   prints the open `human-action` and `high` questions in batches of at most four, human action
//   first. Exit 1, one line, when nothing is open to ask or `answers.enabled` is false.
// - `post` reads the picks (a JSON array of `{ number, pick, reason?, text? }`) from a file, writes
//   the reply with the reply writer (`../../lib/outbox/answers.ts`), and posts it on the pull
//   request through the same client `omni replies` uses; it prints the comment's link. `--print`
//   prints the reply and posts nothing. Exit 1 when a pick is refused (nothing posted) or the post
//   fails (the reply is printed, to paste).
//
// Exit 2 is a usage error, or the kit not installed here.
//
// The open items and the adopted entries are read through the PRD's outbox store (PRD 1548, s6).
//
// On a product PRD (PRD 1548, s7), `omni answers ask <key>-<n>` and `omni answers post --prd <key>-<n>
// --answers <file>` need no pull request: the questions are its open rows on the Omni page, numbered
// worst first, and `post` settles each answered one there, as answered in the terminal
// (`../../lib/outbox/server-answers.ts`), printing one line per question settled; exit 1 when a pick
// is refused (nothing settled) or a question could not be settled. While the server cannot be reached
// each holds, exit 1, with the held line. Both run before a context exists, like `omni status`.
import { CONFIG_FILE } from '../../lib/config.ts';
import { findPrMarkerComment, parseNumbersMarker } from '../../lib/outbox/comment.ts';
import { loadContext } from '../../lib/context.ts';
import { isProductPrdId } from '../../lib/ids.ts';
import type { ProductPrdId } from '../../lib/ids.ts';
import { answerOnServer, serverNumbering } from '../../lib/outbox/server-answers.ts';
import { serverFailure } from '../../lib/outbox/server-store.ts';
import { outboxStore } from '../../lib/outbox/stores.ts';
import type { OutboxSignIn } from '../../lib/outbox/stores.ts';
import { answerableQuestions, askBatches, writeReply } from '../../lib/outbox/answers.ts';
import { propertyOf } from '../../lib/narrow.ts';
import { githubClientFor } from '../github.ts';
import { parseArgs, prArg, prdIdArg, println, readUserFile, repoSlug, usageError } from '../args.ts';
import type { FreeCommand, FreeIo, Out } from '../io.ts';
import type { CommentClient } from '../../lib/outbox/comment.ts';
import type { Context } from '../../lib/context.ts';

const USAGE =
  'usage: omni answers ask <prd> --pr <n> [--repo <owner/name>] [--json] | ' +
  'omni answers post --prd <n> --pr <n> --answers <file> [--repo <owner/name>] [--print] | ' +
  'omni answers ask <key>-<n> [--json] | omni answers post --prd <key>-<n> --answers <file>';

/** What a verb of `omni answers` runs on. */
type AnswersIo = { ctx: Context; stdout: Out; stderr: Out; exec: FreeIo['exec']; env: FreeIo['env']; signIn: OutboxSignIn };

/** A one-line refusal on stderr, exit 1. */
function fail(stderr: Out, message: string): number {
  stderr.write(`omni answers: ${message}\n`);
  return 1;
}

function firstLine(error: unknown): string {
  const message = propertyOf(error, 'message');
  return (String(message ?? error).split('\n')[0] ?? '').trim();
}

/** The numbering the pull request's outbox comment carries, or null when it has none yet. */
function numberingOf(ctx: Context, client: CommentClient) {
  const comments = client.listComments();
  const prComment = findPrMarkerComment(comments, ctx.markers);
  return prComment ? parseNumbersMarker(prComment.body, ctx.markers) : null;
}

function printBatches(stdout: Out, batches: ReturnType<typeof askBatches>): void {
  batches.forEach((batch, index) => {
    println(stdout, `Batch ${index + 1} of ${batches.length}`);
    for (const question of batch) {
      println(stdout, '');
      println(stdout, `${question.header} (${question.id})`);
      println(stdout, question.text);
      if (question.steps) println(stdout, question.steps.replace(/^/gm, '  '));
      for (const option of question.options) println(stdout, `  ${option.label} — ${option.text}`);
    }
    println(stdout, '');
  });
}

/** `omni answers ask <key>-<n>`: a product PRD's open questions, numbered worst first. */
async function askProduct(prd: ProductPrdId, asJson: boolean, { ctx, stdout, stderr, signIn }: AnswersIo): Promise<number> {
  const items = await outboxStore(ctx, prd, signIn).openItems(prd);
  const batches = askBatches({ numbering: serverNumbering(items), items });
  if (batches.length === 0) return fail(stderr, `nothing to ask on PRD ${prd} — no open human-action or high question.`);
  if (asJson) println(stdout, JSON.stringify({ prd, batches }, null, 2));
  else printBatches(stdout, batches);
  return 0;
}

async function ask(args: string[], io: AnswersIo): Promise<number> {
  const { ctx, stdout, stderr, exec, env } = io;
  const { positional, flags } = parseArgs('answers', args, { values: ['pr', 'repo'], booleans: ['json'] });
  if (positional.length !== 1) throw usageError(USAGE);
  const named = prdIdArg('answers', '<prd>', positional[0]);
  if (isProductPrdId(named)) return askProduct(named, flags.json === true, io).catch((error: unknown) => serverFailure('answers', error, stderr));
  const prd = named;
  const pr = prArg('answers', '--pr', flags.pr);
  const repo = repoSlug('answers', ctx, flags.repo);
  if (!ctx.config.answers.enabled) {
    return fail(stderr, `answers.enabled is false in ${CONFIG_FILE} — answer on the pull request.`);
  }

  let numbering;
  try {
    numbering = numberingOf(ctx, githubClientFor(ctx, { repo, issue: pr, exec, env }));
  } catch (error) {
    return fail(stderr, `could not read the comments of pull request #${pr} (${firstLine(error)}).`);
  }
  if (numbering === null) {
    return fail(stderr, `pull request #${pr} carries no outbox comment yet — nothing to ask.`);
  }
  const batches = askBatches({ numbering, items: await outboxStore(ctx).openItems(prd) });
  if (batches.length === 0) {
    return fail(stderr, `nothing to ask on PRD ${prd} — no open human-action or high question.`);
  }
  if (flags.json === true) println(stdout, JSON.stringify({ prd, pr, batches }, null, 2));
  else printBatches(stdout, batches);
  return 0;
}

/** `omni answers post --prd <key>-<n> --answers <file>`: settles the answered questions on the Omni page. */
async function postProduct(prd: ProductPrdId, source: string, named: string, { ctx, stdout, stderr, signIn }: AnswersIo): Promise<number> {
  let picks: unknown;
  try {
    picks = JSON.parse(source);
  } catch {
    return fail(stderr, `refused — ${named} is not JSON.`);
  }
  const answered = await answerOnServer({ store: outboxStore(ctx, prd, signIn), prd, picks });
  if (!answered.ok) return fail(stderr, `refused — ${answered.reason}`);
  for (const { number, id, verdict } of answered.settled) println(stdout, `${number}: ${id} settled as "${verdict}"`);
  for (const { number, id, errors } of answered.failed) stderr.write(`omni answers: ${number}: ${id} not settled — ${errors.join('; ')}\n`);
  return answered.failed.length > 0 ? 1 : 0;
}

async function post(args: string[], io: AnswersIo): Promise<number> {
  const { ctx, stdout, stderr, exec, env } = io;
  const { positional, flags } = parseArgs('answers', args, {
    values: ['prd', 'pr', 'repo', 'answers'],
    booleans: ['print'],
  });
  if (positional.length) throw usageError(USAGE);
  const named = prdIdArg('answers', '--prd', flags.prd);
  if (isProductPrdId(named)) {
    if (typeof flags.answers !== 'string' || flags.pr !== undefined || flags.print === true) throw usageError(USAGE);
    const source = readUserFile('answers', ctx, flags.answers);
    return postProduct(named, source, flags.answers, io).catch((error: unknown) => serverFailure('answers', error, stderr));
  }
  const prd = named;
  const pr = prArg('answers', '--pr', flags.pr);
  const repo = repoSlug('answers', ctx, flags.repo);
  if (typeof flags.answers !== 'string') throw usageError(`omni answers: --answers <file> is required. ${USAGE}`);
  const source = readUserFile('answers', ctx, flags.answers);

  let picks: unknown;
  try {
    picks = JSON.parse(source);
  } catch {
    return fail(stderr, `refused — ${flags.answers} is not JSON.`);
  }

  const client = githubClientFor(ctx, { repo, issue: pr, exec, env });
  let numbering;
  try {
    numbering = numberingOf(ctx, client);
  } catch (error) {
    return fail(stderr, `could not read the comments of pull request #${pr} (${firstLine(error)}).`);
  }
  const store = outboxStore(ctx);
  const questions = answerableQuestions({
    numbering: numbering ?? [],
    items: await store.openItems(prd),
    adopted: await store.adoptedEntries(prd),
  });
  const written = writeReply({ prd, door: 'terminal', questions, picks });
  if (!written.ok) return fail(stderr, `refused — ${written.reason}`);

  if (flags.print === true) {
    println(stdout, written.reply);
    return 0;
  }
  let comment;
  try {
    comment = client.createComment(written.reply);
  } catch (error) {
    stderr.write(`omni answers: the reply was not posted (${firstLine(error)}). Paste it on pull request #${pr}:\n`);
    println(stdout, written.reply);
    return 1;
  }
  println(stdout, comment?.html_url ?? `posted on pull request #${pr}`);
  return 0;
}

export const answers = {
  withoutContext: true,
  async run(args: string[], { cwd, stdout, stderr, exec, env, ...signIn }: FreeIo & OutboxSignIn): Promise<number> {
    const [verb, ...rest] = args;
    if (verb !== 'ask' && verb !== 'post') throw usageError(USAGE);
    const io = { ctx: loadContext(cwd, { exec }), stdout, stderr, exec, env, signIn };
    return verb === 'ask' ? ask(rest, io) : post(rest, io);
  },
} satisfies FreeCommand;
