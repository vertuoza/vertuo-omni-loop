// `webhook`: a raw GitHub delivery in, a response out — and, for a handled event, the Inngest events
// it asks for. It touches no GitHub API: it verifies GitHub's signature itself (PRD 28, decision 8)
// before anything becomes an event, routes by event and action, and hands the events to the `send`
// it is given. Nothing is sent unless the signature is valid.
//
// Two routes, never both for one delivery: a merged `pull_request.closed` becomes the retro event
// (PRD 72) and the knowledge harvest event (PRD 82), and nothing else; every other handled action
// becomes the outbox check event, exactly as before. An unmerged `closed` becomes nothing.
import { Webhooks } from '@octokit/webhooks';
import { HARVEST_EVENT, OUTBOX_CHECK_EVENT, RETRO_EVENT } from '../inngest-client.mjs';

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

/** Every event and action the app acts on. `app.yml` subscribes to exactly these events (its test says so). */
export const HANDLED = Object.freeze({
  pull_request: Object.freeze([...CHECK_ACTIONS.pull_request, ...RETRO_ACTIONS.pull_request]),
  check_run: CHECK_ACTIONS.check_run,
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
 */

/**
 * @param {{
 *   body: string,
 *   headers: Record<string, string | undefined> | Headers,
 *   secret: string | undefined,
 *   send: (events: (CheckRequest | RetroRequest | HarvestRequest)[]) => Promise<unknown>,
 * }} input
 * @returns {Promise<WebhookResponse>}
 */
export async function receiveWebhook({ body, headers, secret, send }) {
  if (!secret) return reply(500, 'webhook secret is not configured');

  const signature = header(headers, 'x-hub-signature-256');
  if (!signature || !(await verified(secret, body, signature))) return reply(401, 'bad signature');

  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    return reply(400, 'body is not JSON');
  }

  const events = toEvents(header(headers, 'x-github-event') ?? '', payload);
  if (events.length === 0) return reply(200, 'ignored');

  try {
    await send(events);
  } catch (error) {
    return reply(502, `could not send the event: ${error?.message ?? error}`);
  }
  return reply(200, `sent ${events.length}`);
}

/**
 * The router alone, pure: a retro action goes to the retro and the knowledge harvest, anything else
 * to the outbox check.
 * @param {string} event
 * @param {any} payload
 * @returns {(CheckRequest | RetroRequest | HarvestRequest)[]}
 */
export function toEvents(event, payload) {
  if (RETRO_ACTIONS[event]?.includes(payload?.action)) {
    return [...toRetroRequests(event, payload), ...toHarvestRequests(event, payload)];
  }
  return toCheckRequests(event, payload);
}

/**
 * The outbox check's filter, pure: a check action becomes one check request per pull request it
 * names; anything else — a `closed`, merged or not, included — becomes none.
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
      name: OUTBOX_CHECK_EVENT,
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
