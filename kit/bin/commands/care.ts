// `omni care state <prd> [--pr <n>] [--repo <owner/name>]` — PRD 790: the care state of the PRD's
// feature PR, as one JSON document: its check rollup, mergeable state, review threads with their
// verdicts, the care line of its status comment, whether a wave holds claims on the feature branch,
// and the round `decideRound` draws from all that. Read through `LoopReads` (PRD 1665): the change
// with its review and its conversation's comments, plus the board's own reads; no `gh` read.
// For a PRD of several landings it looks after the first landing PR still open, and carries the
// landings and the chain link to restack once the landing before it has merged (`landingChain`).
//
// In a plan repository (PRD 1118), `--repo` naming one of `plan.targets` reads that target's PR: the
// target's default branch from GitHub, its own landing chain, and wave claims among its own slices
// only. Wherever it runs, a status comment's `waits on <slug>#<pr>` line is read with that PR's state,
// and the round holds its CI fix while that PR is open (`decideRound`).
//
// `omni care list <prd> [--json]` — PRD 1118, in a plan repository only: every pull request one
// `/omni:mega-pr-care` run looks after, in merge order (`mergeOrder`): the target and landing PRs, the
// bug-fix and record PRs of each bug linked by its `For PRD #<prd>` line, then the plan PR. A
// repository the Omni page refuses alone is listed `unreadable`.
//
// A read that cannot be made at all (no sign-in, no answer, a page without the loop's routes) prints
// its one line on stderr and exits 1 (PRD 1665).
//
// `omni care reply --verdict <fixed|pushed-back|asked> (--body <text> | --file <path>) [--thread <id>]
// [--repo <owner/name>]` — the reply's body, ending with the care marker. Without --thread it only
// prints the body; with --thread it posts it on that review thread and, for fixed and pushed-back,
// resolves the thread (an asked thread stays open for the PM), then prints what it did as JSON. Its
// writes go through `gh` as before.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { landingChain, landingPrToWatch } from '../../lib/care/chain.ts';
import { decideRound } from '../../lib/care/decide.ts';
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
import { careState } from '../../lib/care/state.ts';
import type { Fetch, TokenStore } from '../../lib/ask/client.ts';
import { loadContext } from '../../lib/context.ts';
import type { Context } from '../../lib/context.ts';
import { fillBranch } from '../../lib/board.ts';
import { parseFolderName } from '../../lib/layout.ts';
import type { LoopChange } from '../../lib/loop-reads/contract.ts';
import { omniLoopReads } from '../../lib/loop-reads/omni.ts';
import { boardReads, LoopReadError } from '../../lib/loop-reads/port.ts';
import type { LoopReads } from '../../lib/loop-reads/port.ts';
import { isOneOf, propertyOf } from '../../lib/narrow.ts';
import { githubEnv } from '../github.ts';
import { parseArgs, prArg, prdArg, println, readUserFile, repoSlug, usageError } from '../args.ts';
import { buildBoard } from './board.ts';
import type { CommandIo, Env, Exec, FreeCommand, FreeIo } from '../io.ts';
import { GhGraphqlSchema, GhReplyMutationSchema } from '../schema.ts';
import type { IssueNumber, PrNumber, PrdNumber } from '../../lib/ids.ts';

const USAGE =
  'usage: omni care state <prd> [--pr <n>] [--repo <owner/name>]\n' +
  '       omni care list <prd> [--json]\n' +
  '       omni care reply --verdict <fixed|pushed-back|asked> (--body <text> | --file <path>) [--thread <id>] [--repo <owner/name>]';

/** What every `gh` call of this file needs: its writes, and a target's default branch. */
type Gh = { exec: Exec; env: Env | undefined };

/** What this command reads with: its context, the loop's reads, and `gh` for what the contract does not carry. */
type Io = CommandIo & { reads: LoopReads };

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

/** One GraphQL write through `gh api graphql`, the request fed on stdin. Throws GitHub's first error. */
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

/** A change's state as this command has always named it: GitHub's, a draft being open. */
const GH_STATES: Record<LoopChange['state'], string> = { open: 'OPEN', draft: 'OPEN', merged: 'MERGED', closed: 'CLOSED' };

const foundOf = (change: LoopChange): FoundPr => ({ number: change.number, state: GH_STATES[change.state], url: change.url });

