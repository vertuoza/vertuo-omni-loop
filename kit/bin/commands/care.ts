// `omni care state <prd> [--pr <n>] [--repo <owner/name>]` — PRD 790: the care state of the PRD's
// feature PR, as one JSON document: its check rollup, mergeable state, review threads with their
// verdicts, the care line of its status comment, whether a wave holds claims on the feature branch,
// and the round `decideRound` draws from all that. One GraphQL read, plus the board's own reads.
// For a PRD of several landings it looks after the first landing PR still open, and carries the
// landings and the chain link to restack once the landing before it has merged (`landingChain`).
//
// In a plan repository (PRD 1118), `--repo` naming one of `plan.targets` reads that target's PR: the
// target's default branch from GitHub, its own landing chain, and wave claims among its own slices
// only. Wherever it runs, a status comment's `waits on <slug>#<pr>` line is read with that PR's state,
// and the round holds its CI fix while that PR is open (`decideRound`).
//
// Issue #1178: when `--pr` names a sub-PR, one of the board's slice PRs, the state carries its `slice`
// and the round is a sub-PR's (`decideSubPrRound`): its review threads only, which `/omni:wave` judges
// before it merges the sub-PR, whatever the wave's own claims, its CI and its conflict say.
//
// `omni care list <prd> [--json]` — PRD 1118, in a plan repository only: every pull request one
// `/omni:mega-pr-care` run looks after, in merge order (`mergeOrder`): the target and landing PRs, the
// bug-fix and record PRs of each bug linked by its `For PRD #<prd>` line, then the plan PR. A
// repository gh cannot read is listed `unreadable`.
//
// `omni care reply --verdict <fixed|pushed-back|asked> (--body <text> | --file <path>) [--thread <id>]
// [--repo <owner/name>]` — the reply's body, ending with the care marker. Without --thread it only
// prints the body; with --thread it posts it on that review thread and, for fixed and pushed-back,
// resolves the thread (an asked thread stays open for the PM), then prints what it did as JSON.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { landingChain, landingPrToWatch } from '../../lib/care/chain.ts';
import { decideRound, decideSubPrRound } from '../../lib/care/decide.ts';
import type { Waiting } from '../../lib/care/decide.ts';
import { FIX_PLAN_MARKER, fixPlanRows, foundEntry, linksPrd, mergeOrder } from '../../lib/care/list.ts';
import type { CareListEntry, Found, FoundPr, TargetStep } from '../../lib/care/list.ts';
import { claimedIn, landingsIn } from '../../lib/care/target.ts';
import type { WaitsOn } from '../../lib/care/state.ts';
import type { LandingRow } from '../../lib/board.ts';
import { gradedLandings } from '../../lib/inbox/plan-grade.ts';
import { parsePlanLandings, parsePlanRepositories, parsePlanSlices } from '../../lib/inbox/territory.ts';
import { landingPlan } from '../../lib/landings/landing-plan.ts';
import type { Slice } from '../../lib/types.ts';
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
import { GhGraphqlSchema, GhReplyMutationSchema } from '../schema.ts';
import { synchronous } from '../synchronous.ts';
import { IssueNumberSchema, PrNumberSchema } from '../../lib/ids.ts';
import type { IssueNumber, PrNumber, PrdNumber, WorkSliceId } from '../../lib/ids.ts';

const USAGE =
  'usage: omni care state <prd> [--pr <n>] [--repo <owner/name>]\n' +
  '       omni care list <prd> [--json]\n' +
  '       omni care reply --verdict <fixed|pushed-back|asked> (--body <text> | --file <path>) [--thread <id>] [--repo <owner/name>]';

/** The answers of `gh` this file reads beyond GraphQL: each names only the fields read. */
const GhPrSchema = z.looseObject({ number: PrNumberSchema, state: z.string(), url: z.string().nullish(), updatedAt: z.unknown().optional() });
const GhIssuesSchema = z.array(z.looseObject({ number: IssueNumberSchema, body: z.string().nullish() }));
const GhIssueViewSchema = z.looseObject({
  comments: z.array(z.looseObject({ body: z.string().nullish() })).nullish(),
  closedByPullRequestsReferences: z.array(z.looseObject({ number: PrNumberSchema, url: z.string().nullish() })).nullish(),
});

