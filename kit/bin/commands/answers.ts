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
import { CONFIG_FILE } from '../../lib/config.ts';
import { adoptedEntriesForPrd, findPrMarkerComment, openItemsForPrd, parseNumbersMarker } from '../../lib/outbox/comment.ts';
import { answerableQuestions, askBatches, writeReply } from '../../lib/outbox/answers.ts';
import { propertyOf } from '../../lib/narrow.ts';
import { githubClientFor } from '../github.ts';
import { parseArgs, positiveInt, println, readUserFile, repoSlug, usageError } from '../args.ts';
import type { Command, CommandIo, Out } from '../io.ts';
import type { CommentClient } from '../../lib/outbox/comment.ts';
import type { Context } from '../../lib/context.ts';

const USAGE =
  'usage: omni answers ask <prd> --pr <n> [--repo <owner/name>] [--json] | ' +
  'omni answers post --prd <n> --pr <n> --answers <file> [--repo <owner/name>] [--print]';

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

async function ask(args: string[], { ctx, stdout, stderr, exec, env }: CommandIo): Promise<number> {
  const { positional, flags } = parseArgs('answers', args, { values: ['pr', 'repo'], booleans: ['json'] });
  if (positional.length !== 1) throw usageError(USAGE);
  const prd = positiveInt('answers', '<prd>', positional[0]);
  const pr = positiveInt('answers', '--pr', flags.pr);
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
  const batches = askBatches({ numbering, items: openItemsForPrd(prd, { ctx }) });
  if (batches.length === 0) {
    return fail(stderr, `nothing to ask on PRD ${prd} — no open human-action or high question.`);
  }
  if (flags.json === true) println(stdout, JSON.stringify({ prd, pr, batches }, null, 2));
  else printBatches(stdout, batches);
  return 0;
}

async function post(args: string[], { ctx, stdout, stderr, exec, env }: CommandIo): Promise<number> {
  const { positional, flags } = parseArgs('answers', args, {
    values: ['prd', 'pr', 'repo', 'answers'],
    booleans: ['print'],
  });
  if (positional.length) throw usageError(USAGE);
  const prd = positiveInt('answers', '--prd', flags.prd);
  const pr = positiveInt('answers', '--pr', flags.pr);
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
  const questions = answerableQuestions({
    numbering: numbering ?? [],
    items: openItemsForPrd(prd, { ctx }),
    adopted: adoptedEntriesForPrd(prd, { ctx }),
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

export const answers: Command = {
  async run(args: string[], io: CommandIo) {
    const [verb, ...rest] = args;
    if (verb === 'ask') return ask(rest, io);
    if (verb === 'post') return post(rest, io);
    throw usageError(USAGE);
  },
};