/** The pull request from `branch` in `repo`: the open one, else the one updated last. */
async function findPr({ repo, branch }: { repo: string; branch: string }, reads: LoopReads): Promise<FoundPr | null> {
  const changes = await reads.changes({ repo, head: branch, state: 'all' });
  const open = changes.find((change) => change.state === 'open' || change.state === 'draft');
  const found = open ?? [...changes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  return found ? foundOf(found) : null;
}

/** One pull request, read by its number. */
async function viewPr(repo: string, number: PrNumber, reads: LoopReads): Promise<FoundPr> {
  return foundOf(await reads.change(repo, number));
}

/** Whether `error` stops every read, not one repository's: it then stops the command. */
const stopsEverything = (error: unknown): boolean => error instanceof LoopReadError && error.scope === 'everything';

/** What `read` found, or `unreadable` when its repository could not be read. */
async function readFound(read: () => Promise<FoundPr | null>): Promise<Found> {
  try {
    return await read();
  } catch (error) {
    if (stopsEverything(error)) throw error;
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
async function waveClaims(
  prd: PrdNumber,
  { ctx, reads, repo, target }: { ctx: Context; reads: LoopReads; repo: string | undefined; target: Target | null },
): Promise<{ wave: { holdsClaims: boolean | null; claimed: string[]; unreadable?: string }; landings: LandingRow[] | null }> {
  try {
    const { result } = await buildBoard(prd, { ctx, reads: boardReads(reads), repo: target === null ? repo : undefined });
    const claimed = claimedIn(result.slices, target?.name ?? null);
    return { wave: { holdsClaims: claimed.length > 0, claimed }, landings: landingsIn(result.landings, target?.name ?? null) };
  } catch (error) {
    return { wave: { holdsClaims: null, claimed: [], unreadable: firstLine(error) }, landings: null };
  }
}

/** An error's message, its first line only. */
function firstLine(error: unknown): string {
  return String(propertyOf(error, 'message') ?? error).split('\n')[0] ?? '';
}

/** The pull request a round looks after: `--pr`'s, else the first open landing PR of a PRD of
 * several landings, else the feature PR `find` looks up. */
async function watchedPr({ flag, landed, find }: { flag: string | undefined; landed: LandingRow[] | null; find: () => Promise<PrNumber | null> }): Promise<PrNumber | null> {
  if (flag !== undefined) return prArg('care', '--pr', flag);
  return landed === null ? find() : landingPrToWatch(landed);
}

/** The pull request named by a `waits on` line, with its state; `unreadable` when it cannot be read. */
async function waitingOn(waits: WaitsOn | undefined, reads: LoopReads): Promise<Waiting | null> {
  if (waits === undefined) return null;
  const found = await readFound(() => viewPr(waits.slug, waits.pr, reads));
  return { ...waits, state: waitingState(found) };
}

const WAITING_STATES: Record<string, Waiting['state']> = { MERGED: 'merged', CLOSED: 'closed', OPEN: 'open' };

function waitingState(found: Found): Waiting['state'] {
  return found === null || found === 'unreadable' ? 'unreadable' : (WAITING_STATES[found.state] ?? 'open');
}

/** Where a round's PR lives: its repository, its default branch, and the branch its PR comes from. */
type Scope = { repo: string; defaultBranch: string; branch: string; target: (Target & { defaultBranch: string }) | null };

/** Where the round's PR lives. Only a target's default branch is read through `gh`: the loop's facts
 * do not carry it, and nothing else of a round needs `gh`. */
function scopeOf(prd: PrdNumber, flag: string | undefined, { ctx, exec, env }: { ctx: Context; exec: Exec; env: Env }): Scope {
  const repo = repoSlug('care', ctx, flag);
  const branch = featureBranchFor(prd, ctx);
  const target = targetOf(ctx, flag);
  if (target === null) return { repo, defaultBranch: ctx.config.repo.defaultBranch, branch, target: null };
  const gh: Gh = { exec, env: githubEnv(ctx, { exec, env }) };
  const defaultBranch = ghText(['repo', 'view', target.slug, '--json', 'defaultBranchRef', '--jq', '.defaultBranchRef.name'], gh).trim();
  return { repo, defaultBranch, branch, target: { ...target, defaultBranch } };
}

/** The care state of the pull request `number` in `scope`, its round's inputs all read. */
async function readCare(prd: PrdNumber, number: PrNumber, { scope, ctx, reads }: { scope: Scope; ctx: Context; reads: LoopReads }) {
  const [change, comments] = await Promise.all([reads.change(scope.repo, number), reads.comments(scope.repo, number)]);
  const state = careState({ change, comments }, {
    statusMarker: `<!-- ${ctx.config.markers.prefix}-status -->`,
    needsFixLabel: ctx.config.labels.needsFix,
    gateContexts: [ctx.config.ci.outboxContext, ctx.config.ci.inboxContext].filter(Boolean),
  });
  const waitsOn = await waitingOn(state.status?.waitsOn, reads);
  return { prd, ...(scope.target === null ? {} : { target: scope.target }), ...state, ...(waitsOn === null ? {} : { waitsOn }) };
}

async function runState(args: string[], { ctx, stdout, stderr, exec, env, reads }: Io): Promise<number> {
  const { positional, flags } = parseArgs('care', args, { values: ['pr', 'repo'] });
  if (positional.length !== 1) throw usageError(USAGE);
  const prd = prdArg('care', '<prd>', positional[0]);
  const scope = scopeOf(prd, flags.repo, { ctx, exec, env });

  const { wave, landings } = await waveClaims(prd, { ctx, reads, repo: flags.repo, target: scope.target });
  const landed = landings !== null && landings.length > 1 ? landings : null;
  const number = await watchedPr({ flag: flags.pr, landed, find: async () => (await findPr(scope, reads))?.number ?? null });
  if (number === null) {
    const from = landed === null ? scope.branch : landed.map((landing) => landing.branch).join(', ');
    println(stderr, `omni care: PRD ${prd} has no feature PR yet (no pull request from ${from}).`);
    return 1;
  }
  const { waitsOn, ...state } = await readCare(prd, number, { scope, ctx, reads });
  const chain = landed === null ? [] : landingChain(landed, scope.defaultBranch);
  const full = { ...state, wave, ...(landed === null ? {} : { landings: landed, chain }), ...(waitsOn === undefined ? {} : { waitsOn }) };
  println(stdout, JSON.stringify({ ...full, round: decideRound(full) }, null, 2));
  return 0;
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
async function stepsOf(slug: string, plan: ReturnType<typeof readPlanOf>, { ctx, reads }: { ctx: Context; reads: LoopReads }): Promise<TargetStep[]> {
  const name = shortName(slug);
  const mine = plan.slices.filter((slice) => slice.repo === name);
  if (mine.length === 0) return [];
  const chain = landingPlan({ ...plan, branches: ctx.config.branches, defaultBranch: ctx.config.repo.defaultBranch, repo: name });
  const steps: TargetStep[] = [];
  for (const step of chain) {
    steps.push({
      name,
      slug,
      planLanding: step.planLanding,
      wave: earliestWave(mine.filter((slice) => slice.landing === step.planLanding)),
      landing: chain.length > 1 ? { landing: step.landing, count: step.count, name: step.name } : null,
      found: await readFound(() => findPr({ repo: slug, branch: step.branch }, reads)),
    });
  }
  return steps;
}

/** What the bug-fix part of the list reads with. */
type BugReader = { planSlug: string; targetName: (slug: string) => string | null; reads: LoopReads };

/** A linked bug whose issue could not be read, as the one entry it lists. */
function unreadableBug({ planSlug }: BugReader, bug?: IssueNumber): CareListEntry {
  return { repo: planSlug, number: null, kind: 'bug-fix', target: null, state: 'unreadable', url: null, ...(bug === undefined ? {} : { bug }) };
}

/** One linked bug's pull requests: its fix plan's, in order, then its record PRs, which close the
 * issue from its own repository (the loop's facts name a closing change by its number alone). */
async function bugEntries(issue: IssueNumber, reader: BugReader): Promise<CareListEntry[]> {
  const { planSlug, targetName, reads } = reader;
  let view: Awaited<ReturnType<LoopReads['issue']>>;
  try {
    view = await reads.issue(planSlug, issue);
  } catch (error) {
    if (stopsEverything(error)) throw error;
    return [unreadableBug(reader, issue)];
  }
  const entryOf = async (kind: 'bug-fix' | 'bug-record', slug: string, pr: PrNumber) =>
    foundEntry({ repo: slug, kind, target: targetName(slug), bug: issue }, await readFound(() => viewPr(slug, pr, reads)), pr);
  const fixPlan = view.comments.find((comment) => comment.body.includes(FIX_PLAN_MARKER));
  const entries: (CareListEntry | null)[] = [];
  for (const { slug, pr } of fixPlanRows(fixPlan?.body)) entries.push(await entryOf('bug-fix', slug, pr));
  for (const pr of view.closedBy) entries.push(await entryOf('bug-record', planSlug, pr));
  return entries.filter((entry) => entry !== null);
}

/** The pull requests of every bug linked to PRD `prd`, one group per bug, in issue order. */
async function linkedBugs(prd: PrdNumber, label: string, reader: BugReader): Promise<CareListEntry[][]> {
  let issues: Awaited<ReturnType<LoopReads['issues']>>;
  try {
    issues = await reader.reads.issues({ repo: reader.planSlug, label, state: 'all' });
  } catch (error) {
    if (stopsEverything(error)) throw error;
    return [[unreadableBug(reader)]];
  }
  const groups: CareListEntry[][] = [];
  for (const issue of issues.filter((one) => linksPrd(one.body, prd)).sort((left, right) => left.number - right.number)) {
    groups.push(await bugEntries(issue.number, reader));
  }
  return groups;
}

/** One line of the list, for a person. */
function listLine(entry: CareListEntry, index: number): string {
  const where = entry.number === null ? entry.repo : `${entry.repo}#${entry.number}`;
  const landing = entry.landing ? ` — landing ${entry.landing.landing}/${entry.landing.count} ${entry.landing.name}` : '';
  const target = entry.target === null ? '' : ` — ${entry.target}`;
  return `  ${index + 1}. ${entry.kind.padEnd('bug-record'.length)} ${where} — ${entry.state}${target}${landing}`;
}

/** Every pull request of a mega care run of PRD `prd`, in merge order. */
async function careList(prd: PrdNumber, { ctx, reads }: { ctx: Context; reads: LoopReads }): Promise<CareListEntry[]> {
  const targets = ctx.config.plan?.targets ?? [];
  const planSlug = repoSlug('care', ctx, undefined);
  const plan = readPlanOf(prd, ctx);
  const known = new Map(targets.map((target) => [target.repo, shortName(target.repo)]));
  const bugs = await linkedBugs(prd, ctx.config.labels.bug, { planSlug, targetName: (slug) => known.get(slug) ?? null, reads });
  const planPr = foundEntry({ repo: planSlug, kind: 'plan' as const, target: null }, await readFound(() => findPr({ repo: planSlug, branch: featureBranchFor(prd, ctx) }, reads)));
  const steps: TargetStep[] = [];
  for (const { repo } of targets) steps.push(...(await stepsOf(repo, plan, { ctx, reads })));
  return mergeOrder({ repositories: plan.repositories, targets: steps, bugs, plan: planPr });
}

async function runList(args: string[], { ctx, stdout, reads }: Io): Promise<number> {
  const { positional, flags } = parseArgs('care', args, { booleans: ['json'] });
  if (positional.length !== 1) throw usageError(USAGE);
  const prd = prdArg('care', '<prd>', positional[0]);
  if (ctx.config.plan === undefined) throw usageError('omni care list: not a plan repository — its config has no plan section.');
  const entries = await careList(prd, { ctx, reads });
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

/** The flags `omni care reply` takes. */
type ReplyFlags = { verdict?: string; body?: string; file?: string; thread?: string; repo?: string };

/** The reply's body from `--verdict` and `--body` or `--file`, ending with the care marker. */
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

/** What `omni care` reads through beyond its io: a test's own `LoopReads`, or the Omni page's sign-in. */
type CareOptions = { reads?: LoopReads | undefined; tokens?: TokenStore | undefined; home?: string | undefined; fetch?: Fetch | undefined; callMs?: number | undefined };

export const care = {
  withoutContext: true,
  async run(args: string[], { cwd, stdout, stderr, exec, env, vars, reads, tokens, home, fetch, callMs }: FreeIo & CareOptions): Promise<number> {
    const [sub, ...rest] = args;
    const ctx = loadContext(cwd, { exec });
    const io: CommandIo = { ctx, stdout, stderr, exec, env, vars };
    if (sub === 'reply') return runReply(rest, io);
    if (sub !== 'state' && sub !== 'list') throw usageError(USAGE);
    const loop = reads ?? omniLoopReads({ askUrl: ctx.config.ask.url, tokens, home, fetch, callMs });
    try {
      return await (sub === 'state' ? runState : runList)(rest, { ...io, reads: loop });
    } catch (error) {
      if (!(error instanceof LoopReadError)) throw error;
      println(stderr, error.line);
      return 1;
    }
  },
} satisfies FreeCommand;
