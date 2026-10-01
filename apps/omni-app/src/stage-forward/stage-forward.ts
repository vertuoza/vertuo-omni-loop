// `stage-forward` (PRD 587): a pull request event in, the PRD stage it shows out, forwarded to galaxy.
//
// Five moves of the loop record a stage: a merged phase-0 PR (inbox), a merged slice PR into its
// feature branch (building), the feature PR marked ready (outbox), the merged feature PR (shipped) and
// an opened retro PR (retro). `toStageEvent` recognises them by the branch shapes, reads the topic
// from the branch and the PRD number from the body's link line, and gives
// `{ repository, topic, prd | null, stage, at }`. `forwardStageEvent` POSTs it to galaxy's
// `/api/stages/event`, signed with an HMAC-SHA256 over the body (`STAGE_EVENT_SECRET`, shared by both
// apps). A missing secret or a failed POST is logged and never thrown: the 15-minute sync is the truth
// and repairs a missed event, so nothing is retried.
//
// The shapes are the kit's defaults: the webhook reads no GitHub API, so it cannot read the
// repository's own config. A repository with other branch shapes gets its stages from the sync alone.
import { createHmac } from 'node:crypto';
import { z } from 'zod';
import { parseConfig } from 'vertuo-omni-plan/kit/lib/config.ts';
import { messageOf } from '../outbox-check/github-schema.ts';

/** The header galaxy reads the signature from: `sha256=<hex>`. */
export const STAGE_SIGNATURE_HEADER = 'x-omni-signature-256';

/** Galaxy's production host, when `GALAXY_URL` is not set. */
const DEFAULT_GALAXY_URL = 'https://vertuo-omni-loop-galaxy.vercel.app';

/** The kit's default branch shapes and link lines. */
const DEFAULT_SHAPES = (() => {
  const { branches, prLinks } = parseConfig('kit: 1');
  return Object.freeze({ branches, prLinks });
})();

export type EventStage = 'inbox' | 'building' | 'outbox' | 'shipped' | 'retro';
export type StageEvent = { repository: string; topic: string; prd: number | null; stage: EventStage; at: string };
type Branches = { phase0: string; slice: string; feature: string; retro: string };
export type Shapes = { branches: Branches; prLinks: Record<string, string> };

/** The parts of a pull request event the stages read; a field of another type reads as none. */
const PullEventSchema = z.looseObject({
  action: z.unknown(),
  repository: z.looseObject({ full_name: z.string().nullish(), default_branch: z.string().nullish() }).nullish(),
  pull_request: z
    .looseObject({
      head: z.looseObject({ ref: z.unknown() }).nullish(),
      base: z.looseObject({ ref: z.unknown() }).nullish(),
      merged: z.unknown(),
      merged_at: z.string().nullish(),
      created_at: z.string().nullish(),
      updated_at: z.string().nullish(),
      body: z.unknown(),
    })
    .nullish(),
});
type PullRequest = NonNullable<z.infer<typeof PullEventSchema>['pull_request']>;
type Pull = { pr: PullRequest; repository: string; head: string; base: string; defaultBranch: string };
type Seen = { stage: EventStage; topic: string | undefined; at: string | null | undefined };
type Recogniser = (pull: Pull, branches: Branches) => Seen | null;

/** The stage a pull request event shows, pure; null for any other event, action or branch. */
export function toStageEvent(event: string, payload: unknown, shapes: Shapes = DEFAULT_SHAPES): StageEvent | null {
  const read = event === 'pull_request' ? PullEventSchema.safeParse(payload) : null;
  const pull = read?.success ? pullOf(read.data) : null;
  const action = read?.success ? read.data.action : undefined;
  const recognise = pull && typeof action === 'string' ? RECOGNISERS.get(action) : undefined;
  const seen = pull && recognise ? recognise(pull, shapes.branches) : null;
  if (!pull || !seen?.topic || !seen.at) return null;
  return { repository: pull.repository, topic: seen.topic, prd: prdOf(pull.pr.body, shapes.prLinks), stage: seen.stage, at: seen.at };
}

/** The parts of a pull request event the stages read; null when one is missing. */
function pullOf(payload: z.infer<typeof PullEventSchema>): Pull | null {
  const pr = payload.pull_request;
  const repository = payload.repository?.full_name;
  const head = pr?.head?.ref;
  const base = pr?.base?.ref;
  if (!pr || !repository || typeof head !== 'string' || typeof base !== 'string') return null;
  return { pr, repository, head, base, defaultBranch: payload.repository?.default_branch ?? 'main' };
}