/** What every `gh` call of this file needs. */
type Gh = { exec: Exec; env: Env | undefined };

/** One `gh` call's text. */
function ghText(args: string[], { exec, env }: Gh): string {
  return exec('gh', args, { encoding: 'utf8', ...(env ? { env } : {}) });
}

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

function topicFor(prd: PrdNumber, ctx: Context): string {
  const where = ctx.layout.whereIs(prd);
  const parsed = where ? parseFolderName(where.name) : null;
  if (parsed) return parsed.topic;
  throw usageError(where
    ? `omni care: cannot read a topic from folder "${where.name}".`
    : `omni care: PRD ${prd} has no inbox or shipped folder.`);
}

function featureBranchFor(prd: PrdNumber, ctx: Context): string {
  return fillBranch(ctx.config.branches.feature, { topic: topicFor(prd, ctx) });
}

/** The pull request from `branch` in `repo`: the open one, else the one updated last. */
function findPr({ repo, branch }: { repo: string; branch: string }, gh: Gh): FoundPr | null {
  const raw = ghText(['pr', 'list', '--repo', repo, '--head', branch, '--state', 'all', '--json', 'number,state,url,updatedAt', '--limit', '20'], gh);
  const prs = z.array(GhPrSchema).parse(JSON.parse(raw));
  const open = prs.find((pr) => pr.state === 'OPEN');
  const found = open ?? [...prs].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0];
  return found ? { number: found.number, state: found.state, url: found.url ?? null } : null;
}

/** One pull request, read by its number. */
function viewPr(repo: string, number: PrNumber, gh: Gh): FoundPr {
  const found = GhPrSchema.parse(JSON.parse(ghText(['pr', 'view', String(number), '--repo', repo, '--json', 'number,state,url'], gh)));
  return { number: found.number, state: found.state, url: found.url ?? null };
}

/** What `read` found, or `unreadable` when gh could not read its repository. */
function readFound(read: () => FoundPr | null): Found {
  try {
    return read();
  } catch {
    return 'unreadable';
  }
}

/** A plan repository's target a `--repo` names: its short name and its `owner/name`. */
type Target = { name: string; slug: string };

/** The part of an `owner/name` slug after the `/`: the name a plan's `repo` column uses. */
function shortName(slug: string): string {
  return slug.slice(slug.indexOf('/') + 1);
}

/** The target `--repo` names, in a plan repository; `null` anywhere else. */
function targetOf(ctx: Context, flag: string | undefined): Target | null {
  const found = ctx.config.plan?.targets.find((target) => target.repo === flag);
  return found ? { name: shortName(found.repo), slug: found.repo } : null;
}

/** Whether a wave holds claims: `holdsClaims` is `null` when the board could not be read. For a
 * target, only its own slices' claims count, and only its own landings are its chain; the board is
 * then the plan repository's own. */
function waveClaims(
  prd: PrdNumber,
  { ctx, exec, env, repo, target }: { ctx: Context; exec: Exec; env: Env; repo: string | undefined; target: Target | null },
): { wave: { holdsClaims: boolean | null; claimed: string[]; unreadable?: string }; landings: LandingRow[] | null; sliceOf: (pr: PrNumber) => WorkSliceId | null } {
  try {
    const { result } = buildBoard(prd, { ctx, exec, env, repo: target === null ? repo : undefined });
    const claimed = claimedIn(result.slices, target?.name ?? null);
    const sliceOf = (pr: PrNumber) => result.slices.find((row) => row.pr?.number === pr && (target === null || row.repo === target.name))?.id ?? null;
    return { wave: { holdsClaims: claimed.length > 0, claimed }, landings: landingsIn(result.landings, target?.name ?? null), sliceOf };
  } catch (error) {
    return { wave: { holdsClaims: null, claimed: [], unreadable: firstLine(error) }, landings: null, sliceOf: () => null };
  }
}

/** An error's message, its first line only. */
function firstLine(error: unknown): string {
  return String(propertyOf(error, 'message') ?? error).split('\n')[0] ?? '';
}

/** The pull request a round looks after: `--pr`'s, else the first open landing PR of a PRD of
 * several landings, else the feature PR `find` looks up. */
