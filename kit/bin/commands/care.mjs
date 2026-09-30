// `omni care state <prd> [--pr <n>] [--repo <owner/name>]` — PRD 790: the care state of the PRD's
// feature PR, as one JSON document: its check rollup, mergeable state, review threads with their
// verdicts, the care line of its status comment, whether a wave holds claims on the feature branch,
// and the round `decideRound` draws from all that. One GraphQL read, plus the board's own reads.
//
// `omni care reply --verdict <fixed|pushed-back|asked> (--body <text> | --file <path>) [--thread <id>]
// [--repo <owner/name>]` — the reply's body, ending with the care marker. Without --thread it only
// prints the body; with --thread it posts it on that review thread and, for fixed and pushed-back,
// resolves the thread (an asked thread stays open for the PM), then prints what it did as JSON.
import { execFileSync } from 'node:child_process';
import { decideRound } from '../../lib/care/decide.mjs';
import { CARE_VERDICTS, careReplyBody } from '../../lib/care/marker.mjs';
import { CARE_QUERY, careState } from '../../lib/care/state.mjs';
import { fillBranch } from '../../lib/board.mjs';
import { parseFolderName } from '../../lib/layout.mjs';
import { githubEnv } from '../github.mjs';
import { parseArgs, positiveInt, println, readUserFile, repoSlug, usageError } from '../args.mjs';
import { buildBoard } from './board.mjs';

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
function graphql({ query, variables }, { exec, env }) {
  const raw = exec('gh', ['api', 'graphql', '--input', '-'], {
    encoding: 'utf8',
    input: JSON.stringify({ query, variables }),
    ...(env ? { env } : {}),
  });
  const parsed = JSON.parse(raw);
  if (parsed.errors?.length) throw Object.assign(new Error(parsed.errors[0].message), { name: 'GitHubError' });
  return parsed;
}

function featureBranchFor(prd, ctx) {
  const where = ctx.layout.whereIs(prd);
  if (!where) throw usageError(`omni care: PRD ${prd} has no inbox or shipped folder.`);
  const parsed = parseFolderName(where.name);
  if (!parsed) throw usageError(`omni care: cannot read a topic from folder "${where.name}".`);
  return fillBranch(ctx.config.branches.feature, { topic: parsed.topic });
}

/** The feature PR's number: the open one on the feature branch, else the one updated last. */
function findFeaturePr({ repo, branch, exec, env }) {
  const raw = exec(
    'gh',
    ['pr', 'list', '--repo', repo, '--head', branch, '--state', 'all', '--json', 'number,state,updatedAt', '--limit', '20'],
    { encoding: 'utf8', ...(env ? { env } : {}) },
  );
  const prs = JSON.parse(raw);
  const open = prs.find((pr) => pr.state === 'OPEN');
  if (open) return open.number;
  const latest = [...prs].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0];
  return latest?.number ?? null;
}

/** Whether a wave holds claims: `holdsClaims` is `null` when the board could not be read. */
function waveClaims(prd, { ctx, exec, env, repo }) {
  try {
    const { result } = buildBoard(prd, { ctx, exec, env, repo });
    const claimed = result.slices.filter((row) => CLAIM_STATES.has(row.state)).map((row) => row.id);
    return { holdsClaims: claimed.length > 0, claimed };
  } catch (error) {
    return { holdsClaims: null, claimed: [], unreadable: String(error?.message ?? error).split('\n')[0] };
  }
}

function runState(args, { ctx, stdout, stderr, exec, env }) {
  const { positional, flags } = parseArgs('care', args, { values: ['pr', 'repo'] });
  if (positional.length !== 1) throw usageError(USAGE);
  const prd = positiveInt('care', '<prd>', positional[0]);
  const repo = repoSlug('care', ctx, flags.repo);
  const branch = featureBranchFor(prd, ctx);
  const ghEnv = githubEnv(ctx, { exec, env });

  const number = flags.pr !== undefined ? positiveInt('care', '--pr', flags.pr) : findFeaturePr({ repo, branch, exec, env: ghEnv });
  if (number === null) {
    println(stderr, `omni care: PRD ${prd} has no feature PR yet (no pull request from ${branch}).`);
    return 1;
  }
  const [owner, name] = repo.split('/');
  const response = graphql({ query: CARE_QUERY, variables: { owner, name, number } }, { exec, env: ghEnv });
  const state = careState(response, {
    statusMarker: `<!-- ${ctx.config.markers.prefix}-status -->`,
    needsFixLabel: ctx.config.labels.needsFix,
    gateContexts: [ctx.config.ci.outboxContext, ctx.config.ci.inboxContext].filter(Boolean),
  });
  const wave = waveClaims(prd, { ctx, exec, env, repo: flags.repo });
  const full = { prd, ...state, wave };
  println(stdout, JSON.stringify({ ...full, round: decideRound(full) }, null, 2));
  return 0;
}

function runReply(args, { ctx, stdout, stderr, exec, env }) {
  const { positional, flags } = parseArgs('care', args, { values: ['verdict', 'body', 'file', 'thread', 'repo'] });
  if (positional.length) throw usageError(USAGE);
  if (!CARE_VERDICTS.includes(flags.verdict)) {
    throw usageError(`omni care reply: --verdict must be one of ${CARE_VERDICTS.join(', ')}.`);
  }
  if ((flags.body === undefined) === (flags.file === undefined)) {
    throw usageError('omni care reply: give the text with exactly one of --body or --file.');
  }
  const text = flags.body ?? readUserFile('care', ctx, flags.file);
  if (!String(text).trim()) throw usageError('omni care reply: the reply is empty.');
  const body = careReplyBody(text, flags.verdict);
  if (flags.thread === undefined) {
    println(stdout, body);
    return 0;
  }

  const ghEnv = githubEnv(ctx, { exec, env });
  try {
    const posted = graphql({ query: REPLY_MUTATION, variables: { thread: flags.thread, body } }, { exec, env: ghEnv });
    const resolve = flags.verdict !== 'asked';
    if (resolve) graphql({ query: RESOLVE_MUTATION, variables: { thread: flags.thread } }, { exec, env: ghEnv });
    const url = posted.data?.addPullRequestReviewThreadReply?.comment?.url ?? null;
    println(stdout, JSON.stringify({ thread: flags.thread, verdict: flags.verdict, url, resolved: resolve }));
    return 0;
  } catch (error) {
    if (error?.name !== 'GitHubError') throw error;
    println(stderr, `omni care reply: GitHub refused it: ${error.message}`);
    return 1;
  }
}

export const care = {
  async run(args, { ctx, stdout, stderr, exec = execFileSync, env }) {
    const [sub, ...rest] = args;
    if (sub === 'state') return runState(rest, { ctx, stdout, stderr, exec, env });
    if (sub === 'reply') return runReply(rest, { ctx, stdout, stderr, exec, env });
    throw usageError(USAGE);
  },
};
