// @ts-nocheck
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
import { Webhooks } from '@octokit/webhooks';
import { HARVEST_EVENT, INBOX_CHECK_EVENT, INBOX_EXTERNAL_ID, OUTBOX_CHECK_EVENT, RETRO_EVENT } from '../inngest-client.ts';
import { CANON_ACTION, CANON_ACTION_EVENT, readCanonMarker } from '../inbox-check/canon-actions.ts';
import { forwardStageEvent, stageEventUrl, toStageEvent } from '../stage-forward/stage-forward.ts';

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

/**
 * @typedef {{ status: number, body: string }} WebhookResponse
 * @typedef {{ name: string, data: {
 *   installationId: number, owner: string, repo: string, repository: string,
 *   prNumber: number, headSha: string, trigger: string,
 * } }} CheckRequest
 * @typedef {{ name: string, data: {
 *   installationId: number, owner: string, repo: string, repository: string,
 *   prNumber: number, mergeSha: string, mergedAt: string,
 * } }} RetroRequest
 * @typedef {{ name: string, data: {
 *   installationId: number, owner: string, repo: string, repository: string, prNumber: number,
 * } }} HarvestRequest
 * @typedef {{ name: string, data: {
 *   installationId: number, owner: string, repo: string, repository: string, prNumber: number,
 *   headSha: string, checkRunId: number, action: string,
 *   facts: { prd: number, persona: string | null, claims: string[] },
 * } }} CanonActionRequest
 */

/**
 * @param {{
 *   body: string,
 *   headers: Record<string, string | undefined> | Headers,
 *   secret: string | undefined,
 *   send: (events: (CheckRequest | RetroRequest | HarvestRequest | CanonActionRequest)[]) => Promise<unknown>,
 *   forward?: (stageEvent: import('../stage-forward/stage-forward.ts').StageEvent) => Promise<unknown>,
 * }} input
 * @returns {Promise<WebhookResponse>}
 */
export async function receiveWebhook({ body, headers, secret, send, forward = forwardToGalaxy }) {
  if (!secret) return reply(500, 'webhook secret is not configured');

  const signature = header(headers, 'x-hub-signature-256');
  if (!signature || !(await verified(secret, body, signature))) return reply(401, 'bad signature');

  let payload;
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
      console.error(`stage event: could not forward — ${error?.message ?? error}`);
    }
  }

  const events = toEvents(event, payload);
  if (events.length === 0) return reply(200, 'ignored');

  try {
    await send(events);
  } catch (error) {
    return reply(502, `could not send the event: ${error?.message ?? error}`);
  }
  return reply(200, `sent ${events.length}`);
}

/**
 * The router alone, pure: a retro action goes to the retro and the knowledge harvest, a canon button's
 * click to the canon action, anything else to the outbox check.
 * @param {string} event
 * @param {any} payload
 * @returns {(CheckRequest | RetroRequest | HarvestRequest | CanonActionRequest)[]}
 */
export function toEvents(event, payload) {
  if (RETRO_ACTIONS[event]?.includes(payload?.action)) {
    return [...toRetroRequests(event, payload), ...toHarvestRequests(event, payload)];
  }
  if (CANON_ACTIONS[event]?.includes(payload?.action)) return toCanonActionRequests(event, payload);
  return toCheckRequests(event, payload);
}

/**
 * The checks' filter, pure: a check action becomes one check request per pull request it names —
 * the inbox check event for a re-run of an inbox check run, the outbox check event otherwise;
 * anything else — a `closed`, merged or not, included — becomes none.
 * @param {string} event
 * @param {any} payload
 * @returns {CheckRequest[]}
 */