function watchedPr({ flag, landed, find }: { flag: string | undefined; landed: LandingRow[] | null; find: () => number | null }): number | null {
  if (flag !== undefined) return prArg('care', '--pr', flag);
  return landed === null ? find() : landingPrToWatch(landed);
}

/** The pull request named by a `waits on` line, with its state; `unreadable` when gh cannot read it. */
function waitingOn(waits: WaitsOn | undefined, gh: Gh): Waiting | null {
  if (waits === undefined) return null;
  const found = readFound(() => viewPr(waits.slug, waits.pr, gh));
  return { ...waits, state: waitingState(found) };
}

const WAITING_STATES: Record<string, Waiting['state']> = { MERGED: 'merged', CLOSED: 'closed', OPEN: 'open' };

function waitingState(found: Found): Waiting['state'] {
  return found === null || found === 'unreadable' ? 'unreadable' : (WAITING_STATES[found.state] ?? 'open');
}

/** Where a round's PR lives: its repository, its default branch, and the branch its PR comes from. */
type Scope = { repo: string; defaultBranch: string; branch: string; target: (Target & { defaultBranch: string }) | null };

function scopeOf(prd: PrdNumber, flag: string | undefined, { ctx, gh }: { ctx: Context; gh: Gh }): Scope {
  const repo = repoSlug('care', ctx, flag);
  const branch = featureBranchFor(prd, ctx);
  const target = targetOf(ctx, flag);
  if (target === null) return { repo, defaultBranch: ctx.config.repo.defaultBranch, branch, target: null };
  const defaultBranch = ghText(['repo', 'view', target.slug, '--json', 'defaultBranchRef', '--jq', '.defaultBranchRef.name'], gh).trim();
  return { repo, defaultBranch, branch, target: { ...target, defaultBranch } };
}

/** The care state of the pull request `number` in `scope`, its round's inputs all read. */
function readCare(prd: PrdNumber, number: number, { scope, ctx, gh }: { scope: Scope; ctx: Context; gh: Gh }) {
  const [owner, name] = scope.repo.split('/');
  const response = graphql({ query: CARE_QUERY, variables: { owner, name, number } }, gh);
  const state = careState(CareResponseSchema.parse(response), {
    statusMarker: `<!-- ${ctx.config.markers.prefix}-status -->`,
    needsFixLabel: ctx.config.labels.needsFix,
    gateContexts: [ctx.config.ci.outboxContext, ctx.config.ci.inboxContext].filter(Boolean),
  });
  const waitsOn = waitingOn(state.status?.waitsOn, gh);
  return { prd, ...(scope.target === null ? {} : { target: scope.target }), ...state, ...(waitsOn === null ? {} : { waitsOn }) };
}

/** What a round's printing reads: the PRD, where its PR lives, and the wave's claims. */
type StateRun = { prd: PrdNumber; scope: Scope; claims: ReturnType<typeof waveClaims>; ctx: Context; gh: Gh; stdout: CommandIo['stdout'] };

/** Issue #1178: a sub-PR's care state, its `slice` named, and its round, its threads only. */
function printSubPr(number: PrNumber, slice: WorkSliceId, { prd, scope, claims, ctx, gh, stdout }: StateRun): number {
  const state = readCare(prd, number, { scope, ctx, gh });
  println(stdout, JSON.stringify({ ...state, slice, wave: claims.wave, round: decideSubPrRound(state) }, null, 2));
  return 0;
}

/** The feature PR's (or the watched landing PR's) care state and its round; exit 1 with no PR. */
function printFeature(flag: string | undefined, run: StateRun & { stderr: CommandIo['stderr'] }): number {
  const { prd, scope, claims, ctx, gh, stdout, stderr } = run;
  const landed = claims.landings !== null && claims.landings.length > 1 ? claims.landings : null;
  const number = watchedPr({ flag, landed, find: () => findPr(scope, gh)?.number ?? null });
  if (number === null) {
    const from = landed === null ? scope.branch : landed.map((landing) => landing.branch).join(', ');
    println(stderr, `omni care: PRD ${prd} has no feature PR yet (no pull request from ${from}).`);
    return 1;
  }
  const { waitsOn, ...state } = readCare(prd, number, { scope, ctx, gh });
  const chain = landed === null ? [] : landingChain(landed, scope.defaultBranch);
  const full = { ...state, wave: claims.wave, ...(landed === null ? {} : { landings: landed, chain }), ...(waitsOn === undefined ? {} : { waitsOn }) };
  println(stdout, JSON.stringify({ ...full, round: decideRound(full) }, null, 2));
  return 0;
}

