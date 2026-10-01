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
import { CONFIG_FILE, ConfigError, parseConfig } from 'vertuo-omni-plan/kit/lib/config.mjs';
import { createContext } from 'vertuo-omni-plan/kit/lib/context.mjs';
import { foldersLayout, parseFolderName } from 'vertuo-omni-plan/kit/lib/layout.mjs';
import { upsertOutboxPrComment } from 'vertuo-omni-plan/kit/lib/outbox/comment.mjs';
import { formatReport, gateResult } from 'vertuo-omni-plan/kit/lib/outbox/status.mjs';

export const NOT_ACTIVE_ON_REPO = 'omni-loop is not active on this repo';
export const NOT_ACTIVE_ON_PR = 'omni-loop is not active on this PR';

/**
 * @typedef {{ baseRef: string, headRef: string, headSha: string, labels?: string[] }} PrFacts
 * @typedef {{ id: number | null, body: string }} CommentPlan  `id` null means create, else rewrite that comment
 * @typedef {{ conclusion: 'success' | 'failure' | 'neutral' | 'skipped', title: string, summary: string, comment: CommentPlan | null }} Verdict
 */

/**
 * @param {{
 *   base: string,
 *   head: string,
 *   pr: PrFacts,
 *   changes?: { path: string, status: string }[] | null,
 *   comments?: { id: number, body?: string }[],
 *   now?: () => string,
 * }} input
 * @returns {Verdict}
 */
export function evaluate({ base, head, pr, changes = null, comments = [], now = () => new Date().toISOString() }) {
  const configFile = join(base, CONFIG_FILE);
  if (!existsSync(configFile)) {
    return skipped(NOT_ACTIVE_ON_REPO, `No \`${CONFIG_FILE}\` on the base branch \`${pr.baseRef}\`.`);
  }

  let config;
  try {
    config = parseConfig(readFileSync(configFile, 'utf8'), CONFIG_FILE);
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error;
    const [firstLine] = error.message.split('\n');
    return { conclusion: 'failure', title: firstLine, summary: error.message, comment: null };
  }

  const ctx = createContext(head, config);
  const prd = featurePrd(pr, config, (dir) => folderNames(join(ctx.root, dir)));
  if (prd.skip) return skipped(NOT_ACTIVE_ON_PR, prd.skip);

  const labels = pr.labels ?? [];
  const result = gateResult(prd.number, { ctx, labels, changes });
  return {
    ...conclusionOf(result),
    summary: formatReport(prd.number, result),
    comment: planComment(prd.number, { ctx, comments, now }),
  };
}

function skipped(title, summary) {
  return { conclusion: 'skipped', title, summary, comment: null };
}

/** The `{topic}` the head branch was cut for, read back through `branches.feature`, or `null`. */
function topicOf(headRef, featureTemplate) {
  if (!featureTemplate.includes('{topic}')) return null;
  const [prefix, suffix = ''] = featureTemplate.split('{topic}');
  if (!headRef.startsWith(prefix) || !headRef.endsWith(suffix)) return null;
  const topic = headRef.slice(prefix.length, headRef.length - suffix.length);
  return topic || null;
}

/**
 * The topic a pull request is the feature pull request of — or why it is not one: its base is the
 * default branch and its head matches `branches.feature`. Only such a pull request may be gated
 * (issue 876); whether it is, `prdOfTopic` says from the head's delivery folders.
 * @param {{ baseRef: string, headRef: string }} pr
 * @param {object} config  the base branch's parsed config
 * @returns {{ topic: string } | { skip: string }}
 */
export function featureTopic(pr, config) {
  const { repo, branches } = config;
  if (pr.baseRef !== repo.defaultBranch) {
    return { skip: `The base \`${pr.baseRef}\` is not the default branch \`${repo.defaultBranch}\`.` };
  }
  const topic = topicOf(pr.headRef, branches.feature);
  if (topic === null) {
    return { skip: `The head \`${pr.headRef}\` does not match \`${branches.feature}\`.` };
  }
  return { topic };
}

/** The inbox and shipped folders a feature pull request's PRD folder lives in, under `paths.delivery`. */
export function prdDirs(config) {
  const { inbox, shipped } = foldersLayout('.', config.paths).dirs;
  return [inbox, shipped];
}

/**
 * The PRD whose folder carries `topic`, among the folder names read under `prdDirs` at the head.
 * @returns {{ number: number } | { skip: string }}
 */
export function prdOfTopic(topic, folderNames, config) {
  const parsed = folderNames.map(parseFolderName).find((folder) => folder?.topic === topic);
  if (parsed) return { number: parsed.prd };
  return { skip: `No PRD folder for the topic \`${topic}\` under \`${config.paths.delivery}\`.` };
}

/** The PRD a pull request is the feature pull request of, read from the head snapshot — or why not. */
function featurePrd(pr, config, foldersIn) {
  const feature = featureTopic(pr, config);
  if (feature.skip) return feature;
  return prdOfTopic(feature.topic, prdDirs(config).flatMap(foldersIn), config);
}

/** The folder names directly under `absolute`, or none when it is missing. */
function folderNames(absolute) {
  if (!existsSync(absolute)) return [];
  return readdirSync(absolute, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** The check's conclusion and title for a feature pull request, from the kit gate's result. */
function conclusionOf(result) {
  const reasons = [];
  if (result.items.length > 0) reasons.push(plural(result.items.length, 'open outbox item'));
  if (result.unreworked.length > 0) reasons.push('unreworked drift');
  if ((result.unaccounted ?? []).length > 0) {
    reasons.push(plural(result.unaccounted.length, 'unaccounted risky change'));
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
function planComment(prd, { ctx, comments, now }) {
  let plan = null;
  const client = {
    listComments: () => comments,
    createComment: (body) => {
      plan = { id: null, body };
      return null;
    },
    updateComment: (id, body) => {
      plan = { id, body };
      return null;
    },
  };
  upsertOutboxPrComment({ prd, ctx, now }, client);
  return plan;
}
