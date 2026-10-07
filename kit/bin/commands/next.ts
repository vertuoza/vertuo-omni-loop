// `omni next <prd>… [--json]` — PRD 1139, slice s1: what a loop's next tick does about each PRD named:
// `act` with the skill to run, `wait` with a wake hint, `park` with who, what and the link, or `done`.
// It reads the PRD's phase-0 PR, its feature PR (and, once ready, its care state), its open outbox
// questions on the feature branch with the replies to them, and its board (`buildBoard`), then
// hands the facts to `decideNext` (`kit/lib/next/decide.ts`). It writes nothing on GitHub; the only
// thing it writes is the remote-tracking ref of the feature branch, which it fetches to read the
// outbox as it stands there. GitHub unreachable is a verdict (`wait: github unreachable`), never a
// failure: a loop calling this every tick carries on.
//
// Slice s3, the loop plan: with no number, `omni next` drives your own PRDs in inbox, building or
// outbox (the ones `omni status` marks yours). `--plan` orders every slice of the PRDs driven into
// numbered steps (`kit/lib/next/plan.ts`) and keeps it as version 1 at `.omni-loop/local/loop-plan.json`.
// Every later call follows the kept plan (`follow.ts`): it reads each PRD's verdict and board, writes
// the next version when reality broke the plan (`replan.ts`), and prints the verdict of the first
// step not done, or the stop once every PRD is parked or done. Numbers that are exactly the kept
// plan's PRDs follow it too; any other numbers get one verdict each, as in s1.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { fillBranch } from '../../lib/board.ts';
import { CARE_QUERY, CareResponseSchema, careState } from '../../lib/care/state.ts';
import type { Context } from '../../lib/context.ts';
import { PrNumberSchema } from '../../lib/ids.ts';
import type { PrNumber, PrdNumber, WorkSliceId } from '../../lib/ids.ts';
import { parseSpec } from '../../lib/inbox/inbox.ts';
import { parsePlanSlices } from '../../lib/inbox/territory.ts';
import { parseFolderName } from '../../lib/layout.ts';
import { decideNext, stalledSlices } from '../../lib/next/decide.ts';
import type { BoardFacts, FeatureFacts, OutboxFacts, PrdFacts, Verdict } from '../../lib/next/decide.ts';
import { followPlan } from '../../lib/next/follow.ts';
import { formatFollowed, formatPlan, verdictLine } from '../../lib/next/format.ts';
import { planLoop } from '../../lib/next/plan.ts';
import type { Ended, LoopPlan, PlanInputs, PlanSliceInput, PrdInput } from '../../lib/next/plan.ts';
import { replan, replanLine } from '../../lib/next/replan.ts';
import { readLoopPlans, writeLoopPlans } from '../../lib/next/store.ts';
import { readFacts as readStatusFacts } from '../../lib/status/facts.ts';
import { overviewFor } from '../../lib/status/overview.ts';
import { openItemsForPrd } from '../../lib/outbox/comment.ts';
import { parseOutboxItem } from '../../lib/outbox/outbox.ts';
import type { OutboxItem } from '../../lib/types.ts';
import { planReplies } from '../../lib/outbox/replies.ts';
import { parseArgs, prdArg, println, repoSlug, usageError } from '../args.ts';
import { githubClientFor, githubEnv } from '../github.ts';
import type { Command, CommandIo, Env, Exec } from '../io.ts';
import { GhGraphqlSchema } from '../schema.ts';
import { synchronous } from '../synchronous.ts';
import { buildBoard } from './board.ts';

/** The answers of `gh pr list` this file reads: each names only the fields read. */
const GhListedPrSchema = z.looseObject({
  number: PrNumberSchema,
  url: z.string(),
  state: z.string(),
  isDraft: z.boolean().nullish(),
  updatedAt: z.string().nullish(),
  body: z.string().nullish(),
  author: z.looseObject({ login: z.string().nullish() }).nullish(),
});
type ListedPr = z.infer<typeof GhListedPrSchema>;

/** What every read of this command needs. */
type Reader = { ctx: Context; exec: Exec; env: Env; slug: string; ghEnv: Env | undefined };

/** Ranks a person must answer: a medium decision is adopted, never asked. */
const ASKED_RANKS = new Set(['human-action', 'high']);

function gh(args: string[], { exec, ghEnv }: Reader): string {
  return exec('gh', args, { encoding: 'utf8', ...(ghEnv ? { env: ghEnv } : {}) });
}

