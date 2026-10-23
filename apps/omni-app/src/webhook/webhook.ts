// `webhook`: a raw GitHub delivery in, a response out — and, for a handled event, the Inngest events
// it asks for. It touches no GitHub API: it verifies GitHub's signature itself (PRD 28, decision 8)
// before anything becomes an event, routes by event and action, and hands the events to the `send`
// it is given. Nothing is sent unless the signature is valid.
//
// Two routes, never both for one delivery: a merged `pull_request.closed` becomes the retro event
// (PRD 72) and the knowledge harvest event (PRD 82), and nothing else; every other handled action
// becomes the outbox check event, exactly as before. An unmerged `closed` becomes nothing on either
// route; beside them, a `closed` or `reopened` may also become a fix stamp (below).
//
// The inbox check (PRD 675) listens to that same outbox check event, so every handled pull request
// action re-evaluates both. A re-run of an inbox check run (its `external_id` is the inbox's) becomes
// the inbox check event alone, a re-run of an approved check run (PRD 1548) the approved check event
// alone, a re-run of an `omni / budgets` check run (PRD 1679) the budgets check event alone; a re-run of
// any other check run stays the outbox check event. The approved check and the budgets check listen to
// the outbox check event too, so every handled pull request action re-evaluates them as well.
//
// A click of a button on a red canon check (PRD 839), `check_run.requested_action` on an inbox check
// run, becomes one canon action event alone, carrying the button and the facts the check run's summary
// hides (../inbox-check/canon-actions.ts); the `canon-action` function posts its comment. It re-runs
// no check.
//
// Beside either route, a pull request that moves a PRD to a stage (PRD 587) is handed to `forward` as
// one stage event (src/stage-forward/). The app's `forward` (./github-route.ts) POSTs it to galaxy,
// signed with `STAGE_EVENT_SECRET`. It never changes the reply: a failure is logged.
//
// Every delivery of an event a touch is read from (PRD 902, s3) — issues, comments, every pull request
// action, reviews, check suites and pushes — is handed to `touch` as its touches
// (src/stage-forward/touch.ts), whether or not it also becomes an event. The app's `touch` POSTs each to
// galaxy's `/api/github/touched`, signed as the stage event is. It never changes the reply either.
//
// The fix stamp (PRD 2011 s7): a pull request closed, merged or not, or reopened, into the repository's
// default branch, or on any branch when its body names a bug record (`Fixes mobile-B74`), also becomes one
// fix stamp event, beside whatever else it becomes, handed to `sendStamps`; the `fix-row-stamp` function
// stamps the Fixes rows of that repository and pull request (../fix-rows/). A sub-PR into its feature
// branch names no record, and becomes none.
//
// The main watch (PRD 2410): a pull request merged into the default branch also becomes one main watch
// event, beside the retro's and the harvest's, and a check suite of the default branch that completed red
// becomes one main watch CI event, which wakes the watch of the commit it ran on (../main-watch/events.ts).
// Both are handed to `sendWatch`, each with an id, so a delivery GitHub sends twice is one event.
//
// The approved label (PRD 1612): an issue of a PRD gaining or losing the kit's approved label
// (`labels.approved`'s default, as the stage events read it) becomes one approved label event alone;
// the `approved-rerun` function runs the `omni/approved` check again on every open pull request of that
// PRD. Every handled pull request action also runs that check, on the outbox check's own event.
//
// The delivery is read through one schema: a delivery whose fields are of another type than GitHub
// sends becomes no event at all.
import { Webhooks } from '@octokit/webhooks';
import { z } from 'zod';
import { parseConfig } from 'omni-loop/kit/lib/config.ts';
import { PrNumberSchema, PrdNumberSchema, type PrNumber } from 'omni-loop/kit/lib/ids.ts';
import {
  APPROVED_CHECK_EVENT,
  APPROVED_EXTERNAL_ID,
  APPROVED_LABEL_EVENT,
  BUDGETS_CHECK_EVENT,
  BUDGETS_EXTERNAL_ID,
  HARVEST_EVENT,
  INBOX_CHECK_EVENT,
  INBOX_EXTERNAL_ID,
  OUTBOX_CHECK_EVENT,
  RETRO_EVENT,
  type AppEvent,
  type ApprovedLabelRequest,
  type CanonActionRequest,
  type CheckRequest,
  type HarvestRequest,
  type RetroRequest,
} from '../inngest-client.ts';
import { FIX_STAMP_EVENT, fixedRecordOf, fixStampId, type FixStampKind, type FixStampRequest } from '../fix-rows/fix-stamp.ts';
import { MAIN_WATCH_CI_EVENT, MAIN_WATCH_EVENT, mainWatchCiId, mainWatchId, type MainWatchRequest } from '../main-watch/events.ts';
import { CANON_ACTION, CANON_ACTION_EVENT, readCanonMarker } from '../inbox-check/canon-actions.ts';
import { messageOf } from '../outbox-check/github-schema.ts';
import { noteTo } from '../run-log/run-log.ts';
import { toStageEvent, type StageEvent } from '../stage-forward/stage-forward.ts';
import { TOUCH_EVENTS, toTouches, type Touch } from '../stage-forward/touch.ts';

