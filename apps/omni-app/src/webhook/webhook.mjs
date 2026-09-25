// `webhook`: a raw GitHub delivery in, a response out — and, for a handled event, the Inngest events
// that ask for the outbox check. It touches no GitHub API: it verifies GitHub's signature itself
// (PRD 28, decision 8) before anything becomes an event, filters by event and action, and hands the
// events to the `send` it is given. Nothing is sent unless the signature is valid.
import { Webhooks } from '@octokit/webhooks';
import { OUTBOX_CHECK_EVENT } from '../inngest-client.mjs';

/**
 * The events and actions the app re-evaluates on. `check_run.rerequested` is GitHub's **Re-run**
 * button; GitHub delivers it only to the app that created the check run. `app.yml` subscribes to
 * exactly these events (its test says so).
 */
export const HANDLED = Object.freeze({
  pull_request: Object.freeze(['opened', 'synchronize', 'reopened', 'ready_for_review', 'labeled', 'unlabeled', 'edited']),
  check_run: Object.freeze(['rerequested']),
});

/**
 * @typedef {{ status: number, body: string }} WebhookResponse
 * @typedef {{ name: string, data: {
 *   installationId: number, owner: string, repo: string, repository: string,
 *   prNumber: number, headSha: string, trigger: string,
 * } }} CheckRequest
 */

/**
 * @param {{
 *   body: string,
 *   headers: Record<string, string | undefined> | Headers,
 *   secret: string | undefined,
 *   send: (events: CheckRequest[]) => Promise<unknown>,
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

  const events = toCheckRequests(header(headers, 'x-github-event') ?? '', payload);
  if (events.length === 0) return reply(200, 'ignored');

  try {
    await send(events);
  } catch (error) {
    return reply(502, `could not send the event: ${error?.message ?? error}`);
  }
  return reply(200, `sent ${events.length}`);
}

/**
 * The filter alone, pure: a handled event and action become one check request per pull request it
 * names; anything else becomes none.
 * @param {string} event
 * @param {any} payload
 * @returns {CheckRequest[]}
 */
export function toCheckRequests(event, payload) {
  const actions = HANDLED[event];
  if (!actions || !actions.includes(payload?.action)) return [];

  const installationId = payload.installation?.id;
  const repository = payload.repository;
  if (!installationId || !repository?.full_name) return [];

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
      data: {
        installationId,
        owner: repository.owner?.login ?? repository.full_name.split('/')[0],
        repo: repository.name,
        repository: repository.full_name,
        prNumber: pull.number,
        headSha: pull.sha,
        trigger,
      },
    }));
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