function git(args: string[], { ctx, exec }: Reader): string {
  return exec('git', args, { cwd: ctx.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function listPrs(args: string[], reader: Reader): ListedPr[] {
  const raw = gh(['pr', 'list', '--repo', reader.slug, ...args, '--json', 'number,url,state,isDraft,updatedAt,body,author', '--limit', '50'], reader);
  return z.array(GhListedPrSchema).parse(JSON.parse(raw));
}

/** The text `prLinks.phase0` puts in a phase-0 PR's body for PRD `prd`, as a pattern that ends there. */
function phase0Link(prd: PrdNumber, ctx: Context): RegExp {
  const text = ctx.config.prLinks.phase0.replace('{prd}', String(prd));
  return new RegExp(`${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?!\\d)`);
}

/** PRD `prd`'s open phase-0 PR, found by its label and the link its body carries. */
function openPhase0(prd: PrdNumber, reader: Reader): { url: string } | null {
  const link = phase0Link(prd, reader.ctx);
  const found = listPrs(['--label', reader.ctx.config.labels.phase0, '--state', 'open'], reader).find((pr) => link.test(pr.body ?? ''));
  return found ? { url: found.url } : null;
}

/** The pull request from `branch`: the open one, else the one updated last. */
function featurePr(branch: string, reader: Reader): ListedPr | null {
  const prs = listPrs(['--head', branch, '--state', 'all'], reader);
  const open = prs.find((pr) => pr.state === 'OPEN');
  return open ?? [...prs].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0] ?? null;
}

/** The care state of a ready PR, as far as the verdict reads it. */
function careFacts(number: PrNumber, reader: Reader): Pick<FeatureFacts, 'checks' | 'fixable' | 'stuck' | 'conflict' | 'threads'> {
  const [owner, name] = reader.slug.split('/');
  const raw = reader.exec('gh', ['api', 'graphql', '--input', '-'], {
    encoding: 'utf8',
    input: JSON.stringify({ query: CARE_QUERY, variables: { owner, name, number } }),
    ...(reader.ghEnv ? { env: reader.ghEnv } : {}),
  });
  const parsed: unknown = JSON.parse(raw);
  const first = GhGraphqlSchema.parse(parsed).errors?.[0];
  if (first) throw new Error(first.message);
  const { ctx } = reader;
  const state = careState(CareResponseSchema.parse(parsed), {
    statusMarker: ctx.markers.status,
    needsFixLabel: ctx.config.labels.needsFix,
    gateContexts: [ctx.config.ci.outboxContext, ctx.config.ci.inboxContext].filter(Boolean),
  });
  return {
    checks: state.checks.state,
    fixable: state.checks.fixable,
    stuck: state.checks.stuck,
    conflict: state.mergeable === 'CONFLICTING',
    threads: state.threads.filter((thread) => thread.needs !== null).length,
  };
}

function featureFacts(pr: ListedPr, reader: Reader): FeatureFacts {
  const isDraft = Boolean(pr.isDraft);
  const base = { url: pr.url, state: pr.state, isDraft, author: pr.author?.login ?? null };
  if (pr.state !== 'OPEN' || isDraft) return { ...base, checks: 'none', fixable: false, stuck: false, conflict: false, threads: 0 };
  return { ...base, ...careFacts(pr.number, reader) };
}

/** The open items under the outbox dir as they stand on `ref`; `null` when the ref cannot be read. */
function itemsOnBranch(ref: string, dir: string, reader: Reader): OutboxItem[] | null {
  let listed: string;
  try {
    listed = git(['ls-tree', '-r', '--name-only', ref, '--', dir], reader);
  } catch {
    return null;
  }
  const files = listed
    .split('\n')
    .map((line) => line.trim())
    .filter((file) => file.endsWith('.md') && !file.endsWith('/settled.md') && !file.slice(dir.length).includes('/accounts/'));
  return files.flatMap((file) => {
    const parsed = parseOutboxItem(git(['show', `${ref}:${file}`], reader), { file });
    return parsed.ok ? [parsed.item] : [];
  });
}

/** The PRD's open items: on the feature branch as last fetched, else in this checkout. */
function openItems(prd: PrdNumber, branch: string, reader: Reader): OutboxItem[] {
  const { ctx } = reader;
  const dir = ctx.layout.outboxDir(prd);
  if (dir === null) return [];
  const remote = ctx.config.repo.remote;
  try {
    git(['fetch', '--quiet', remote, branch], reader);
  } catch {
    // An old ref, or none, is read below; a feature branch not pushed yet has its items here.
  }
  return itemsOnBranch(`${remote}/${branch}`, dir, reader) ?? openItemsForPrd(prd, { ctx });
}

/** The open questions, and whether a reply on the feature PR answers one of them. */
function outboxFacts(prd: PrdNumber, { branch, pr }: { branch: string; pr: ListedPr | null }, reader: Reader): OutboxFacts {
  const items = openItems(prd, branch, reader);
  const questions = items.filter((item) => ASKED_RANKS.has(item.rank)).length;
  if (questions === 0 || pr === null) return { questions, answered: false };
  const comments = githubClientFor(reader.ctx, { repo: reader.slug, issue: pr.number, exec: reader.exec, env: reader.env }).listComments();
  const { settle } = planReplies({ comments, items, markers: reader.ctx.markers });
  return { questions, answered: settle.length > 0 };
}

/** The board's facts and its slices; `null` with no plan, `unreadable` when the board cannot be
 * built, its slices then read from the plan alone, each `unreadable`. */
function boardFacts(prd: PrdNumber, reader: Reader): { board: BoardFacts | null | 'unreadable'; slices: PlanSliceInput[] | null } {
  const { ctx } = reader;
  const planPath = ctx.layout.planPath(prd);
  if (planPath === null || !existsSync(join(ctx.root, planPath))) return { board: null, slices: null };
  try {
    const { result } = buildBoard(prd, { ctx, exec: reader.exec, env: reader.env });
    const having = (state: string) => result.slices.filter((row) => row.state === state).map((row) => row.id);
    const { stallDays } = ctx.config.limits;
    const board: BoardFacts = {
      total: result.slices.length,
      merged: having('merged').length,
      wave: result.frontier.wave,
      takeable: [...result.frontier.takeable],
      inFlight: having('in-flight'),
      stalled: stalledSlices(result.slices, { now: Date.now(), stallDays, prUrl: (pr) => `https://github.com/${reader.slug}/pull/${pr}` }),
      stallDays,
      stuck: having('stuck'),
      unreadable: having('unreadable'),
    };
    return { board, slices: result.slices.map(({ id, territory, wave, state }) => ({ id, territory, wave, state })) };
  } catch {
    return { board: 'unreadable', slices: planSlices(join(ctx.root, planPath)) };
  }
}

/** A plan's slices as the plan declares them, each `unreadable`; `null` when the plan cannot be read. */
function planSlices(path: string): PlanSliceInput[] | null {
  try {
    return parsePlanSlices(readFileSync(path, 'utf8')).map(({ id, territory, wave }) => ({ id, territory, wave, state: 'unreadable' }));
  } catch {
    return null;
  }
}

/** The PRDs PRD `prd`'s spec says it is blocked by; none when the spec cannot be read. */
function blockersOf(prd: PrdNumber, ctx: Context): PrdNumber[] {
  const path = ctx.layout.specPath(prd);
  if (path === null) return [];
  try {
    const parsed = parseSpec(readFileSync(join(ctx.root, path), 'utf8'));
    return parsed.ok && parsed.record.blockedBy !== 'none' ? [...parsed.record.blockedBy] : [];
  } catch {
    return [];
  }
}

/** PRD `prd`'s folder in this checkout: its topic, and whether it has shipped; `null` with none. */
function folderOf(prd: PrdNumber, ctx: Context): { topic: string; shipped: boolean } | null {
  const where = ctx.layout.whereIs(prd);
  const parsed = where === null ? null : parseFolderName(where.name);
  return where === null || parsed === null ? null : { topic: parsed.topic, shipped: where.state === 'shipped' };
}

/** Everything PRD `prd`'s verdict is decided on, and its slices. Throws what `gh` throws when GitHub
 * cannot be read. */
function readFacts(prd: PrdNumber, reader: Reader): { facts: PrdFacts; slices: PlanSliceInput[] | null } {
  const folder = folderOf(prd, reader.ctx);
  const phase0 = openPhase0(prd, reader);
  if (folder === null) {
    if (phase0 !== null) return { facts: { prd, shipped: false, phase0, feature: null, board: null, outbox: { questions: 0, answered: false } }, slices: null };
    throw usageError(`omni next: PRD ${prd} has no inbox or shipped folder, and no open phase-0 PR.`);
  }
  const branch = fillBranch(reader.ctx.config.branches.feature, { topic: folder.topic });
  const pr = featurePr(branch, reader);
  const open = pr?.state === 'OPEN' ? pr : null;
  const feature = pr === null ? null : featureFacts(pr, reader);
  const { board, slices } = boardFacts(prd, reader);
  return { facts: { prd, shipped: folder.shipped, phase0, feature, board, outbox: outboxFacts(prd, { branch, pr: open }, reader) }, slices };
}

/** Whether an error is the command's own refusal, which `main()` prints as a usage error. */
function isUsage(error: unknown): boolean {
  return error instanceof Error && error.name === 'UsageError';
}

/** How a PRD ended, from its facts: its feature PR merged or closed, or its folder shipped. */
function endedOf(facts: PrdFacts): Ended | null {
  const { feature } = facts;
  if (feature !== null && feature !== 'unreadable' && feature.state !== 'OPEN') return feature.state === 'MERGED' ? 'merged' : 'closed';
  return facts.shipped && feature === null ? 'shipped' : null;
}

/** PRD `prd`'s verdict, and what the loop plan reads of it; GitHub unreachable is a `wait`. */
function readPrd(prd: PrdNumber, reader: Reader): { verdict: Verdict; input: PrdInput } {
  let read: { facts: PrdFacts; slices: PlanSliceInput[] | null };
  try {
    read = readFacts(prd, reader);
  } catch (error) {
    if (isUsage(error)) throw error;
    const planPath = reader.ctx.layout.planPath(prd);
    const facts: PrdFacts = { prd, shipped: false, phase0: null, feature: 'unreadable', board: 'unreadable', outbox: 'unreadable' };
    read = { facts, slices: planPath === null ? null : planSlices(join(reader.ctx.root, planPath)) };
  }
  const input: PrdInput = { prd, blockedBy: blockersOf(prd, reader.ctx), slices: read.slices, ended: endedOf(read.facts) };
  return { verdict: decideNext(read.facts), input };
}

/** The PRDs `omni status` marks yours, in inbox, building or outbox, lowest first. */
function yourPrds(reader: Reader): PrdNumber[] {
  const facts = readStatusFacts({ ctx: reader.ctx, exec: reader.exec });
  if (facts === null) throw usageError('omni next: cannot read the default branch to tell which PRDs are yours; run omni status --fetch, or name them: omni next <prd>…');
  const { yours } = overviewFor(facts);
  if (yours.state !== 'known') {
    const why = yours.state === 'no-email' ? 'no user.email is set here' : 'this clone is shallow';
    throw usageError(`omni next: cannot tell which PRDs are yours (${why}); name them: omni next <prd>…`);
  }
  return yours.rows.filter((row) => row.stage !== 'prd').map((row) => row.prd).sort((a, b) => a - b);
}

/** Every driven PRD read once: the verdicts, and what the plan is computed from. */
function readAll(prds: readonly PrdNumber[], reader: Reader): { verdicts: Verdict[]; inputs: PlanInputs } {
  const read = prds.map((prd) => readPrd(prd, reader));
  const driven = new Set(prds);
  const outside = [...new Set(read.flatMap(({ input }) => input.blockedBy))].filter((prd) => !driven.has(prd));
  const shipped = outside.filter((prd) => reader.ctx.layout.whereIs(prd)?.state === 'shipped');
  return { verdicts: read.map(({ verdict }) => verdict), inputs: { prds: read.map(({ input }) => input), shipped } };
}

/** Where a tick prints, and how. */
type Out = { reader: Reader; out: (line: string) => void; json: boolean };

/** `--plan`: a new loop plan, version 1, kept and printed. */
function startPlan(prds: readonly PrdNumber[], { reader, out, json }: Out): number {
  const plan = planLoop(readAll(prds, reader).inputs);
  writeLoopPlans(reader.ctx.root, [plan]);
  if (json) out(JSON.stringify({ plan }, null, 2));
  else for (const line of formatPlan(plan)) out(line);
  return 0;
}

/** The plan a tick follows: the kept one, its next version when reality broke it, or version 1 made
 * now when none is kept. Each new version is kept. */
function currentPlan(kept: readonly LoopPlan[], inputs: PlanInputs, root: string): { plan: LoopPlan; replanned: string | null } {
  const last = kept.at(-1);
  if (last === undefined) {
    const plan = planLoop(inputs);
    writeLoopPlans(root, [plan]);
    return { plan, replanned: null };
  }
  const next = replan(last, inputs);
  if (next === null) return { plan: last, replanned: null };
  writeLoopPlans(root, [...kept, next]);
  return { plan: next, replanned: replanLine(next) };
}

/** A tick on the kept plan: replanned when reality broke it, then the first step not done, or the stop. */
function followKept(prds: readonly PrdNumber[], kept: readonly LoopPlan[], { reader, out, json }: Out): number {
  const { verdicts, inputs } = readAll(prds, reader);
  const { plan, replanned } = currentPlan(kept, inputs, reader.ctx.root);
  const merged = new Map(inputs.prds.map((input) => [input.prd, new Set<WorkSliceId>((input.slices ?? []).filter((slice) => slice.state === 'merged').map((slice) => slice.id))] as const));
  const followed = followPlan(plan, { verdicts: new Map(verdicts.map((verdict) => [verdict.prd, verdict] as const)), merged, shipped: new Set(inputs.shipped) });
  if (!json) {
    if (replanned !== null) out(replanned);
    for (const line of formatFollowed(plan, followed)) out(line);
    return 0;
  }
  const step = followed.state === 'step' ? followed.step : null;
  const tick = {
    plan: { version: plan.version, steps: plan.steps.length },
    replanned,
    stop: followed.state === 'stop',
    step: step && { step: step.step, of: plan.steps.length, prd: step.prd, kind: step.kind, wave: step.wave, slices: step.slices },
    verdict: followed.state === 'step' ? followed.verdict : null,
    waiting: followed.state === 'stop' ? followed.waiting : [],
    prds: verdicts,
  };
  out(JSON.stringify(tick, null, 2));
  return 0;
}

/** Whether `prds` are exactly the PRDs `plan` drives. */
function samePrds(prds: readonly PrdNumber[], plan: LoopPlan): boolean {
  const named = [...new Set(prds)].sort((a, b) => a - b);
  return named.length === plan.prds.length && named.every((prd, index) => prd === plan.prds[index]);
}

/** The PRDs that are yours, or a usage error when none is. */
function yoursOrRefuse(reader: Reader, flag: string): PrdNumber[] {
  const prds = yourPrds(reader);
  if (prds.length === 0) throw usageError(`omni next: no PRD of yours is in inbox, building or outbox; name one: omni next <prd>…${flag}`);
  return prds;
}

/** The environment `gh` runs with, or undefined when none can be made. */
function ghEnvOf(ctx: Context, exec: Exec, env: Env): Env | undefined {
  try {
    return githubEnv(ctx, { exec, env });
  } catch {
    return undefined;
  }
}

/** One verdict per PRD named, outside any loop plan. */
function printVerdicts(named: readonly PrdNumber[], { reader, out, json }: Out): number {
  const verdicts = named.map((prd) => readPrd(prd, reader).verdict);
  if (json) out(JSON.stringify({ prds: verdicts }, null, 2));
  else for (const verdict of verdicts) out(verdictLine(verdict));
  return 0;
}

/** A tick: the kept plan followed (or yours, planned now), or one verdict per PRD named. */
function tick(named: readonly PrdNumber[], io: Out): number {
  const kept = readLoopPlans(io.reader.ctx.root);
  const last = kept.at(-1);
  if (named.length === 0) return last === undefined ? followKept(yoursOrRefuse(io.reader, ''), [], io) : followKept(last.prds, kept, io);
  if (last !== undefined && samePrds(named, last)) return followKept(last.prds, kept, io);
  return printVerdicts(named, io);
}

export const next: Command = {
  run: synchronous((args: string[], { ctx, stdout, exec, env }: CommandIo): number => {
    const { positional, flags } = parseArgs('next', args, { booleans: ['json', 'plan'] });
    const named = positional.map((value) => prdArg('next', '<prd>', value));
    const slug = repoSlug('next', ctx, undefined);
    const reader: Reader = { ctx, exec, env, slug, ghEnv: ghEnvOf(ctx, exec, env) };
    const io: Out = { reader, out: (line: string) => { println(stdout, line); }, json: flags.json === true };
    if (flags.plan) return startPlan(named.length > 0 ? [...new Set(named)] : yoursOrRefuse(reader, ' --plan'), io);
    return tick(named, io);
  }),
};