/** Events to the actions handled on each. */
type ActionTable = Readonly<Record<string, readonly string[]>>;

/**
 * The events and actions the app re-evaluates the outbox check on. `check_run.rerequested` is
 * GitHub's **Re-run** button; GitHub delivers it only to the app that created the check run. A
 * review submitted or dismissed (PRD 1726) re-runs it too: a CODEOWNER's approval is what clears a
 * change to a locked law, without a new push.
 */
export const CHECK_ACTIONS = Object.freeze({
  pull_request: Object.freeze(['opened', 'synchronize', 'reopened', 'ready_for_review', 'labeled', 'unlabeled', 'edited']),
  pull_request_review: Object.freeze(['submitted', 'dismissed']),
  check_run: Object.freeze(['rerequested']),
});

/** The actions that may start a retro: a pull request closed, which counts only when it merged. */
export const RETRO_ACTIONS = Object.freeze({
  pull_request: Object.freeze(['closed']),
});

/** The actions that may be a click of a canon button (PRD 839); only on an inbox check run. */
export const CANON_ACTIONS = Object.freeze({
  check_run: Object.freeze(['requested_action']),
});

/** The actions on an issue that may be the approved label added or removed (PRD 1612). The manifest
 * already subscribes to `issues`, for the touches. */
export const APPROVED_LABEL_ACTIONS = Object.freeze({
  issues: Object.freeze(['labeled', 'unlabeled']),
});

/** The actions that may stamp a fix's row (PRD 2011 s7): a pull request closed, merged or not, or reopened. */
export const FIX_STAMP_ACTIONS = Object.freeze({
  pull_request: Object.freeze(['closed', 'reopened']),
});

/**
 * The actions that may wake a main watch (PRD 2410): a check suite completed. The manifest already subscribes
 * to `check_suite` for the touches (`TOUCH_EVENTS`), so the subscriptions do not change and `HANDLED` keeps
 * the checks' own actions.
 */
const MAIN_WATCH_CI_ACTIONS = Object.freeze({
  check_suite: Object.freeze(['completed']),
});

/** A check suite's conclusions that read red, as the main watch reads a job's (../main-watch/signals.ts). */
const RED_SUITE: ReadonlySet<unknown> = new Set(['failure', 'timed_out', 'startup_failure']);

/** The kit's approved label: a repository that renames it gets no rerun on its label. */
const APPROVED_LABEL = parseConfig('kit: 1').labels.approved;

/** Every event and action the app acts on. `app.yml` subscribes to exactly these events (its test says so). */
export const HANDLED = Object.freeze({
  pull_request: Object.freeze([...CHECK_ACTIONS.pull_request, ...RETRO_ACTIONS.pull_request]),
  pull_request_review: CHECK_ACTIONS.pull_request_review,
  check_run: Object.freeze([...CHECK_ACTIONS.check_run, ...CANON_ACTIONS.check_run]),
});

/** Every event the app subscribes to: the ones it acts on, and the ones a touch is read from. */
export const SUBSCRIBED = Object.freeze([...new Set([...Object.keys(HANDLED), ...TOUCH_EVENTS])]);

