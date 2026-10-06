// `omni care state <prd> [--pr <n>] [--repo <owner/name>]` — PRD 790: the care state of the PRD's
// feature PR, as one JSON document: its check rollup, mergeable state, review threads with their
// verdicts, the care line of its status comment, whether a wave holds claims on the feature branch,
// and the round `decideRound` draws from all that. One GraphQL read, plus the board's own reads.
// For a PRD of several landings it looks after the first landing PR still open, and carries the
// landings and the chain link to restack once the landing before it has merged (`landingChain`).
//
// `omni care reply --verdict <fixed|pushed-back|asked> (--body <text> | --file <path>) [--thread <id>]
// [--repo <owner/name>]` — the reply's body, ending with the care marker. Without --thread it only
// prints the body; with --thread it posts it on that review thread and, for fixed and pushed-back,
// resolves the thread (an asked thread stays open for the PM), then prints what it did as JSON.
import { landingChain, landingPrToWatch } from '../../lib/care/chain.ts';
import { decideRound } from '../../lib/care/decide.ts';
import type { LandingRow } from '../../lib/board.ts';
import { CARE_VERDICTS, careReplyBody } from '../../lib/care/marker.ts';
import { CARE_QUERY, CareResponseSchema, careState } from '../../lib/care/state.ts';
import type { Context } from '../../lib/context.ts';
import { fillBranch } from '../../lib/board.ts';
import { parseFolderName } from '../../lib/layout.ts';
import { isOneOf, propertyOf } from '../../lib/narrow.ts';
import { githubEnv } from '../github.ts';
import { parseArgs, prArg, prdArg, println, readUserFile, repoSlug, usageError } from '../args.ts';
import { buildBoard } from './board.ts';
import type { Command, CommandIo, Env, Exec } from '../io.ts';
import { GhGraphqlSchema, GhPrStatesSchema, GhReplyMutationSchema } from '../schema.ts';
import { synchronous } from '../synchronous.ts';
import type { PrdNumber } from '../../lib/ids.ts';

const USAGE =
  'usage: omni care state <prd> [--pr <n>] [--repo <owner/name>]\n' +
  '       omni care reply --verdict <fixed|pushed-back|asked> (--body <text> | --file <path>) [--thread <id>] [--repo <owner/name>]';

// The board states that mean a wave still holds a claim on the feature branch: an open sub-PR.
const CLAIM_STATES = new Set(['in-flight', 'claimed-stale']);

const REPLY_MUTATION = `mutation($thread: ID!, $body: String!) {
  addPullRequestReviewThreadReply(input: { pullRequestReviewThreadId: $thread, body: $body }) { comment { url } }
}`;
const RESOLVE_MUTATION = `mutation($thread: ID!) {
  resolveReviewThread(input: { threadId: $thread }) { thread { isResolved } }
}`;

/** One GraphQL call through `gh api graphql`, the request fed on stdin. Throws GitHub's first error. */
function graphql({ query, variables }: { query: string; variables: Record<string, unknown> }, { exec, env }: { exec: Exec; env: Env | undefined }): unknown {
  const raw = exec('gh', ['api', 'graphql', '--input', '-'], {
    encoding: 'utf8',
    input: JSON.stringify({ query, variables }),
    ...(env ? { env } : {}),
  });
  const parsed: unknown = JSON.parse(raw);
  const { errors } = GhGraphqlSchema.parse(parsed);
  const first = errors?.[0];
  if (first) throw Object.assign(new Error(first.message), { name: 'GitHubError' });
  return parsed;
}

function featureBranchFor(prd: PrdNumber, ctx: Context): string {
  const where = ctx.layout.whereIs(prd);
  const parsed = where ? parseFolderName(where.name) : null;
  if (parsed) return fillBranch(ctx.config.branches.feature, { topic: parsed.topic });
  throw usageError(where
    ? `omni care: cannot read a topic from folder "${where.name}".`
    : `omni care: PRD ${prd} has no inbox or shipped folder.`);
}

/** The feature PR's number: the open one on the feature branch, else the one updated last. */
function findFeaturePr({ repo, branch, exec, env }: { repo: string; branch: string; exec: Exec; env: Env | undefined }): number | null {
  const raw = exec(
    'gh',
    ['pr', 'list', '--repo', repo, '--head', branch, '--state', 'all', '--json', 'number,state,updatedAt', '--limit', '20'],
    { encoding: 'utf8', ...(env ? { env } : {}) },
  );
  const prs = GhPrStatesSchema.parse(JSON.parse(raw));
  const open = prs.find((pr) => pr.state === 'OPEN');
  if (open) return open.number;
  const latest = [...prs].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0];
  return latest?.number ?? null;
}

/** Whether a wave holds claims: `holdsClaims` is `null` when the board could not be read. */
function waveClaims(
  prd: PrdNumber,
  { ctx, exec, env, repo }: { ctx: Context; exec: Exec; env: Env; repo: string | undefined },
): { wave: { holdsClaims: boolean | null; claimed: string[]; unreadable?: string }; landings: LandingRow[] | null } {
  try {
    const { result } = buildBoard(prd, { ctx, exec, env, repo });
    const claimed = result.slices.filter((row) => CLAIM_STATES.has(row.state)).map((row) => row.id);
    return { wave: { holdsClaims: claimed.length > 0, claimed }, landings: result.landings ?? null };
  } catch (error) {
    return {
      wave: { holdsClaims: null, claimed: [], unreadable: String(propertyOf(error, 'message') ?? error).split('\n')[0] ?? '' },
      landings: null,
    };
  }
}

