// `omni next <prd>… [--json]` — PRD 1139, slice s1: what a loop's next tick does about each PRD named:
// `act` with the skill to run, `wait` with a wake hint, `park` with who, what and the link, or `done`.
// It reads the PRD's phase-0 PR, its feature PR (and, once ready, its care state), its open outbox
// questions on the feature branch with the replies to them, and its board (`buildBoard`), then
// hands the facts to `decideNext` (`kit/lib/next/decide.ts`). It writes nothing on GitHub; the only
// thing it writes is the remote-tracking ref of the feature branch, which it fetches to read the
// outbox as it stands there. GitHub unreachable is a verdict (`wait: github unreachable`), never a
// failure: a loop calling this every tick carries on.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { fillBranch } from '../../lib/board.ts';
import { CARE_QUERY, CareResponseSchema, careState } from '../../lib/care/state.ts';
import type { Context } from '../../lib/context.ts';
import { PrNumberSchema } from '../../lib/ids.ts';
import type { PrNumber, PrdNumber } from '../../lib/ids.ts';
import { parseFolderName } from '../../lib/layout.ts';
import { decideNext } from '../../lib/next/decide.ts';
import type { BoardFacts, FeatureFacts, OutboxFacts, PrdFacts, Verdict } from '../../lib/next/decide.ts';
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

const USAGE = 'usage: omni next <prd>… [--json]';

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

/** The board's facts; `null` with no plan, `unreadable` when it cannot be built. */
function boardFacts(prd: PrdNumber, reader: Reader): BoardFacts | null | 'unreadable' {
  const { ctx } = reader;
  const planPath = ctx.layout.planPath(prd);
  if (planPath === null || !existsSync(join(ctx.root, planPath))) return null;
  try {
    const { result } = buildBoard(prd, { ctx, exec: reader.exec, env: reader.env });
    const having = (state: string) => result.slices.filter((row) => row.state === state).map((row) => row.id);
    return {
      total: result.slices.length,
      merged: having('merged').length,
      wave: result.frontier.wave,
      takeable: [...result.frontier.takeable],
      inFlight: having('in-flight'),
      stuck: having('stuck'),
      unreadable: having('unreadable'),
    };
  } catch {
    return 'unreadable';
  }
}

/** Everything PRD `prd`'s verdict is decided on. Throws what `gh` throws when GitHub cannot be read. */
function readFacts(prd: PrdNumber, reader: Reader): PrdFacts {
  const where = reader.ctx.layout.whereIs(prd);
  const phase0 = openPhase0(prd, reader);
  const topic = where === null ? null : parseFolderName(where.name)?.topic ?? null;
  if (topic === null) {
    if (phase0 !== null) return { prd, shipped: false, phase0, feature: null, board: null, outbox: { questions: 0, answered: false } };
    throw usageError(`omni next: PRD ${prd} has no inbox or shipped folder, and no open phase-0 PR.`);
  }
  const branch = fillBranch(reader.ctx.config.branches.feature, { topic });
  const pr = featurePr(branch, reader);
  const feature = pr === null ? null : featureFacts(pr, reader);
  const outbox = outboxFacts(prd, { branch, pr: pr?.state === 'OPEN' ? pr : null }, reader);
  return { prd, shipped: where?.state === 'shipped', phase0, feature, board: boardFacts(prd, reader), outbox };
}

/** Whether an error is the command's own refusal, which `main()` prints as a usage error. */
function isUsage(error: unknown): boolean {
  return error instanceof Error && error.name === 'UsageError';
}

/** PRD `prd`'s verdict; GitHub unreachable is a `wait`. */
function verdictFor(prd: PrdNumber, reader: Reader): Verdict {
  let facts: PrdFacts;
  try {
    facts = readFacts(prd, reader);
  } catch (error) {
    if (isUsage(error)) throw error;
    facts = { prd, shipped: false, phase0: null, feature: 'unreadable', board: 'unreadable', outbox: 'unreadable' };
  }
  return decideNext(facts);
}

/** One verdict, as one line for a person. */
export function verdictLine(verdict: Verdict): string {
  const head = verdict.verdict === 'act' ? `act ${verdict.skill}` : verdict.verdict;
  const wake = verdict.verdict === 'wait' ? ` (look again in ${Math.round(verdict.wakeHint / 60)} min)` : '';
  return `PRD ${verdict.prd} — ${head}: ${verdict.why}${wake}${verdict.link ? ` — ${verdict.link}` : ''}`;
}

export const next: Command = {
  run: synchronous((args: string[], { ctx, stdout, exec, env }: CommandIo): number => {
    const { positional, flags } = parseArgs('next', args, { booleans: ['json'] });
    if (positional.length === 0) throw usageError(USAGE);
    const prds = positional.map((value) => prdArg('next', '<prd>', value));
    const slug = repoSlug('next', ctx, undefined);
    let ghEnv: Env | undefined;
    try {
      ghEnv = githubEnv(ctx, { exec, env });
    } catch {
      ghEnv = undefined;
    }
    const reader: Reader = { ctx, exec, env, slug, ghEnv };
    const verdicts = prds.map((prd) => verdictFor(prd, reader));
    if (flags.json) println(stdout, JSON.stringify({ prds: verdicts }, null, 2));
    else for (const verdict of verdicts) println(stdout, verdictLine(verdict));
    return 0;
  }),
};