export function toCheckRequests(event, payload) {
  const actions = CHECK_ACTIONS[event];
  if (!actions || !actions.includes(payload?.action)) return [];

  const source = sourceOf(payload);
  if (!source) return [];

  const trigger = `${event}.${payload.action}`;
  const name = event === 'check_run' && payload.check_run?.external_id === INBOX_EXTERNAL_ID ? INBOX_CHECK_EVENT : OUTBOX_CHECK_EVENT;
  const pulls =
    event === 'pull_request'
      ? [{ number: payload.pull_request?.number ?? payload.number, sha: payload.pull_request?.head?.sha }]
      : (payload.check_run?.pull_requests ?? []).map((pull) => ({
          number: pull.number,
          sha: pull.head?.sha ?? payload.check_run?.head_sha,
        }));

  return pulls
    .filter((pull) => Number.isInteger(pull.number) && pull.sha)
    .map((pull) => ({
      name,
      data: { ...source, prNumber: pull.number, headSha: pull.sha, trigger },
    }));
}

/**
 * The retro's filter, pure: a pull request closed by its merge becomes one retro request carrying
 * the merge SHA and time; an unmerged one becomes none. Whether it is a feature PR is not decided
 * here: the retro reads the config at the merge SHA to decide (its step "qualify").
 * @param {string} event
 * @param {any} payload
 * @returns {RetroRequest[]}
 */
export function toRetroRequests(event, payload) {
  const actions = RETRO_ACTIONS[event];
  if (!actions || !actions.includes(payload?.action)) return [];

  const source = sourceOf(payload);
  const pull = payload.pull_request;
  if (!source || pull?.merged !== true) return [];

  const prNumber = pull.number ?? payload.number;
  if (!Number.isInteger(prNumber) || !pull.merge_commit_sha || !pull.merged_at) return [];

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
 * @param {string} event
 * @param {any} payload
 * @returns {HarvestRequest[]}
 */
export function toHarvestRequests(event, payload) {
  return toRetroRequests(event, payload).map(({ data: { mergeSha, mergedAt, ...data } }) => ({ name: HARVEST_EVENT, data }));
}

/**
 * The canon buttons' filter, pure: a click of Rewrite for <persona> or Change the claim on an inbox
 * check run whose summary carries the canon facts becomes one canon action request per pull request it
 * names; any other click, check run or action becomes none.
 * @param {string} event
 * @param {any} payload
 * @returns {CanonActionRequest[]}
 */
export function toCanonActionRequests(event, payload) {
  if (!CANON_ACTIONS[event]?.includes(payload?.action)) return [];
  const run = payload.check_run;
  const action = payload.requested_action?.identifier;
  if (run?.external_id !== INBOX_EXTERNAL_ID || !Object.values(CANON_ACTION).includes(action)) return [];

  const source = sourceOf(payload);
  const facts = readCanonMarker(run.output?.summary);
  if (!source || !facts) return [];

  return (run.pull_requests ?? [])
    .map((pull) => ({ number: pull.number, sha: pull.head?.sha ?? run.head_sha }))
    .filter((pull) => Number.isInteger(pull.number) && pull.sha)
    .map((pull) => ({
      name: CANON_ACTION_EVENT,
      data: { ...source, prNumber: pull.number, headSha: pull.sha, checkRunId: run.id, action, facts },
    }));
}

/** The live forward: galaxy's event route, the secret read at the call. */
function forwardToGalaxy(stageEvent) {
  return forwardStageEvent(stageEvent, { url: stageEventUrl(), secret: process.env.STAGE_EVENT_SECRET });
}

/** The installation and repository every event carries, or `null` when the delivery lacks one. */
function sourceOf(payload) {
  const installationId = payload.installation?.id;
  const repository = payload.repository;
  if (!installationId || !repository?.full_name) return null;
  return {
    installationId,
    owner: repository.owner?.login ?? repository.full_name.split('/')[0],
    repo: repository.name,
    repository: repository.full_name,
  };
}

async function verified(secret, body, signature) {
  try {
    return await new Webhooks({ secret }).verify(body, signature);
  } catch {
    return false;
  }
}

function header(headers, name) {
  if (typeof headers?.get === 'function') return headers.get(name) ?? undefined;
  const key = Object.keys(headers ?? {}).find((k) => k.toLowerCase() === name);
  return key === undefined ? undefined : headers[key];
}

function reply(status, body) {
  return { status, body };
}
