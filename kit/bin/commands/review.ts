// `omni review post <prd> --file <verdict.json> [--pr <n>] [--repo <owner/name>] [--json]` — PRD 2871,
// s1: the Reviewer's verdict, checked by `kit/lib/review/verdict.ts`, posted as one GitHub review on PRD
// n's feature PR (the open pull request from its feature branch, or `--pr`): `COMMENT` mode, never
// `APPROVE` or `REQUEST_CHANGES`, at the PR's head commit, one inline thread per finding. A verdict the
// schema refuses is never posted (exit 1, one line per field), and a round the PR already carries is
// not posted again (exit 0, nothing posted).
//
// `omni review read <prd> [--pr <n>] [--repo <owner/name>] [--json]` — the latest round and verdict the
// feature PR carries, read back by the review marker; `none` when it carries no Reviewer review.
//
// `omni review look-for [--json]` — what the Reviewer looks for: the kit default's six items in order
// of harm, then each item the repository's `look-for` section adds (`kit/lib/review/look-for.ts`).
//
// Every write and read goes through `gh api`, as the GitHub App's token under a job (`githubEnv`).
// GitHub refusing a call prints its first line and exits 1.
import { z } from 'zod';
import { fillBranch } from '../../lib/board.ts';
import type { Context } from '../../lib/context.ts';
import { PrNumberSchema } from '../../lib/ids.ts';
import type { PrNumber, PrdNumber } from '../../lib/ids.ts';
import { parseFolderName } from '../../lib/layout.ts';
import { messageOf, propertyOf } from '../../lib/narrow.ts';
import { lookFor } from '../../lib/review/look-for.ts';
import { latestReview, postedRound } from '../../lib/review/posted.ts';
import type { ListedReview, PostedReview } from '../../lib/review/posted.ts';
import { parseVerdict, renderReview } from '../../lib/review/verdict.ts';
import type { Verdict } from '../../lib/review/verdict.ts';
import { footerLine } from '../../lib/signature.ts';
import { parseArgs, prArg, prdArg, println, readUserFile, repoSlug, usageError } from '../args.ts';
import { githubEnv } from '../github.ts';
import type { Command, CommandIo, Env, Exec } from '../io.ts';
import { synchronous } from '../synchronous.ts';

const USAGE =
  'usage: omni review post <prd> --file <verdict.json> [--pr <n>] [--repo <owner/name>] [--json]\n' +
  '       omni review read <prd> [--pr <n>] [--repo <owner/name>] [--json]\n' +
  '       omni review look-for [--json]';

/** One pull request, the fields a review needs: its number, its link and its head commit. */
const GhPullSchema = z.looseObject({ number: PrNumberSchema, html_url: z.string(), head: z.looseObject({ sha: z.string().min(1) }) });

/** The pull request reviewed. */
type Pull = z.infer<typeof GhPullSchema>;

/** One review of a pull request (`GET repos/<slug>/pulls/<n>/reviews`). */
const GhReviewSchema = z.looseObject({ id: z.number(), body: z.string().nullish(), html_url: z.string().nullish() });

/** The review GitHub hands back once posted. */
const GhPostedSchema = z.looseObject({ id: z.number(), html_url: z.string().nullish() });

/** What every `gh` call of this command needs. */
type Gh = { exec: Exec; env: Env | undefined; repo: string };

/** A GitHub call that failed: its first line is what the person reads. */
class GitHubRefusal extends Error {
  override name = 'GitHubRefusal';
}

/** One `gh api` call's JSON, parsed by `schema`; a failed call is a {@link GitHubRefusal} naming `what`. */
function ghJson<T>(args: string[], schema: z.ZodType<T>, { exec, env }: Gh, { what, input }: { what: string; input?: string }): T {
  let raw: string;
  try {
    raw = exec('gh', args, { encoding: 'utf8', ...(input === undefined ? {} : { input }), ...(env ? { env } : {}) });
  } catch (error) {
    const stderr = propertyOf(error, 'stderr');
    const text = typeof stderr === 'string' && stderr.trim() ? stderr : messageOf(error);
    throw new GitHubRefusal(`GitHub refused ${what}: ${text.trim().split('\n')[0] ?? ''}`);
  }
  return schema.parse(JSON.parse(raw));
}