function runState(args: string[], { ctx, stdout, stderr, exec, env }: CommandIo): number {
  const { positional, flags } = parseArgs('care', args, { values: ['pr', 'repo'] });
  if (positional.length !== 1) throw usageError(USAGE);
  const prd = prdArg('care', '<prd>', positional[0]);
  const gh: Gh = { exec, env: githubEnv(ctx, { exec, env }) };
  const scope = scopeOf(prd, flags.repo, { ctx, gh });
  const claims = waveClaims(prd, { ctx, exec, env, repo: flags.repo, target: scope.target });
  const run: StateRun = { prd, scope, claims, ctx, gh, stdout };
  const named = flags.pr === undefined ? null : prArg('care', '--pr', flags.pr);
  const slice = named === null ? null : claims.sliceOf(named);
  if (named !== null && slice !== null) return printSubPr(named, slice, run);
  return printFeature(flags.pr, { ...run, stderr });
}

/** A plan's slices, its `## Repositories` order and its graded landings, with the PRD's topic. */
function readPlanOf(prd: PrdNumber, ctx: Context) {
  const planPath = ctx.layout.planPath(prd);
  if (planPath === null) throw usageError(`omni care list: PRD ${prd} has no inbox or shipped folder.`);
  const markdown = readFileSync(join(ctx.root, planPath), 'utf8');
  const slices = parsePlanSlices(markdown);
  return {
    slices,
    repositories: parsePlanRepositories(markdown).map((row) => row.repo),
    landings: gradedLandings(slices, parsePlanLandings(markdown)),
    topic: topicFor(prd, ctx),
  };
}

/** The earliest wave among `slices`, or `null` when none has one. */
function earliestWave(slices: readonly Slice[]): number | null {
  const waves = slices.flatMap((slice) => (slice.wave === null ? [] : [slice.wave]));
  return waves.length === 0 ? null : Math.min(...waves);
}

/** One target's pull requests to place: its feature PR, or one per landing of its own chain. */
function stepsOf(slug: string, plan: ReturnType<typeof readPlanOf>, { ctx, gh }: { ctx: Context; gh: Gh }): TargetStep[] {
  const name = shortName(slug);
  const mine = plan.slices.filter((slice) => slice.repo === name);
  if (mine.length === 0) return [];
  const chain = landingPlan({ ...plan, branches: ctx.config.branches, defaultBranch: ctx.config.repo.defaultBranch, repo: name });
  return chain.map((step) => ({
    name,
    slug,
    planLanding: step.planLanding,
    wave: earliestWave(mine.filter((slice) => slice.landing === step.planLanding)),
    landing: chain.length > 1 ? { landing: step.landing, count: step.count, name: step.name } : null,
    found: readFound(() => findPr({ repo: slug, branch: step.branch }, gh)),
  }));
}