const PullRefSchema = z.looseObject({
  number: PrNumberSchema.nullish(),
  head: z.looseObject({ sha: z.string().nullish() }).nullish(),
  base: z.looseObject({ ref: z.string().nullish() }).nullish(),
});

/** The parts of a delivery the router reads; any of them may be missing. */
const PayloadSchema = z.looseObject({
  action: z.unknown(),
  number: PrNumberSchema.nullish(),
  installation: z.looseObject({ id: z.number().nullish() }).nullish(),
  repository: z
    .looseObject({
      name: z.string(),
      full_name: z.string().nullish(),
      owner: z.looseObject({ login: z.string().nullish() }).nullish(),
      default_branch: z.string().nullish(),
    })
    .nullish(),
  pull_request: PullRefSchema.extend({
    body: z.string().nullish(),
    merged: z.boolean().nullish(),
    merge_commit_sha: z.string().nullish(),
    merged_at: z.string().nullish(),
    closed_at: z.string().nullish(),
    updated_at: z.string().nullish(),
  }).nullish(),
  check_run: z
    .looseObject({
      id: z.number().nullish(),
      external_id: z.string().nullish(),
      head_sha: z.string().nullish(),
      pull_requests: z.array(PullRefSchema).nullish(),
      output: z.looseObject({ summary: z.unknown() }).nullish(),
    })
    .nullish(),
  requested_action: z.looseObject({ identifier: z.unknown() }).nullish(),
  check_suite: z
    .looseObject({
      id: z.number().nullish(),
      head_branch: z.string().nullish(),
      head_sha: z.string().nullish(),
      conclusion: z.string().nullish(),
    })
    .nullish(),
});
type Payload = z.infer<typeof PayloadSchema>;

export type WebhookResponse = { status: number; body: string };

/** The delivery's headers: a `Headers` or a plain record. */
type HeadersIn = Record<string, string | undefined> | Headers;

export async function receiveWebhook({
  body,
  headers,
  secret,
  send,
  sendApproved = () => Promise.resolve(),
  sendStamps = () => Promise.resolve(),
  sendWatch = () => Promise.resolve(),
  forward,
  touch = () => Promise.resolve(),
  log = noteTo('webhook'),
}: {
  body: string;
  headers: HeadersIn;
  secret: string | undefined;
  send: (events: AppEvent[]) => Promise<unknown>;
  /** Sends the approved label's events (PRD 1612); none given, they go nowhere. */
  sendApproved?: (events: ApprovedLabelRequest[]) => Promise<unknown>;
  /** Sends the fix stamp events (PRD 2011 s7); none given, they go nowhere. */
  sendStamps?: (events: FixStampRequest[]) => Promise<unknown>;
  /** Sends the main watch's events (PRD 2410); none given, they go nowhere. */
  sendWatch?: (events: MainWatchRequest[]) => Promise<unknown>;
  forward: (stageEvent: StageEvent) => Promise<unknown>;
  /** Forwards one touch; none given, touches go nowhere. */
  touch?: (touch: Touch) => Promise<unknown>;
  /** Says a forward that failed; a JSON note line at `warn` unless given (PRD 1723 s6). */
  log?: (line: string) => void;
}): Promise<WebhookResponse> {
  if (!secret) return reply(500, 'webhook secret is not configured');

  const signature = header(headers, 'x-hub-signature-256');
  if (!signature || !(await verified(secret, body, signature))) return reply(401, 'bad signature');

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return reply(400, 'body is not JSON');
  }

  const event = header(headers, 'x-github-event') ?? '';
  const stageEvent = toStageEvent(event, payload);
  if (stageEvent) {
    try {
      await forward(stageEvent);
    } catch (error) {
      log(`stage event: could not forward — ${String(messageOf(error))}`);
    }
  }
  await Promise.all(toTouches(event, payload).map(async (one) => {
    try {
      await touch(one);
    } catch (error) {
      log(`touch: could not forward — ${String(messageOf(error))}`);
    }
  }));

  const events = toEvents(event, payload);
  const approved = toApprovedLabelRequests(event, payload);
  const stamps = toFixStampRequests(event, payload);
  const watch = toMainWatchRequests(event, payload);
  const total = events.length + approved.length + stamps.length + watch.length;
  if (total === 0) return reply(200, 'ignored');

  try {
    if (events.length > 0) await send(events);
    if (approved.length > 0) await sendApproved(approved);
    if (stamps.length > 0) await sendStamps(stamps);
    if (watch.length > 0) await sendWatch(watch);
  } catch (error) {
    return reply(502, `could not send the event: ${String(messageOf(error))}`);
  }
  return reply(200, `sent ${total}`);
}

