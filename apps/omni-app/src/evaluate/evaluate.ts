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
import { parseFolderName } from 'vertuo-omni-plan/kit/lib/layout.ts';
import { upsertOutboxPrComment } from 'vertuo-omni-plan/kit/lib/outbox/comment.ts';
import { formatReport, gateResult, type GateResult } from 'vertuo-omni-plan/kit/lib/outbox/status.ts';
import type { Config } from 'vertuo-omni-plan/kit/lib/types.ts';

export const NOT_ACTIVE_ON_REPO = 'omni-loop is not active on this repo';
export const NOT_ACTIVE_ON_PR = 'omni-loop is not active on this PR';

export type PrFacts = { baseRef: string; headRef: string; headSha: string; labels?: string[] };
/** `id` null means create, else rewrite that comment. */
export type CommentPlan = { id: number | null; body: string };
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
  comments?: { id: number; body?: string | null }[];
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
  const prd = featurePrd(pr, ctx);
  if ('skip' in prd) return skipped(NOT_ACTIVE_ON_PR, prd.skip);

  const labels = pr.labels ?? [];
  const result = gateResult(prd.number, { ctx, labels, changes });
  return {
    ...conclusionOf(result),
    summary: formatReport(prd.number, result),
    comment: planComment(prd.number, { ctx, comments, now }),
  };
}

function skipped(title: string, summary: string): Verdict {
  return { conclusion: 'skipped', title, summary, comment: null };
}

/** The `{topic}` the head branch was cut for, read back through `branches.feature`, or `null`. */
function topicOf(headRef: string, featureTemplate: string): string | null {
  if (!featureTemplate.includes('{topic}')) return null;
  const [prefix = '', suffix = ''] = featureTemplate.split('{topic}');
  if (!headRef.startsWith(prefix) || !headRef.endsWith(suffix)) return null;
  const topic = headRef.slice(prefix.length, headRef.length - suffix.length);
  return topic || null;
}

/** The PRD a pull request is the feature pull request of — or why it is not one. */
function featurePrd(pr: PrFacts, ctx: Context): { skip: string } | { number: number } {
  const { repo, branches } = ctx.config;
  if (pr.baseRef !== repo.defaultBranch) {
    return { skip: `The base \`${pr.baseRef}\` is not the default branch \`${repo.defaultBranch}\`.` };
  }
  const topic = topicOf(pr.headRef, branches.feature);
  if (topic === null) {
    return { skip: `The head \`${pr.headRef}\` does not match \`${branches.feature}\`.` };
  }
  const number = prdForTopic(topic, ctx);
  if (number === null) {
    return { skip: `No PRD folder for the topic \`${topic}\` under \`${ctx.config.paths.delivery}\`.` };
  }
  return { number };
}

/** The PRD number whose inbox or shipped folder carries `topic`, in the head snapshot. */
function prdForTopic(topic: string, ctx: Context): number | null {
  for (const dir of [ctx.layout.dirs.inbox, ctx.layout.dirs.shipped]) {
    const absolute = join(ctx.root, dir);
    if (!existsSync(absolute)) continue;
    for (const entry of readdirSync(absolute, { withFileTypes: true })) {
      const parsed = entry.isDirectory() ? parseFolderName(entry.name) : null;
      if (parsed?.topic === topic) return parsed.prd;
    }
  }
  return null;
}

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

/** The check's conclusion and title for a feature pull request, from the kit gate's result. */
function conclusionOf(result: GateResult): { conclusion: Conclusion; title: string } {
  const reasons: string[] = [];
  if (result.items.length > 0) reasons.push(plural(result.items.length, 'open outbox item'));
  if (result.unreworked.length > 0) reasons.push('unreworked drift');
  const unaccounted = result.unaccounted ?? [];
  if (unaccounted.length > 0) {
    reasons.push(plural(unaccounted.length, 'unaccounted risky change'));
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
  prd: number,
  { ctx, comments, now }: { ctx: Context; comments: { id: number; body?: string | null }[]; now: () => string },
): CommentPlan | null {
  let plan: CommentPlan | null = null;
  const client = {
    listComments: () => comments,
    createComment: (body: string) => {
      plan = { id: null, body };
      return null;
    },
    updateComment: (id: number, body: string) => {
      plan = { id, body };
      return null;
    },
  };
  upsertOutboxPrComment({ prd, ctx, now }, client);
  return plan;
}