/** PRD n's feature branch, from its folder's topic. */
function featureBranch(prd: PrdNumber, ctx: Context): string {
  const where = ctx.layout.whereIs(prd);
  const parsed = where ? parseFolderName(where.name) : null;
  if (!parsed) throw usageError(`omni review: PRD ${String(prd)} has no inbox or shipped folder; pass --pr <n>.`);
  return fillBranch(ctx.config.branches.feature, { topic: parsed.topic });
}

/** The pull request reviewed: `--pr`, else the open one from PRD n's feature branch. */
function pullRequest(prd: PrdNumber, pr: PrNumber | null, { ctx, gh }: { ctx: Context; gh: Gh }): Pull {
  if (pr !== null) return ghJson(['api', `repos/${gh.repo}/pulls/${String(pr)}`], GhPullSchema, gh, { what: `the pull request #${String(pr)}` });
  const branch = featureBranch(prd, ctx);
  const [owner = ''] = gh.repo.split('/');
  const pulls = ghJson(['api', '-X', 'GET', `repos/${gh.repo}/pulls`, '-f', 'state=open', '-f', `head=${owner}:${branch}`], z.array(GhPullSchema), gh, {
    what: `the pull requests of ${branch}`,
  });
  const [open] = pulls;
  if (!open) throw new GitHubRefusal(`${branch} has no open pull request in ${gh.repo}.`);
  return open;
}

/** Every review of pull request `pr`. */
function reviewsOf(pr: PrNumber, gh: Gh): ListedReview[] {
  return ghJson(['api', `repos/${gh.repo}/pulls/${String(pr)}/reviews`, '--paginate'], z.array(GhReviewSchema), gh, { what: `the reviews of #${String(pr)}` });
}

/** The verdict in `path`, checked; a usage error when the file cannot be read, a refusal naming every field otherwise. */
function readVerdict(path: string, ctx: Context): { ok: true; verdict: Verdict } | { ok: false; lines: string[] } {
  const text = readUserFile('review', ctx, path);
  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch {
    return { ok: false, lines: [`omni review: ${path} is not JSON, nothing posted.`] };
  }
  const parsed = parseVerdict(input);
  if (parsed.ok) return parsed;
  return { ok: false, lines: ['omni review: the verdict is refused, nothing posted:', ...parsed.errors.map((error) => `  ${error}`)] };
}

/** The flags every subcommand reading a pull request takes. */
const FLAGS = { values: ['file', 'pr', 'repo'] as const, booleans: ['json'] as const };

/** A pull request one subcommand reads: PRD n's, or `--pr`, in `--repo` or `repo.slug`. */
type Target = { prd: PrdNumber; pr: PrNumber | null; gh: Gh; json: boolean; file: string | undefined };

/** What `post` and `read` take from their arguments. */
function targetOf(args: string[], { ctx, exec, env }: CommandIo): Target {
  const { positional, flags } = parseArgs('review', args, FLAGS);
  if (positional.length !== 1) throw usageError(USAGE);
  const prd = prdArg('review', '<prd>', positional[0]);
  const pr = flags.pr === undefined ? null : prArg('review', '--pr', flags.pr);
  const repo = repoSlug('review', ctx, flags.repo);
  return { prd, pr, gh: { exec, env: githubEnv(ctx, { exec, env }), repo }, json: flags.json === true, file: flags.file };
}

/** `run`'s exit code, or 1 with GitHub's refusal on stderr. */
function onGitHub(stderr: CommandIo['stderr'], run: () => number): number {
  try {
    return run();
  } catch (error) {
    if (!(error instanceof GitHubRefusal)) throw error;
    println(stderr, `omni review: ${error.message}`);
    return 1;
  }
}

/** What `read --json` prints when no review carries the marker. */
const NO_REVIEW = Object.freeze({ round: null, verdict: null, url: null });

/** What `read` prints of `latest`, the latest review `pull` carries. */
function latestLine(latest: PostedReview | null, pull: Pull): string {
  const where = `PR #${String(pull.number)}`;
  if (!latest) return `none · ${where} has no Reviewer review yet`;
  return `round ${String(latest.round)} ${latest.verdict} · ${where} · ${latest.url ?? pull.html_url}`;
}