/**
 * The router alone, pure: a retro action goes to the retro and the knowledge harvest, a canon button's
 * click to the canon action, anything else to the outbox check.
 */
export function toEvents(event: string, payload: unknown): AppEvent[] {
  const action = readPayload(payload)?.action;
  if (handles(RETRO_ACTIONS, event, action)) {
    return [...toRetroRequests(event, payload), ...toHarvestRequests(event, payload)];
  }
  if (handles(CANON_ACTIONS, event, action)) return toCanonActionRequests(event, payload);
  return toCheckRequests(event, payload);
}

/**
 * The checks' filter, pure: a check action becomes one check request per pull request it names —
 * the inbox check event for a re-run of an inbox check run, the approved check event for a re-run of
 * an approved check run, the outbox check event otherwise;
 * anything else — a `closed`, merged or not, included — becomes none. A pull request into another
 * branch than the repository's default, a sub-PR into its feature branch, becomes none either
 * (#1413): no check of the loop grades it, and each event of one cost a run. A delivery naming no
 * default branch is sent as before.
 */
export function toCheckRequests(event: string, delivery: unknown): CheckRequest[] {
  const payload = readPayload(delivery);
  if (!payload || !handles(CHECK_ACTIONS, event, payload.action)) return [];

  const source = sourceOf(payload);
  if (!source) return [];

  const trigger = `${event}.${String(payload.action)}`;
  const name = event === 'check_run' ? rerunEventOf(payload.check_run?.external_id) : OUTBOX_CHECK_EVENT;
  const pulls =
    event !== 'check_run'
      ? [{ number: payload.pull_request?.number ?? payload.number, sha: payload.pull_request?.head?.sha, base: payload.pull_request?.base?.ref }]
      : (payload.check_run?.pull_requests ?? []).map((pull) => ({
          number: pull.number,
          sha: pull.head?.sha ?? payload.check_run?.head_sha,
          base: pull.base?.ref,
        }));
  const defaultBranch = payload.repository?.default_branch;
  const intoDefault = (pull: { base: string | null | undefined }) => !defaultBranch || pull.base === defaultBranch;

  return pulls.filter(intoDefault).filter(isNamed).map((pull) => ({
    name,
    data: { ...source, prNumber: pull.number, headSha: pull.sha, trigger },
  }));
}

/** The event a re-run of a check run asks for, by the `external_id` the check run carries. */
function rerunEventOf(externalId: string | null | undefined): string {
  if (externalId === INBOX_EXTERNAL_ID) return INBOX_CHECK_EVENT;
  if (externalId === APPROVED_EXTERNAL_ID) return APPROVED_CHECK_EVENT;
  if (externalId === BUDGETS_EXTERNAL_ID) return BUDGETS_CHECK_EVENT;
  return OUTBOX_CHECK_EVENT;
}

/**
 * The retro's filter, pure: a pull request closed by its merge into the repository's default branch
 * becomes one retro request carrying the merge SHA and time; an unmerged one, or one merged into
 * another branch (a sub-PR into its feature branch), becomes none (#1409: every sub-PR's merge used
 * to start a retro and a harvest, which spent the Inngest account). A delivery naming no default
 * branch is sent as before. Whether it is a feature PR is not decided here: the retro reads the
 * config at the merge SHA to decide (its step "qualify").
 */
