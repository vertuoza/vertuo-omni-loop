// `webhook`: a raw GitHub delivery in, a response out — and, for a handled event, the Inngest events
// it asks for. It touches no GitHub API: it verifies GitHub's signature itself (PRD 28, decision 8)
// before anything becomes an event, routes by event and action, and hands the events to the `send`
// it is given. Nothing is sent unless the signature is valid.
//
// Two routes, never both for one delivery: a merged `pull_request.closed` becomes the retro event
// (PRD 72) and the knowledge harvest event (PRD 82), and nothing else; every other handled action
// becomes the outbox check event, exactly as before. An unmerged `closed` becomes nothing.
//
// The inbox check (PRD 675) listens to that same outbox check event, so every handled pull request
// action re-evaluates both. A re-run of an inbox check run (its `external_id` is the inbox's) becomes
// the inbox check event alone; a re-run of any other check run stays the outbox check event.
//
// A click of a button on a red canon check (PRD 839), `check_run.requested_action` on an inbox check
// run, becomes one canon action event alone, carrying the button and the facts the check run's summary
// hides (../inbox-check/canon-actions.ts); the `canon-action` function posts its comment. It re-runs
// no check.
//
// Beside either route, a pull request that moves a PRD to a stage (PRD 587) is handed to `forward` as
// one stage event (src/stage-forward/). Unless one is given, `forward` POSTs it to galaxy, signed with
// `STAGE_EVENT_SECRET` (`GALAXY_URL` names galaxy when set). It never changes the reply: a failure is
// logged.
//
// The delivery is read through one schema: a delivery whose fields are of another type than GitHub
// sends becomes no event at all.
import { Webhooks } from '@octokit/webhooks';
import { z } from 'zod';
import { PrNumberSchema, type PrNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';
import {
  HARVEST_EVENT,
  INBOX_CHECK_EVENT,
  INBOX_EXTERNAL_ID,
  OUTBOX_CHECK_EVENT,
  RETRO_EVENT,
  type AppEvent,
  type CanonActionRequest,
  type CheckRequest,
  type HarvestRequest,
  type RetroRequest,
} from '../inngest-client.ts';
import { CANON_ACTION, CANON_ACTION_EVENT, readCanonMarker } from '../inbox-check/canon-actions.ts';
import { messageOf } from '../outbox-check/github-schema.ts';
import { forwardStageEvent, stageEventUrl, toStageEvent, type StageEvent } from '../stage-forward/stage-forward.ts';

/** Events to the actions handled on each. */
type ActionTable = Readonly<Record<string, readonly string[]>>;

/**
 * The events and actions the app re-evaluates the outbox check on. `check_run.rerequested` is
 * GitHub's **Re-run** button; GitHub delivers it only to the app that created the check run.
 */
export const CHECK_ACTIONS = Object.freeze({
  pull_request: Object.freeze(['opened', 'synchronize', 'reopened', 'ready_for_review', 'labeled', 'unlabeled', 'edited']),
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

/** Every event and action the app acts on. `app.yml` subscribes to exactly these events (its test says so). */
export const HANDLED = Object.freeze({
  pull_request: Object.freeze([...CHECK_ACTIONS.pull_request, ...RETRO_ACTIONS.pull_request]),
  check_run: Object.freeze([...CHECK_ACTIONS.check_run, ...CANON_ACTIONS.check_run]),
});

const PullRefSchema = z.looseObject({
  number: PrNumberSchema.nullish(),
  head: z.looseObject({ sha: z.string().nullish() }).nullish(),
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
    })
    .nullish(),
  pull_request: PullRefSchema.extend({
    merged: z.boolean().nullish(),
    merge_commit_sha: z.string().nullish(),
    merged_at: z.string().nullish(),
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
  forward = forwardToGalaxy,
}: {
  body: string;
  headers: HeadersIn;
  secret: string | undefined;
  send: (events: AppEvent[]) => Promise<unknown>;
  forward?: ((stageEvent: StageEvent) => Promise<unknown>) | undefined;
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
      console.error(`stage event: could not forward — ${String(messageOf(error))}`);
    }
  }

  const events = toEvents(event, payload);
  if (events.length === 0) return reply(200, 'ignored');

  try {
    await send(events);
  } catch (error) {
    return reply(502, `could not send the event: ${String(messageOf(error))}`);
  }
  return reply(200, `sent ${events.length}`);
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
 * the inbox check event for a re-run of an inbox check run, the outbox check event otherwise;
 * anything else — a `closed`, merged or not, included — becomes none.
 */
export function toCheckRequests(event: string, delivery: unknown): CheckRequest[] {
  const payload = readPayload(delivery);
  if (!payload || !handles(CHECK_ACTIONS, event, payload.action)) return [];

  const source = sourceOf(payload);
  if (!source) return [];

  const trigger = `${event}.${String(payload.action)}`;
  const name = event === 'check_run' && payload.check_run?.external_id === INBOX_EXTERNAL_ID ? INBOX_CHECK_EVENT : OUTBOX_CHECK_EVENT;
  const pulls =
    event === 'pull_request'
      ? [{ number: payload.pull_request?.number ?? payload.number, sha: payload.pull_request?.head?.sha }]
      : (payload.check_run?.pull_requests ?? []).map((pull) => ({
          number: pull.number,
          sha: pull.head?.sha ?? payload.check_run?.head_sha,
        }));

  return pulls.filter(isNamed).map((pull) => ({
    name,
    data: { ...source, prNumber: pull.number, headSha: pull.sha, trigger },
  }));
}

/**
 * The retro's filter, pure: a pull request closed by its merge becomes one retro request carrying
 * the merge SHA and time; an unmerged one becomes none. Whether it is a feature PR is not decided
 * here: the retro reads the config at the merge SHA to decide (its step "qualify").
 */
export function toRetroRequests(event: string, delivery: unknown): RetroRequest[] {
  const payload = readPayload(delivery);
  if (!payload || !handles(RETRO_ACTIONS, event, payload.action)) return [];

  const source = sourceOf(payload);
  const pull = payload.pull_request;
  if (!source || pull?.merged !== true) return [];

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
function isNamed(pull: { number: PrNumber | null | undefined; sha: string | null | undefined }): pull is { number: PrNumber; sha: string } {
  return pull.number !== null && pull.number !== undefined && Boolean(pull.sha);
}

/** The live forward: galaxy's event route, the secret read at the call. */
function forwardToGalaxy(stageEvent: StageEvent): Promise<void> {
  return forwardStageEvent(stageEvent, { url: stageEventUrl(), secret: process.env.STAGE_EVENT_SECRET });
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