const seenAt = (stage: EventStage, topic: string | undefined, at: string | null | undefined): Seen => ({ stage, topic, at });
const now = () => new Date().toISOString();

/** A merged PR: a phase-0 PR (inbox), a slice PR into its feature branch (building) or the feature PR (shipped). */
const mergedStage: Recogniser = ({ pr, head, base, defaultBranch }, branches) => {
  if (pr.merged !== true) return null;
  const phase0 = match(branches.phase0, head);
  if (phase0) return seenAt('inbox', phase0.topic, pr.merged_at);
  const slice = match(branches.slice, head);
  if (slice) return base === fill(branches.feature, slice.topic) ? seenAt('building', slice.topic, pr.merged_at) : null;
  const feature = match(branches.feature, head);
  return feature && base === defaultBranch ? seenAt('shipped', feature.topic, pr.merged_at) : null;
};

/** The feature PR marked ready (outbox); a slice PR marked ready is none. */
const readyStage: Recogniser = ({ pr, head, base, defaultBranch }, branches) => {
  if (match(branches.slice, head)) return null;
  const feature = match(branches.feature, head);
  return feature && base === defaultBranch ? seenAt('outbox', feature.topic, pr.updated_at ?? now()) : null;
};

/** An opened retro PR (retro). */
const openedStage: Recogniser = ({ pr, head }, branches) => {
  const retro = match(branches.retro, head);
  return retro ? seenAt('retro', retro.topic, pr.created_at ?? now()) : null;
};

/** The pull request actions that can show a stage, each to its reading. */
const RECOGNISERS = new Map<string, Recogniser>([
  ['closed', mergedStage],
  ['ready_for_review', readyStage],
  ['opened', openedStage],
]);

/** `sha256=<hex>`: the HMAC-SHA256 of the exact body under the shared secret. */
export function signStageEvent(secret: string, body: string): string {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
}

/** Galaxy's event route, on `GALAXY_URL` when set. */
export function stageEventUrl(env: Record<string, string | undefined> = process.env): string {
  const host = (env.GALAXY_URL || DEFAULT_GALAXY_URL).replace(/\/+$/, '');
  return `${host}/api/stages/event`;
}

/**
 * POSTs one stage event to galaxy, signed. Never throws: a missing secret, a refusal or a network
 * failure is one line in the log.
 */
export async function forwardStageEvent(
  stageEvent: StageEvent,
  { url, secret, fetch: post = fetch, log = console.error }: {
    url: string;
    secret: string | undefined;
    fetch?: (url: string, init: RequestInit) => Promise<Response>;
    log?: (line: string) => void;
  },
): Promise<void> {
  const what = `${stageEvent.stage} of ${stageEvent.repository} ${stageEvent.prd ? `#${stageEvent.prd}` : stageEvent.topic}`;
  if (!secret) {
    log(`stage event: STAGE_EVENT_SECRET is not set, the ${what} is left to the sync`);
    return;
  }
  const body = JSON.stringify(stageEvent);
  try {
    const response = await post(url, {
      method: 'POST',
      body,
      headers: { 'content-type': 'application/json', [STAGE_SIGNATURE_HEADER]: signStageEvent(secret, body) },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) log(`stage event: galaxy answered ${response.status} to the ${what}`);
  } catch (error) {
    log(`stage event: the ${what} could not be sent — ${messageOf(error)}`);
  }
}

/** The PRD number from the body's first link line (`Closes #7`, `Part of #7`, `Refs #7`); null when none. */
function prdOf(body: unknown, prLinks: Record<string, string>): number | null {
  if (typeof body !== 'string') return null;
  for (const template of Object.values(prLinks)) {
    if (!template.includes('{prd}')) continue;
    const [before, after] = template.split('{prd}').map(escape);
    const found = new RegExp(`(?:^|\\s)${before}(\\d+)${after}(?!\\d)`, 'im').exec(body);
    if (found) return Number(found[1]);
  }
  return null;
}

/** The placeholders a branch shape fills from a branch name; null when it does not match. */
function match(template: string | undefined, ref: string): Record<string, string | undefined> | null {
  if (!template?.includes('{topic}')) return null;
  const names: string[] = [];
  const pattern = template.split(/(\{topic\}|\{slice\})/).map((part) => {
    if (part === '{topic}' || part === '{slice}') {
      names.push(part.slice(1, -1));
      return '([^/]+?)';
    }
    return escape(part);
  }).join('');
  const found = new RegExp(`^${pattern}$`).exec(ref);
  if (!found) return null;
  return Object.fromEntries(names.map((name, i) => [name, found[i + 1]]));
}

function fill(template: string, topic: string | undefined): string {
  return template.replace('{topic}', String(topic));
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