export function toRetroRequests(event: string, delivery: unknown): RetroRequest[] {
  const payload = readPayload(delivery);
  if (!payload || !handles(RETRO_ACTIONS, event, payload.action)) return [];

  const source = sourceOf(payload);
  const pull = payload.pull_request;
  if (!source || pull?.merged !== true) return [];
  const defaultBranch = payload.repository?.default_branch;
  if (defaultBranch && pull.base?.ref !== defaultBranch) return [];

  const prNumber = pull.number ?? payload.number ?? undefined;
  if (prNumber === undefined || !pull.merge_commit_sha || !pull.merged_at) return [];

  return [
    {
      name: RETRO_EVENT,
      data: { ...source, prNumber, mergeSha: pull.merge_commit_sha, mergedAt: pull.merged_at },
    },
  ];
}

/**
 * The knowledge harvest's filter, pure: the same merged pull requests the retro gets, one harvest
 * request each, carrying only where it merged. The function reads the merge's facts from the pull
 * request itself, and decides in its step "qualify" whether it is a feature PR.
 */
export function toHarvestRequests(event: string, payload: unknown): HarvestRequest[] {
  return toRetroRequests(event, payload).map(({ data: { installationId, owner, repo, repository, prNumber } }) => ({
    name: HARVEST_EVENT,
    data: { installationId, owner, repo, repository, prNumber },
  }));
}

/**
 * The fix stamp's filter, pure (PRD 2011 s7): a pull request closed (merged, at its merge; unmerged, at its
 * close) or reopened (at its last update) becomes one fix stamp event, carrying the record its body names
 * or none; any other action becomes none. Only a pull request into the repository's default branch, or one
 * whose body names a record, becomes one: a sub-PR into its feature branch is no fix (#1409). A delivery
 * naming no default branch is sent. One missing the time of its change becomes none.
 */
export function toFixStampRequests(event: string, delivery: unknown): FixStampRequest[] {
  const payload = readPayload(delivery);
  if (!payload || !handles(FIX_STAMP_ACTIONS, event, payload.action)) return [];

  const source = sourceOf(payload);
  const pull = payload.pull_request;
  const prNumber = pull?.number ?? payload.number;
  if (!source || !pull || prNumber === null || prNumber === undefined) return [];

  const bug = fixedRecordOf(pull.body);
  const defaultBranch = payload.repository?.default_branch;
  if (bug === null && defaultBranch && pull.base?.ref !== defaultBranch) return [];

  const kind: FixStampKind = payload.action === 'reopened' ? 'reopened' : pull.merged === true ? 'merged' : 'closed';
  const at = { merged: pull.merged_at, closed: pull.closed_at, reopened: pull.updated_at }[kind];
  if (!at) return [];

  const data = { installationId: source.installationId, repository: source.repository, prNumber, kind, at, bug };
  return [{ name: FIX_STAMP_EVENT, id: fixStampId(data), data }];
}

/**
 * The main watch's filter, pure (PRD 2410): a pull request merged into the default branch (as the retro
 * reads it: `toRetroRequests`) becomes one main watch event; a check suite completed red on the default
 * branch becomes one main watch CI event naming its commit. Whether the merge is a feature PR, and whether
 * the commit is a watched merge, is the function's to decide. A delivery naming no default branch is sent.
 */
export function toMainWatchRequests(event: string, delivery: unknown): MainWatchRequest[] {
  const merged: MainWatchRequest[] = toRetroRequests(event, delivery).map(({ data }) => ({ name: MAIN_WATCH_EVENT, id: mainWatchId(data), data }));
  const payload = readPayload(delivery);
  if (merged.length > 0 || !payload || !handles(MAIN_WATCH_CI_ACTIONS, event, payload.action)) return merged;

  const source = sourceOf(payload);
  const suite = payload.check_suite;
  if (!source || !suite?.id || !suite.head_sha || !RED_SUITE.has(suite.conclusion)) return [];
  const defaultBranch = payload.repository?.default_branch;
  if (defaultBranch && suite.head_branch !== defaultBranch) return [];
  return [
    {
      name: MAIN_WATCH_CI_EVENT,
      id: mainWatchCiId({ repository: source.repository, suite: suite.id }),
      data: { installationId: source.installationId, repository: source.repository, sha: suite.head_sha },
    },
  ];
}

/** The parts of an issue's label event the approved label reads. */
const LabelEventSchema = z.looseObject({
  label: z.looseObject({ name: z.string() }),
  issue: z.looseObject({ number: PrdNumberSchema, pull_request: z.unknown().optional() }),
});

