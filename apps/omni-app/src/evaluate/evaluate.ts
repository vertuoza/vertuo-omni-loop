// `evaluate`: two snapshot folders, the pull request's facts and (optionally) its changed files in,
// the outbox check's `{ conclusion, title, summary, comment }` out. Pure: it touches no network and
// runs no repository code — it only parses YAML and Markdown through the kit's own schemas.
//
// Config from base, delivery from head (PRD 28, decision 4). `base` is a folder holding the base
// branch's `.omni-loop/config.yml` (or nothing, on a repository that has not activated omni-loop);
// `head` is a folder holding `paths.delivery` at the head SHA. The kit's context is rooted at `head`
// with the config parsed from `base`, so a pull request can neither rename the override label nor
// repoint the gate: a `.omni-loop/config.yml` inside `head` is never read.
//
// The gate, its report and the pull request comment are the kit's, imported unchanged: `parseConfig`,
// `gateResult`, `formatReport` and `upsertOutboxPrComment` (run against an in-memory client built from
// the comments the caller hands in, so the body and the comment to rewrite come back as data for
// `publish` to post).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CONFIG_FILE, ConfigError, parseConfig } from 'vertuo-omni-plan/kit/lib/config.ts';
import { createContext, type Context } from 'vertuo-omni-plan/kit/lib/context.ts';
import { parsePrd, type CommentId, type PrdNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { foldersLayout, parseFolderName } from 'vertuo-omni-plan/kit/lib/layout.ts';
import { bugRoot } from 'vertuo-omni-plan/kit/lib/bug/verdict.ts';
import { issuePrefix, numberedFolders } from 'vertuo-omni-plan/kit/lib/fix-verdict.ts';
import { diskSource, type KnowledgeSource } from 'vertuo-omni-plan/kit/lib/knowledge/registers.ts';
import type { Change } from 'vertuo-omni-plan/kit/lib/outbox/account.ts';
import { upsertOutboxPrComment } from 'vertuo-omni-plan/kit/lib/outbox/comment.ts';
import {
  fixGateResult,
  fixLawFailures,
  fixOutboxContext,
  formatReport,
  gateResult,
  lawsTouched,
  type GateResult,
  type TouchedLaw,
} from 'vertuo-omni-plan/kit/lib/outbox/status.ts';
import type { Config } from 'vertuo-omni-plan/kit/lib/types.ts';
import { visualRoot } from 'vertuo-omni-plan/kit/lib/visual/verdict.ts';

export const NOT_ACTIVE_ON_REPO = 'omni-loop is not active on this repo';
export const NOT_ACTIVE_ON_PR = 'omni-loop is not active on this PR';

export type PrFacts = { baseRef: string; headRef: string; headSha: string; labels?: string[] };
/** `id` null means create, else rewrite that comment. */
export type CommentPlan = { id: CommentId | null; body: string };
export type Conclusion = 'success' | 'failure' | 'neutral' | 'skipped';
export type Verdict = { conclusion: Conclusion; title: string; summary: string; comment: CommentPlan | null };

export function evaluate({
  base,
  head,
  pr,
  changes = null,
  comments = [],
  now = () => new Date().toISOString(),
}: {
  base: string;
  head: string;
  pr: PrFacts;
  changes?: { path: string; status: string }[] | null;
  comments?: { id: CommentId; body?: string | null }[];
  now?: () => string;
}): Verdict {
  const configFile = join(base, CONFIG_FILE);
  if (!existsSync(configFile)) {
    return skipped(NOT_ACTIVE_ON_REPO, `No \`${CONFIG_FILE}\` on the base branch \`${pr.baseRef}\`.`);
  }

  let config: Config;
  try {
    config = parseConfig(readFileSync(configFile, 'utf8'), CONFIG_FILE);
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error;
    const [firstLine = ''] = error.message.split('\n');
    return { conclusion: 'failure', title: firstLine, summary: error.message, comment: null };
  }

  const ctx = createContext(head, config);
  const kind = pullKind(pr, config);
  if ('skip' in kind) return skipped(NOT_ACTIVE_ON_PR, kind.skip);

  const labels = pr.labels ?? [];
  // The knowledge folder as the base holds it, beside its config (PRD 1342): `law-demoted` reads it.
  const knowledge = config.laws.source === 'knowledge' ? diskSource(base) : null;
  if (kind.kind === 'fix') return fixVerdict(kind.topic, { ctx, labels, changes: changes ?? [], base: knowledge, comments, now });
  if (kind.kind !== 'feature') return lawsVerdict(kind.kind, { ctx, changes: changes ?? [], base: knowledge });

  const prd = prdOfTopic(kind.topic, prdDirs(config).flatMap((dir) => folderNames(join(ctx.root, dir))), config);
  if ('skip' in prd) return skipped(NOT_ACTIVE_ON_PR, prd.skip);
  const result = gateResult(prd.number, { ctx, labels, changes, base: knowledge });
  return {
    ...conclusionOf(result),
    summary: formatReport(prd.number, result),
    comment: planComment(prd.number, { ctx, comments, now }),
  };
}

/** The laws a range touches, one line each, or none. */
function lawLines(laws: readonly TouchedLaw[]): string[] {
  return laws.map((law) => `  - ${law.id}: ${law.statement}`);
}

/** A fix's folder for the issue its branch topic starts with (`<n>-<slug>`): a bug's or a visual fix's. */
function fixOf(topic: string, ctx: Context): { folder: string; number: PrdNumber } | null {
  const digits = /^(\d+)-/.exec(topic)?.[1];
  if (digits === undefined || Number(digits) === 0) return null;
  const number = parsePrd(digits);
  const prefix = issuePrefix(number);
  const [folder] = [bugRoot(ctx), visualRoot(ctx)].flatMap((root) => numberedFolders(ctx, root, prefix));
  return folder === undefined ? null : { folder, number };
}

/**
 * The check of a fix PR (PRD 1342): green unless its range changes a law; then its folder's outbox
 * holds the item a person answers, as a feature PR's does, and its comment is posted the same way.
 */
function fixVerdict(
  topic: string,
  { ctx, labels, changes, base, comments, now }: {
    ctx: Context;
    labels: readonly string[];
    changes: readonly Change[];
    base: KnowledgeSource | null;
    comments: { id: CommentId; body?: string | null }[];
    now: () => string;
  },
): Verdict {
  const fix = fixOf(topic, ctx);
  const result = fixGateResult({ ctx, fix, labels, changes, base });
  const laws = lawsTouched(changes, { ctx, base });
  const subject = fix === null ? `fix PR \`${topic}\` (no fix folder)` : `fix ${fix.folder}`;
  const failures = fixLawFailures(result).map((line) => `  - ${line}`);
  const summary = [
    formatReport(fix?.number ?? parsePrd(1), result, { subject }),
    ...(failures.length > 0 ? ["A change to a law on a fix PR is answered by a person, in the fix's outbox:", ...failures] : []),
    ...(laws.length > 0 ? ['Laws this range touches:', ...lawLines(laws)] : []),
  ].join('\n');
  const { conclusion, title } = conclusionOf(result, { unaccounted: 'unaccounted change', suffix: ' to a law' });
  const named = conclusion === 'success' || laws.length === 0 ? title : `${title} — ${laws.map((law) => law.id).join(', ')}`;
  const comment = fix === null ? null : planComment(fix.number, { ctx: fixOutboxContext(ctx, fix.folder, fix.number), comments, now });
  return { conclusion, title: named, summary, comment };
}

/** What a knowledge PR's and an enforce PR's check calls it. */
const LAWS_PR: Readonly<Record<'knowledge' | 'law', string>> = Object.freeze({ knowledge: 'Knowledge PR', law: 'Enforce PR' });

/**
 * The check of a knowledge PR or an enforce PR (PRD 1342): never blocked, since a person merging one
 * is the answer to every change to a law it holds; it lists the laws its range touches.
 */
function lawsVerdict(kind: 'knowledge' | 'law', { ctx, changes, base }: { ctx: Context; changes: readonly Change[]; base: KnowledgeSource | null }): Verdict {
  const laws = lawsTouched(changes, { ctx, base });
  const what = LAWS_PR[kind];
  const title = laws.length === 0 ? `${what}: no law touched` : `${what}: ${plural(laws.length, 'law')} touched`;
  const summary = [
    `${what}: never blocked. A person merging it answers every change to a law it holds.`,
    ...(laws.length > 0 ? ['Laws this range touches:', ...lawLines(laws)] : ['It touches no law.']),
  ].join('\n');
  return { conclusion: 'success', title, summary, comment: null };
}

function skipped(title: string, summary: string): Verdict {
  return { conclusion: 'skipped', title, summary, comment: null };
}

/** The placeholder a branch template is filled at: `{topic}`, or a law's `{id}`. */
const PLACEHOLDER = /\{(?:topic|id)\}/;

/** What a head branch was cut for, read back through a branch template, or `null`. */
function topicOf(headRef: string, template: string): string | null {
  if (!PLACEHOLDER.test(template)) return null;
  const [prefix = '', suffix = ''] = template.split(PLACEHOLDER);
  if (!headRef.startsWith(prefix) || !headRef.endsWith(suffix)) return null;
  const topic = headRef.slice(prefix.length, headRef.length - suffix.length);
  return topic || null;
}

/** The kinds of pull request into the default branch the check grades, by their branch shape. */
export type PullKind = { kind: 'feature' | 'fix' | 'knowledge' | 'law'; topic: string };

/**
 * What a pull request is to the check, or why the check does not run on it. Its base must be the
 * default branch. Its head matching `branches.feature` makes it a feature pull request (issue 876),
 * gated once `prdOfTopic` finds its PRD in the head's delivery folders. With `laws.source:
 * knowledge` (PRD 1342), a head matching `branches.law` is an enforce PR, `branches.knowledge` a
 * knowledge PR, and `branches.fix` a fix PR: each graded on the laws it touches.
 */
export function pullKind(pr: Pick<PrFacts, 'baseRef' | 'headRef'>, config: Config): PullKind | { skip: string } {
  const { repo, branches } = config;
  if (pr.baseRef !== repo.defaultBranch) {
    return { skip: `The base \`${pr.baseRef}\` is not the default branch \`${repo.defaultBranch}\`.` };
  }
  const shapes: [PullKind['kind'], string][] = [['feature', branches.feature]];
  if (config.laws.source === 'knowledge') shapes.push(['law', branches.law], ['knowledge', branches.knowledge], ['fix', branches.fix]);
  for (const [kind, template] of shapes) {
    const topic = topicOf(pr.headRef, template);
    if (topic !== null) return { kind, topic };
  }
  return { skip: `The head \`${pr.headRef}\` does not match \`${branches.feature}\`.` };
}

/** The inbox and shipped folders a feature pull request's PRD folder lives in, under `paths.delivery`. */
export function prdDirs(config: Config): string[] {
  const { inbox, shipped } = foldersLayout('.', config.paths).dirs;
  return [inbox, shipped];
}

/** The PRD whose folder carries `topic`, among the folder names read under `prdDirs` at the head. */
export function prdOfTopic(topic: string, folderNames: string[], config: Config): { number: PrdNumber } | { skip: string } {
  const parsed = folderNames.map(parseFolderName).find((folder) => folder?.topic === topic);
  if (parsed) return { number: parsed.prd };
  return { skip: `No PRD folder for the topic \`${topic}\` under \`${config.paths.delivery}\`.` };
}

/** A plan repository's PRD, as `owner/repo` and its number. */
export type PlanPrd = { repo: string; prd: PrdNumber };

const CLOSES = /Closes #\d+/;
const PART_OF = /^Part of ([\w.-]+\/[\w.-]+)#(\d+)\b/m;

/**
 * The plan repository's PRD a target feature PR is part of, read from its body (issue 1202): a line
 * `Part of <owner>/<repo>#<n>` naming a repository other than `slug`, the one `/omni:ultra-yolo` opens
 * a target feature PR with. Null for any other body: one saying `Closes #<n>` (the single-repository
 * feature PR, gated here), one naming this same repository (a sub-PR's shape), or neither.
 */
export function planPrdOf(body: string, slug: string): PlanPrd | null {
  if (CLOSES.test(body)) return null;
  const match = PART_OF.exec(body);
  if (!match) return null;
  const [, repo = '', prd = ''] = match;
  if (repo.toLowerCase() === slug.toLowerCase()) return null;
  return { repo, prd: parsePrd(prd) };
}

/**
 * The check of a target feature PR: its PRD has no outbox in this repository, so it passes here and
 * points to the plan PR that grades it, or to the PRD issue when that PR could not be found. It does
 * not follow the plan PR's check: nothing would re-run it when that check changes, so a red copy here
 * would stay red after the plan PR went green.
 */
export function deferredOutput(plan: PlanPrd, planPr: number | null): { title: string; summary: string } {
  const where = planPr === null
    ? `[${plan.repo}#${plan.prd}](https://github.com/${plan.repo}/issues/${plan.prd}), the PRD (its plan PR could not be read from here)`
    : `[${plan.repo}#${planPr}](https://github.com/${plan.repo}/pull/${planPr}), the plan PR`;
  return {
    title: `PRD ${plan.prd} is graded on ${plan.repo}'s plan PR`,
    summary: [
      `This pull request is part of ${plan.repo}'s PRD ${plan.prd}, whose outbox lives in that repository, not here.`,
      `Its outbox check is graded on ${where}.`,
      '',
      'Mode: deferred. This check passes here without following the plan PR\'s check: read that one before merging.',
    ].join('\n'),
  };
}

/** The folder names directly under `absolute`, or none when it is missing. */
function folderNames(absolute: string): string[] {
  if (!existsSync(absolute)) return [];
  return readdirSync(absolute, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * The check's conclusion and title for a feature pull request, or a fix PR, from the kit gate's
 * result. `noun` words its unaccounted changes: risky ones on a feature PR, changes to a law on a fix.
 */
function conclusionOf(
  result: GateResult,
  noun: { unaccounted: string; suffix: string } = { unaccounted: 'unaccounted risky change', suffix: '' },
): { conclusion: Conclusion; title: string } {
  const reasons: string[] = [];
  if (result.items.length > 0) reasons.push(plural(result.items.length, 'open outbox item'));
  if (result.unreworked.length > 0) reasons.push('unreworked drift');
  const unaccounted = result.unaccounted ?? [];
  if (unaccounted.length > 0) {
    reasons.push(`${plural(unaccounted.length, noun.unaccounted)}${noun.suffix}`);
  }
  if (reasons.length === 0) return { conclusion: 'success', title: 'Outbox clear' };
  if (result.overridden) {
    return { conclusion: 'neutral', title: `Override in effect (${result.overrideLabel})` };
  }
  return { conclusion: 'failure', title: reasons.join(' and ') };
}

/**
 * The feature pull request's outbox comment, as the kit's `omni comment --pr` writes it — computed
 * against the comments already on the pull request, posted by nobody here.
 */
function planComment(
  prd: PrdNumber,
  { ctx, comments, now }: { ctx: Context; comments: { id: CommentId; body?: string | null }[]; now: () => string },
): CommentPlan | null {
  let plan: CommentPlan | null = null;
  const client = {
    listComments: () => comments,
    createComment: (body: string) => {
      plan = { id: null, body };
      return null;
    },
    updateComment: (id: CommentId, body: string) => {
      plan = { id, body };
      return null;
    },
  };
  upsertOutboxPrComment({ prd, ctx, now }, client);
  return plan;
}