/** The `owner/name` a pull request's link names, or `null`. */
function slugOfUrl(url: string | null | undefined): string | null {
  return url?.match(/github\.com\/([\w.-]+\/[\w.-]+)\/pull\//)?.[1] ?? null;
}

/** What the bug-fix part of the list reads with. */
type BugReader = { planSlug: string; targetName: (slug: string) => string | null; gh: Gh };

/** A linked bug whose issue could not be read, as the one entry it lists. */
function unreadableBug({ planSlug }: BugReader, bug?: IssueNumber): CareListEntry {
  return { repo: planSlug, number: null, kind: 'bug-fix', target: null, state: 'unreadable', url: null, ...(bug === undefined ? {} : { bug }) };
}

/** One linked bug's pull requests: its fix plan's, in order, then its record PRs. */
function bugEntries(issue: IssueNumber, reader: BugReader): CareListEntry[] {
  const { planSlug, targetName, gh } = reader;
  let view: z.infer<typeof GhIssueViewSchema>;
  try {
    view = GhIssueViewSchema.parse(JSON.parse(ghText(['issue', 'view', String(issue), '--repo', planSlug, '--json', 'comments,closedByPullRequestsReferences'], gh)));
  } catch {
    return [unreadableBug(reader, issue)];
  }
  const entryOf = (kind: 'bug-fix' | 'bug-record', slug: string, pr: PrNumber) =>
    foundEntry({ repo: slug, kind, target: targetName(slug), bug: issue }, readFound(() => viewPr(slug, pr, gh)), pr);
  const fixPlan = (view.comments ?? []).find((comment) => (comment.body ?? '').includes(FIX_PLAN_MARKER));
  const fixes = fixPlanRows(fixPlan?.body).map(({ slug, pr }) => entryOf('bug-fix', slug, pr));
  const records = (view.closedByPullRequestsReferences ?? []).map((ref) => entryOf('bug-record', slugOfUrl(ref.url) ?? planSlug, ref.number));
  return [...fixes, ...records].filter((entry) => entry !== null);
}

/** The pull requests of every bug linked to PRD `prd`, one group per bug, in issue order. */
function linkedBugs(prd: PrdNumber, label: string, reader: BugReader): CareListEntry[][] {
  let issues: z.infer<typeof GhIssuesSchema>;
  try {
    issues = GhIssuesSchema.parse(JSON.parse(ghText(['issue', 'list', '--repo', reader.planSlug, '--label', label, '--state', 'all', '--json', 'number,body', '--limit', '200'], reader.gh)));
  } catch {
    return [[unreadableBug(reader)]];
  }
  return issues
    .filter((issue) => linksPrd(issue.body, prd))
    .sort((left, right) => left.number - right.number)
    .map((issue) => bugEntries(issue.number, reader));
}

/** One line of the list, for a person. */
function listLine(entry: CareListEntry, index: number): string {
  const where = entry.number === null ? entry.repo : `${entry.repo}#${entry.number}`;
  const landing = entry.landing ? ` — landing ${entry.landing.landing}/${entry.landing.count} ${entry.landing.name}` : '';
  const target = entry.target === null ? '' : ` — ${entry.target}`;
  return `  ${index + 1}. ${entry.kind.padEnd('bug-record'.length)} ${where} — ${entry.state}${target}${landing}`;
}

/** Every pull request of a mega care run of PRD `prd`, in merge order. */
function careList(prd: PrdNumber, { ctx, gh }: { ctx: Context; gh: Gh }): CareListEntry[] {
  const targets = ctx.config.plan?.targets ?? [];
  const planSlug = repoSlug('care', ctx, undefined);
  const plan = readPlanOf(prd, ctx);
  const known = new Map(targets.map((target) => [target.repo, shortName(target.repo)]));
  const bugs = linkedBugs(prd, ctx.config.labels.bug, { planSlug, targetName: (slug) => known.get(slug) ?? null, gh });
  const planPr = foundEntry({ repo: planSlug, kind: 'plan' as const, target: null }, readFound(() => findPr({ repo: planSlug, branch: featureBranchFor(prd, ctx) }, gh)));
  const steps = targets.flatMap(({ repo }) => stepsOf(repo, plan, { ctx, gh }));
  return mergeOrder({ repositories: plan.repositories, targets: steps, bugs, plan: planPr });
}

function runList(args: string[], { ctx, stdout, exec, env }: CommandIo): number {
  const { positional, flags } = parseArgs('care', args, { booleans: ['json'] });
  if (positional.length !== 1) throw usageError(USAGE);
  const prd = prdArg('care', '<prd>', positional[0]);
  if (ctx.config.plan === undefined) throw usageError('omni care list: not a plan repository — its config has no plan section.');
  const entries = careList(prd, { ctx, gh: { exec, env: githubEnv(ctx, { exec, env }) } });
  if (flags.json) {
    println(stdout, JSON.stringify(entries, null, 2));
    return 0;
  }
  println(stdout, `omni care list — PRD ${prd}: ${entries.length} pull request${entries.length === 1 ? '' : 's'}, in merge order.`);
  entries.forEach((entry, index) => {
    println(stdout, listLine(entry, index));
  });
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
    if (sub === 'list') return runList(rest, io);
    if (sub === 'reply') return runReply(rest, io);
    throw usageError(USAGE);
  }),
};