/**
 * The approved label's filter, pure (PRD 1612): the approved label added to or removed from an issue
 * (never a pull request) becomes one approved label event naming the issue as the PRD; any other label
 * or action becomes none.
 */
export function toApprovedLabelRequests(event: string, delivery: unknown): ApprovedLabelRequest[] {
  const payload = readPayload(delivery);
  if (!payload || !handles(APPROVED_LABEL_ACTIONS, event, payload.action)) return [];
  const source = sourceOf(payload);
  const read = LabelEventSchema.safeParse(delivery);
  if (!source || !read.success) return [];
  const { label, issue } = read.data;
  if (label.name !== APPROVED_LABEL || issue.pull_request !== undefined) return [];
  return [{ name: APPROVED_LABEL_EVENT, data: { ...source, prd: issue.number, trigger: `${event}.${String(payload.action)}` } }];
}

/** The canon buttons' identifiers. */
const BUTTONS: readonly unknown[] = Object.values(CANON_ACTION);

/**
 * The canon buttons' filter, pure: a click of Rewrite for <persona> or Change the claim on an inbox
 * check run whose summary carries the canon facts becomes one canon action request per pull request it
 * names; any other click, check run or action becomes none.
 */
export function toCanonActionRequests(event: string, delivery: unknown): CanonActionRequest[] {
  const payload = readPayload(delivery);
  if (!payload || !handles(CANON_ACTIONS, event, payload.action)) return [];
  const run = payload.check_run;
  const action = payload.requested_action?.identifier;
  if (!run || run.external_id !== INBOX_EXTERNAL_ID || typeof action !== 'string' || !BUTTONS.includes(action)) return [];

  const source = sourceOf(payload);
  const facts = readCanonMarker(run.output?.summary);
  if (!source || !facts) return [];

  return (run.pull_requests ?? [])
    .map((pull) => ({ number: pull.number, sha: pull.head?.sha ?? run.head_sha }))
    .filter(isNamed)
    .map((pull) => ({
      name: CANON_ACTION_EVENT,
      data: { ...source, prNumber: pull.number, headSha: pull.sha, checkRunId: run.id ?? undefined, action, facts },
    }));
}

/** The delivery as the router reads it, or `null` when it is not of that shape. */
function readPayload(payload: unknown): Payload | null {
  const read = PayloadSchema.safeParse(payload);
  return read.success ? read.data : null;
}

/** Whether `action` is one of the actions `table` handles on `event`. */
function handles(table: ActionTable, event: string, action: unknown): boolean {
  if (typeof action !== 'string' || !Object.hasOwn(table, event)) return false;
  return table[event]?.includes(action) ?? false;
}

/** A pull request named by an integer number and a head SHA. */
function isNamed<T extends { number: PrNumber | null | undefined; sha: string | null | undefined }>(pull: T): pull is T & { number: PrNumber; sha: string } {
  return pull.number !== null && pull.number !== undefined && Boolean(pull.sha);
}

/** The installation and repository every event carries, or `null` when the delivery lacks one. */
function sourceOf(payload: Payload): { installationId: number; owner: string; repo: string; repository: string } | null {
  const installationId = payload.installation?.id;
  const repository = payload.repository;
  if (!installationId || !repository?.full_name) return null;
  return {
    installationId,
    owner: repository.owner?.login ?? repository.full_name.split('/')[0] ?? '',
    repo: repository.name,
    repository: repository.full_name,
  };
}

async function verified(secret: string, body: string, signature: string): Promise<boolean> {
  try {
    return await new Webhooks({ secret }).verify(body, signature);
  } catch {
    return false;
  }
}

/** One header, by its lower-case name: a caller that hands no headers at all reads as none. */
function header(headers: HeadersIn | null | undefined, name: string): string | undefined {
  if (headers instanceof Headers) return headers.get(name) ?? undefined;
  const fields = headers ?? {};
  const key = Object.keys(fields).find((k) => k.toLowerCase() === name);
  return key === undefined ? undefined : fields[key];
}

function reply(status: number, body: string): WebhookResponse {
  return { status, body };
}