/** The pull request a round looks after: `--pr`'s, else the first open landing PR of a PRD of
 * several landings, else the feature PR `find` looks up. */
function watchedPr({ flag, landed, find }: { flag: string | undefined; landed: LandingRow[] | null; find: () => number | null }): number | null {
  if (flag !== undefined) return prArg('care', '--pr', flag);
  return landed === null ? find() : landingPrToWatch(landed);
}

function runState(args: string[], { ctx, stdout, stderr, exec, env }: CommandIo): number {
  const { positional, flags } = parseArgs('care', args, { values: ['pr', 'repo'] });
  if (positional.length !== 1) throw usageError(USAGE);
  const prd = prdArg('care', '<prd>', positional[0]);
  const repo = repoSlug('care', ctx, flags.repo);
  const branch = featureBranchFor(prd, ctx);
  const ghEnv = githubEnv(ctx, { exec, env });

  const { wave, landings } = waveClaims(prd, { ctx, exec, env, repo: flags.repo });
  const landed = landings !== null && landings.length > 1 ? landings : null;
  const number = watchedPr({ flag: flags.pr, landed, find: () => findFeaturePr({ repo, branch, exec, env: ghEnv }) });
  if (number === null) {
    const from = landed === null ? branch : landed.map((landing) => landing.branch).join(', ');
    println(stderr, `omni care: PRD ${prd} has no feature PR yet (no pull request from ${from}).`);
    return 1;
  }
  const [owner, name] = repo.split('/');
  const response = graphql({ query: CARE_QUERY, variables: { owner, name, number } }, { exec, env: ghEnv });
  const state = careState(CareResponseSchema.parse(response), {
    statusMarker: `<!-- ${ctx.config.markers.prefix}-status -->`,
    needsFixLabel: ctx.config.labels.needsFix,
    gateContexts: [ctx.config.ci.outboxContext, ctx.config.ci.inboxContext].filter(Boolean),
  });
  const chain = landed === null ? [] : landingChain(landed, ctx.config.repo.defaultBranch);
  const full = { prd, ...state, wave, ...(landed === null ? {} : { landings: landed, chain }) };
  println(stdout, JSON.stringify({ ...full, round: decideRound(full) }, null, 2));
  return 0;
}

/** The reply's body from `--verdict` and `--body` or `--file`, ending with the care marker. */
/** The flags `omni care reply` takes. */
type ReplyFlags = { verdict?: string; body?: string; file?: string; thread?: string; repo?: string };

function replyBodyOf(flags: ReplyFlags, ctx: Context): string {
  if (!isOneOf(CARE_VERDICTS, flags.verdict)) {
    throw usageError(`omni care reply: --verdict must be one of ${CARE_VERDICTS.join(', ')}.`);
  }
  if ((flags.body === undefined) === (flags.file === undefined)) {
    throw usageError('omni care reply: give the text with exactly one of --body or --file.');
  }
  const text = flags.body ?? readUserFile('care', ctx, flags.file ?? '');
  if (!text.trim()) throw usageError('omni care reply: the reply is empty.');
  return careReplyBody(text, flags.verdict ?? '');
}

function runReply(args: string[], io: CommandIo): number {
  const { ctx, stdout } = io;
  const { positional, flags } = parseArgs('care', args, { values: ['verdict', 'body', 'file', 'thread', 'repo'] });
  if (positional.length) throw usageError(USAGE);
  const body = replyBodyOf(flags, ctx);
  if (flags.thread === undefined) {
    println(stdout, body);
    return 0;
  }
  return postReply({ thread: flags.thread, verdict: flags.verdict ?? '', body }, io);
}

/** Posts the reply on its thread and resolves it unless asked; prints what it did as JSON. */
function postReply({ thread, verdict, body }: { thread: string; verdict: string; body: string }, { ctx, stdout, stderr, exec, env }: CommandIo): number {
  const ghEnv = githubEnv(ctx, { exec, env });
  try {
    const posted = GhReplyMutationSchema.parse(graphql({ query: REPLY_MUTATION, variables: { thread, body } }, { exec, env: ghEnv }));
    const resolve = verdict !== 'asked';
    if (resolve) graphql({ query: RESOLVE_MUTATION, variables: { thread } }, { exec, env: ghEnv });
    const url = posted.data?.addPullRequestReviewThreadReply?.comment?.url ?? null;
    println(stdout, JSON.stringify({ thread, verdict, url, resolved: resolve }));
    return 0;
  } catch (error) {
    if (!(error instanceof Error) || error.name !== 'GitHubError') throw error;
    println(stderr, `omni care reply: GitHub refused it: ${error.message}`);
    return 1;
  }
}

export const care: Command = {
  run: synchronous((args: string[], io: CommandIo): number => {
    const [sub, ...rest] = args;
    if (sub === 'state') return runState(rest, io);
    if (sub === 'reply') return runReply(rest, io);
    throw usageError(USAGE);
  }),
};