/** `omni review read`: the latest round and verdict the pull request carries. */
function readLatest(args: string[], io: CommandIo): number {
  const { ctx, stdout, stderr } = io;
  const { prd, pr, gh, json } = targetOf(args, io);
  return onGitHub(stderr, () => {
    const pull = pullRequest(prd, pr, { ctx, gh });
    const latest = latestReview(reviewsOf(pull.number, gh));
    println(stdout, json ? JSON.stringify({ pr: pull.number, ...(latest ?? NO_REVIEW) }) : latestLine(latest, pull));
    return 0;
  });
}

/** `omni review post`: the verdict in `--file`, checked, then posted unless its round already is. */
function postVerdict(args: string[], io: CommandIo): number {
  const { ctx, stderr } = io;
  const { prd, pr, gh, json, file } = targetOf(args, io);
  if (file === undefined) throw usageError(USAGE);
  const verdict = readVerdict(file, ctx);
  if (!verdict.ok) {
    for (const line of verdict.lines) println(stderr, line);
    return 1;
  }
  return onGitHub(stderr, () => {
    const pull = pullRequest(prd, pr, { ctx, gh });
    return post(verdict.verdict, { pull, reviews: reviewsOf(pull.number, gh), gh, ctx, stdout: io.stdout, json });
  });
}

/** What `post` says it did: one line, or the JSON `--json` asks for. */
type PostOutcome = { posted: boolean; pr: PrNumber; round: number; verdict: string; url: string; line: string };

function printPost(stdout: CommandIo['stdout'], json: boolean, { line, ...outcome }: PostOutcome): void {
  println(stdout, json ? JSON.stringify(outcome) : line);
}

/** Posts `verdict` on `pull`, unless one of `reviews` already carries its round. */
function post(
  verdict: Verdict,
  { pull, reviews, gh, ctx, stdout, json }: { pull: Pull; reviews: ListedReview[]; gh: Gh; ctx: Context; stdout: CommandIo['stdout']; json: boolean },
): number {
  const pr = pull.number;
  const already = postedRound(reviews, verdict.round);
  if (already) {
    const url = already.url ?? pull.html_url;
    const line = `omni review: round ${String(verdict.round)} is already posted on PR #${String(pr)}: ${url}. Nothing posted.`;
    printPost(stdout, json, { posted: false, pr, round: already.round, verdict: already.verdict, url, line });
    return 0;
  }
  const { body, comments } = renderReview(verdict, { footer: footerLine(ctx.config.signature) });
  const payload = JSON.stringify({ commit_id: pull.head.sha, event: 'COMMENT', body, comments });
  const written = ghJson(['api', `repos/${gh.repo}/pulls/${String(pr)}/reviews`, '--input', '-'], GhPostedSchema, gh, { what: 'the review', input: payload });
  const url = written.html_url ?? pull.html_url;
  const count = verdict.findings.length;
  const what = verdict.verdict === 'pass' ? 'pass' : `changes, ${String(count)} finding${count === 1 ? '' : 's'}`;
  const line = `omni review: posted round ${String(verdict.round)} (${what}) on PR #${String(pr)}: ${url}`;
  printPost(stdout, json, { posted: true, pr, round: verdict.round, verdict: verdict.verdict, url, line });
  return 0;
}

/** `omni review look-for`: the list, numbered, an added item tagged with where it came from. */
function printLookFor(args: string[], { ctx, stdout }: CommandIo): number {
  const { positional, flags } = parseArgs('review', args, { booleans: ['json'] });
  if (positional.length) throw usageError(USAGE);
  const items = lookFor({ ctx });
  if (flags.json) {
    println(stdout, JSON.stringify(items));
    return 0;
  }
  items.forEach(({ text, source }, index) => {
    println(stdout, `${String(index + 1)}. ${text}${source === 'kit' ? '' : `  [${source}]`}`);
  });
  return 0;
}

export const review: Command = {
  run: synchronous((args: string[], io: CommandIo): number => {
    const [which = '', ...rest] = args;
    if (which === 'post') return postVerdict(rest, io);
    if (which === 'read') return readLatest(rest, io);
    if (which === 'look-for') return printLookFor(rest, io);
    throw usageError(USAGE);
  }),
};
