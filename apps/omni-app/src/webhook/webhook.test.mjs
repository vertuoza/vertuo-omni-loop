import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { HARVEST_EVENT, OUTBOX_CHECK_EVENT, RETRO_EVENT } from '../inngest-client.mjs';
import { CHECK_ACTIONS, HANDLED, RETRO_ACTIONS, receiveWebhook, toCheckRequests, toEvents, toHarvestRequests, toRetroRequests } from './webhook.mjs';

const SECRET = 'shh-test-secret';

const sign = (body, secret = SECRET) => `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

const REPOSITORY = { name: 'vertuo-omni-loop', full_name: 'vertuoza/vertuo-omni-loop', owner: { login: 'vertuoza' } };
const INSTALLATION = { id: 4242 };

const pullRequestPayload = (action, over = {}) => ({
  action,
  number: 28,
  installation: INSTALLATION,
  repository: REPOSITORY,
  pull_request: {
    number: 28,
    head: { sha: 'abc123', ref: 'feat/omni-app-outbox-check' },
    base: { ref: 'main' },
  },
  ...over,
});

const rerequestedPayload = (pullRequests = [{ number: 28, head: { sha: 'abc123', ref: 'feat/x' }, base: { ref: 'main' } }]) => ({
  action: 'rerequested',
  installation: INSTALLATION,
  repository: REPOSITORY,
  check_run: { id: 9, name: 'outbox', head_sha: 'abc123', pull_requests: pullRequests },
});

function deliver({ event = 'pull_request', payload = pullRequestPayload('opened'), signature, secret = SECRET, send } = {}) {
  const body = JSON.stringify(payload);
  const headers = { 'x-github-event': event, 'x-github-delivery': 'd-1' };
  if (signature !== null) headers['x-hub-signature-256'] = signature ?? sign(body);
  const sent = send ?? vi.fn(async () => ({ ids: ['evt'] }));
  return receiveWebhook({ body, headers, secret, send: sent }).then((response) => ({ response, send: sent }));
}

describe('webhook — the signature', () => {
  it('sends one event for a validly signed, handled pull request', async () => {
    const { response, send } = await deliver();
    expect(response.status).toBe(200);
    expect(send).toHaveBeenCalledTimes(1);
    const [events] = send.mock.calls[0];
    expect(events).toEqual([
      {
        name: OUTBOX_CHECK_EVENT,
        data: {
          installationId: 4242,
          owner: 'vertuoza',
          repo: 'vertuo-omni-loop',
          repository: 'vertuoza/vertuo-omni-loop',
          prNumber: 28,
          headSha: 'abc123',
          trigger: 'pull_request.opened',
        },
      },
    ]);
  });

  it('answers 401 and sends nothing to a wrong signature', async () => {
    const { response, send } = await deliver({ signature: sign('{"tampered":true}') });
    expect(response.status).toBe(401);
    expect(send).not.toHaveBeenCalled();
  });

  it('answers 401 and sends nothing to a body signed with another secret', async () => {
    const payload = pullRequestPayload('opened');
    const { response, send } = await deliver({ payload, signature: sign(JSON.stringify(payload), 'other') });
    expect(response.status).toBe(401);
    expect(send).not.toHaveBeenCalled();
  });

  it('answers 401 and sends nothing when the signature header is missing', async () => {
    const { response, send } = await deliver({ signature: null });
    expect(response.status).toBe(401);
    expect(send).not.toHaveBeenCalled();
  });

  it('answers 401 to a malformed signature header rather than throwing', async () => {
    const { response, send } = await deliver({ signature: 'sha1=nope' });
    expect(response.status).toBe(401);
    expect(send).not.toHaveBeenCalled();
  });

  it('fails closed with 500 and sends nothing when no secret is configured', async () => {
    const { response, send } = await deliver({ secret: '' });
    expect(response.status).toBe(500);
    expect(send).not.toHaveBeenCalled();
  });
});

describe('webhook — the event and action filter', () => {
  it.each(CHECK_ACTIONS.pull_request)('handles pull_request.%s', async (action) => {
    const { response, send } = await deliver({ payload: pullRequestPayload(action) });
    expect(response.status).toBe(200);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0][0].data.trigger).toBe(`pull_request.${action}`);
  });

  it('answers 200 and sends nothing to a closed pull request that was not merged', async () => {
    const { response, send } = await deliver({ payload: pullRequestPayload('closed') });
    expect(response.status).toBe(200);
    expect(send).not.toHaveBeenCalled();
  });

  it.each(['assigned', 'review_requested', 'converted_to_draft'])('answers 200 and sends nothing to pull_request.%s', async (action) => {
    const { response, send } = await deliver({ payload: pullRequestPayload(action) });
    expect(response.status).toBe(200);
    expect(send).not.toHaveBeenCalled();
  });

  it.each([
    ['push', { ref: 'refs/heads/main', installation: INSTALLATION, repository: REPOSITORY }],
    ['issues', { action: 'opened', installation: INSTALLATION, repository: REPOSITORY }],
    ['ping', { zen: 'Keep it logically awesome.' }],
    ['check_suite', { action: 'requested', installation: INSTALLATION, repository: REPOSITORY }],
  ])('answers 200 and sends nothing to an unrelated %s event', async (event, payload) => {
    const { response, send } = await deliver({ event, payload });
    expect(response.status).toBe(200);
    expect(send).not.toHaveBeenCalled();
  });

  it('answers 200 and sends nothing to a check_run action other than rerequested', async () => {
    const { response, send } = await deliver({ event: 'check_run', payload: { ...rerequestedPayload(), action: 'completed' } });
    expect(response.status).toBe(200);
    expect(send).not.toHaveBeenCalled();
  });

  it('turns check_run.rerequested into one event for its pull request', async () => {
    const { response, send } = await deliver({ event: 'check_run', payload: rerequestedPayload() });
    expect(response.status).toBe(200);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toEqual([
      {
        name: OUTBOX_CHECK_EVENT,
        data: {
          installationId: 4242,
          owner: 'vertuoza',
          repo: 'vertuo-omni-loop',
          repository: 'vertuoza/vertuo-omni-loop',
          prNumber: 28,
          headSha: 'abc123',
          trigger: 'check_run.rerequested',
        },
      },
    ]);
  });

  it('answers 200 and sends nothing to a rerequested check run tied to no pull request', async () => {
    const { response, send } = await deliver({ event: 'check_run', payload: rerequestedPayload([]) });
    expect(response.status).toBe(200);
    expect(send).not.toHaveBeenCalled();
  });

  it('answers 200 and sends nothing to a handled event without an installation', async () => {
    const { installation, ...payload } = pullRequestPayload('opened');
    const { response, send } = await deliver({ payload });
    expect(response.status).toBe(200);
    expect(send).not.toHaveBeenCalled();
  });

  it('answers 400 to a signed body that is not JSON', async () => {
    const body = 'not json';
    const send = vi.fn();
    const response = await receiveWebhook({
      body,
      headers: { 'x-github-event': 'pull_request', 'x-hub-signature-256': sign(body) },
      secret: SECRET,
      send,
    });
    expect(response.status).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });

  it('answers 502 when the event cannot be sent, so GitHub records a failed delivery', async () => {
    const send = vi.fn(async () => {
      throw new Error('inngest down');
    });
    const { response } = await deliver({ send });
    expect(response.status).toBe(502);
  });
});

describe('toCheckRequests', () => {
  it('is the filter alone, pure: no signature, no send', () => {
    expect(toCheckRequests('pull_request', pullRequestPayload('synchronize'))).toHaveLength(1);
    expect(toCheckRequests('pull_request', pullRequestPayload('closed'))).toEqual([]);
  });

  it('never turns a closed pull request into the outbox check, merged or not', () => {
    expect(toCheckRequests('pull_request', mergedPayload())).toEqual([]);
  });
});

const MERGED_AT = '2026-09-25T14:44:12Z';
const MERGE_SHA = '4e2dc907b5fdb1d86f28778fa67ee5953981abc5';

/** A `pull_request.closed` delivery for a pull request that was merged. */
const mergedPayload = (over = {}) =>
  pullRequestPayload('closed', {
    pull_request: {
      number: 28,
      merged: true,
      merged_at: MERGED_AT,
      merge_commit_sha: MERGE_SHA,
      head: { sha: 'abc123', ref: 'feat/omni-app-outbox-check' },
      base: { ref: 'main' },
      ...over,
    },
  });

describe('webhook — the retro route (PRD 72)', () => {
  it('turns a merged pull request into one retro event and one harvest event (PRD 82), and no outbox event', async () => {
    const { response, send } = await deliver({ payload: mergedPayload() });
    expect(response.status).toBe(200);
    expect(response.body).toBe('sent 2');
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toEqual([
      {
        name: RETRO_EVENT,
        data: {
          installationId: 4242,
          owner: 'vertuoza',
          repo: 'vertuo-omni-loop',
          repository: 'vertuoza/vertuo-omni-loop',
          prNumber: 28,
          mergeSha: MERGE_SHA,
          mergedAt: MERGED_AT,
        },
      },
      {
        name: HARVEST_EVENT,
        data: {
          installationId: 4242,
          owner: 'vertuoza',
          repo: 'vertuo-omni-loop',
          repository: 'vertuoza/vertuo-omni-loop',
          prNumber: 28,
        },
      },
    ]);
  });

  it('turns a closed, unmerged pull request into nothing', () => {
    expect(toEvents('pull_request', pullRequestPayload('closed', { pull_request: { number: 28, merged: false, merged_at: null, head: { sha: 'abc123' }, base: { ref: 'main' } } }))).toEqual([]);
  });

  it('turns a merged pull request without a merge SHA into nothing', () => {
    expect(toRetroRequests('pull_request', mergedPayload({ merge_commit_sha: null }))).toEqual([]);
  });

  it('leaves the qualifying to the functions: a merged sub-PR still becomes the retro and harvest events', () => {
    const events = toEvents('pull_request', mergedPayload({ base: { ref: 'feat/retro' } }));
    expect(events.map((event) => event.name)).toEqual([RETRO_EVENT, HARVEST_EVENT]);
  });

  it('turns a closed, unmerged pull request into no harvest event', () => {
    expect(toHarvestRequests('pull_request', pullRequestPayload('closed', { pull_request: { number: 28, merged: false, merged_at: null, head: { sha: 'abc123' }, base: { ref: 'main' } } }))).toEqual([]);
  });

  it.each(CHECK_ACTIONS.pull_request)('never turns pull_request.%s into a retro or harvest event', (action) => {
    expect(toRetroRequests('pull_request', { ...mergedPayload(), action })).toEqual([]);
    expect(toHarvestRequests('pull_request', { ...mergedPayload(), action })).toEqual([]);
    expect(toEvents('pull_request', { ...mergedPayload(), action }).map((event) => event.name)).toEqual([OUTBOX_CHECK_EVENT]);
  });

  it('handles exactly the check actions and the retro actions', () => {
    expect(HANDLED.pull_request).toEqual([...CHECK_ACTIONS.pull_request, ...RETRO_ACTIONS.pull_request]);
    expect(HANDLED.check_run).toEqual(CHECK_ACTIONS.check_run);
    expect(RETRO_ACTIONS).toEqual({ pull_request: ['closed'] });
  });
});
