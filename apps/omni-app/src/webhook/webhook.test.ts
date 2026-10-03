import { parsePr } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { assertDefined } from 'vertuo-omni-plan/kit/test/assert.ts';
import { type AppEvent, HARVEST_EVENT, INBOX_CHECK_EVENT, INBOX_EXTERNAL_ID, OUTBOX_CHECK_EVENT, RETRO_EVENT } from '../inngest-client.ts';
import { inboxCheck } from '../inbox-check/inbox-check.ts';
import { CANON_ACTION, CANON_ACTION_EVENT } from '../inbox-check/canon-actions.ts';
import {
  CANON_ACTIONS,
  CHECK_ACTIONS,
  HANDLED,
  RETRO_ACTIONS,
  receiveWebhook,
  toCanonActionRequests,
  toCheckRequests,
  toEvents,
  toHarvestRequests,
  toRetroRequests,
} from './webhook.ts';
import type { StageEvent } from '../stage-forward/stage-forward.ts';

const SECRET = 'shh-test-secret';

/** What `/api/github` hands Inngest, as a test stubs it. */
type Send = (events: AppEvent[]) => Promise<unknown>;
/** A send that takes every event: Inngest's answer, ids and all. */
const sending = () => vi.fn<Send>(() => Promise.resolve({ ids: ['evt'] }));
/** A forward that takes every stage event. */
const forwarding = () => vi.fn<(event: StageEvent) => Promise<unknown>>(() => Promise.resolve());

const sign = (body: string, secret = SECRET) => `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

const REPOSITORY = { name: 'vertuo-omni-loop', full_name: 'vertuoza/vertuo-omni-loop', owner: { login: 'vertuoza' } };
const INSTALLATION = { id: 4242 };

const pullRequestPayload = (action: string, over = {}): Record<string, unknown> => ({
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

const RERUN_PULLS: unknown[] = [{ number: 28, head: { sha: 'abc123', ref: 'feat/x' }, base: { ref: 'main' } }];
const rerequestedPayload = (pullRequests = RERUN_PULLS, checkRun = {}) => ({
  action: 'rerequested',
  installation: INSTALLATION,
  repository: REPOSITORY,
  check_run: { id: 9, name: 'outbox', head_sha: 'abc123', pull_requests: pullRequests, ...checkRun },
});

/** A delivery: `signature` null sends none, and left out signs the body with the secret. */
type Delivery = { event?: string; payload?: unknown; signature?: string | null; secret?: string; send?: ReturnType<typeof sending> };

function deliver({ event = 'pull_request', payload = pullRequestPayload('opened'), signature, secret = SECRET, send }: Delivery = {}) {
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = { 'x-github-event': event, 'x-github-delivery': 'd-1' };
  if (signature !== null) headers['x-hub-signature-256'] = signature ?? sign(body);
  const sent = send ?? sending();
  return receiveWebhook({ body, headers, secret, send: sent }).then((response) => ({ response, send: sent }));
}

describe('webhook — the signature', () => {
  it('sends one event for a validly signed, handled pull request', async () => {
    const { response, send } = await deliver();
    expect(response.status).toBe(200);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0]).toEqual([
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
    expect(send.mock.calls[0]?.[0][0]?.data).toHaveProperty('trigger', `pull_request.${action}`);
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
    expect(send.mock.calls[0]?.[0]).toEqual([
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

  it('turns a re-run of an inbox check run into the inbox check event only (PRD 675)', async () => {
    const payload = rerequestedPayload(RERUN_PULLS, { name: 'inbox', external_id: INBOX_EXTERNAL_ID });
    const { send } = await deliver({ event: 'check_run', payload });
    expect(send.mock.calls[0]?.[0]).toHaveLength(1);
    expect(send.mock.calls[0]?.[0][0]).toMatchObject({ name: INBOX_CHECK_EVENT, data: { prNumber: 28, trigger: 'check_run.rerequested' } });
  });

  it('keeps a re-run of any other check run the outbox check event, whatever its name', () => {
    const payload = rerequestedPayload(RERUN_PULLS, { name: 'inbox', external_id: 'someone-else' });
    expect(toCheckRequests('check_run', payload).map((e) => e.name)).toEqual([OUTBOX_CHECK_EVENT]);
  });

  it('sends, for every handled pull request action, the one event the outbox and inbox checks both run on', () => {
    for (const action of CHECK_ACTIONS.pull_request) {
      expect(toEvents('pull_request', pullRequestPayload(action)).map((e) => e.name)).toEqual([OUTBOX_CHECK_EVENT]);
    }
    expect(inboxCheck.opts.triggers).toContainEqual({ event: OUTBOX_CHECK_EVENT });
    expect(inboxCheck.opts.triggers).toContainEqual({ event: INBOX_CHECK_EVENT });
  });

  it('answers 200 and sends nothing to a rerequested check run tied to no pull request', async () => {
    const { response, send } = await deliver({ event: 'check_run', payload: rerequestedPayload([]) });
    expect(response.status).toBe(200);
    expect(send).not.toHaveBeenCalled();
  });

  it('answers 200 and sends nothing to a handled event without an installation', async () => {
    const payload = pullRequestPayload('opened');
    delete payload.installation;
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
    const send = vi.fn<Send>(() => Promise.reject(new Error('inngest down')));
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

  it('reads the pull request number as one (PRD 1049): a delivery naming no pull request number becomes nothing', () => {
    const [request] = toCheckRequests('pull_request', pullRequestPayload('synchronize'));
    expect(request?.data.prNumber).toBe(parsePr(28));
    expect(toCheckRequests('pull_request', pullRequestPayload('synchronize', { number: 0, pull_request: { number: 0, head: { sha: 'abc123' } } }))).toEqual([]);
    expect(toRetroRequests('pull_request', mergedPayload({ number: 2.5 }))).toEqual([]);
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
    expect(send.mock.calls[0]?.[0]).toEqual([
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

  it('handles exactly the check actions, the retro actions and the canon buttons', () => {
    expect(HANDLED.pull_request).toEqual([...CHECK_ACTIONS.pull_request, ...RETRO_ACTIONS.pull_request]);
    expect(HANDLED.check_run).toEqual([...CHECK_ACTIONS.check_run, ...CANON_ACTIONS.check_run]);
    expect(RETRO_ACTIONS).toEqual({ pull_request: ['closed'] });
  });
});

describe('webhook — the stage events (PRD 587)', () => {
  const REPO = { ...REPOSITORY, default_branch: 'main' };
  const stagePayload = (action: string, head: string, base: string) => ({
    action,
    number: 40,
    installation: INSTALLATION,
    repository: REPO,
    pull_request: {
      number: 40,
      head: { sha: 'abc123', ref: head },
      base: { ref: base },
      merged: action === 'closed',
      merge_commit_sha: action === 'closed' ? 'm1' : null,
      merged_at: action === 'closed' ? '2026-09-29T10:00:00Z' : null,
      created_at: '2026-09-29T08:00:00Z',
      updated_at: '2026-09-29T09:00:00Z',
      body: 'Refs #587',
    },
  });

  const receive = (
    payload: unknown,
    { forward, send = sending(), signature }: { forward?: ReturnType<typeof forwarding>; send?: ReturnType<typeof sending>; signature?: string } = {},
  ) => {
    const body = JSON.stringify(payload);
    return receiveWebhook({
      body,
      headers: { 'x-github-event': 'pull_request', 'x-hub-signature-256': signature ?? sign(body) },
      secret: SECRET,
      send,
      forward,
    });
  };

  const cases: [string, ReturnType<typeof stagePayload>, string][] = [
    ['a merged phase-0 PR', stagePayload('closed', 'docs/phase-0-real-stages', 'main'), 'inbox'],
    ['a merged slice PR', stagePayload('closed', 'feat/real-stages--s1', 'feat/real-stages'), 'building'],
    ['the feature PR marked ready', stagePayload('ready_for_review', 'feat/real-stages', 'main'), 'outbox'],
    ['the merged feature PR', stagePayload('closed', 'feat/real-stages', 'main'), 'shipped'],
    ['an opened retro PR', stagePayload('opened', 'docs/retro-real-stages', 'main'), 'retro'],
  ];

  it.each(cases)('forwards %s as one stage event', async (_, payload, stage) => {
    const forward = forwarding();
    const response = await receive(payload, { forward });
    expect(response.status).toBe(200);
    expect(forward).toHaveBeenCalledTimes(1);
    const forwarded = forward.mock.calls[0]?.[0];
    assertDefined(forwarded, 'the stage event');
    expect(forwarded).toEqual({ repository: 'vertuoza/vertuo-omni-loop', topic: 'real-stages', prd: 587, stage, at: forwarded.at });
    expect(forwarded.at).toEqual(expect.any(String));
  });

  it('keeps the retro, harvest and outbox-check events unchanged beside it', async () => {
    const send = sending();
    await receive(stagePayload('closed', 'feat/real-stages', 'main'), { send, forward: forwarding() });
    expect(send.mock.calls[0]?.[0].map((event) => event.name)).toEqual([RETRO_EVENT, HARVEST_EVENT]);
    expect(toEvents('pull_request', stagePayload('ready_for_review', 'feat/x', 'main')).map((event) => event.name)).toEqual([OUTBOX_CHECK_EVENT]);
  });

  it('forwards nothing for any other branch or action, and nothing on a bad signature', async () => {
    const forward = forwarding();
    await receive(stagePayload('closed', 'fix/typo', 'main'), { forward });
    await receive(stagePayload('synchronize', 'feat/x', 'main'), { forward });
    const refused = await receive(cases[0]?.[1], { forward, signature: sign('x') });
    expect(refused.status).toBe(401);
    expect(forward).not.toHaveBeenCalled();
  });

  it('never fails the reply when the forward throws, nor when the Inngest send finds nothing to send', async () => {
    const forward = vi.fn<(event: StageEvent) => Promise<unknown>>(() => Promise.reject(new Error('galaxy down')));
    const response = await receive(cases[0]?.[1], { forward });
    expect(response.status).toBe(200);
  });
});

describe('webhook — the two actions on a red canon check (PRD 839)', () => {
  const FACTS = { prd: 839, persona: 'Marc', claims: ['never#4'] };
  const clicked = (identifier: string, over = {}) => ({
    action: 'requested_action',
    installation: INSTALLATION,
    repository: REPOSITORY,
    requested_action: { identifier },
    check_run: {
      id: 77,
      name: 'inbox',
      external_id: INBOX_EXTERNAL_ID,
      head_sha: 'abc123',
      output: { title: 'Not ok: canon ✗ 1', summary: `PRD 839\n\n- not ok — canon: canon ✗ 1\n\n<!-- omni-canon ${JSON.stringify(FACTS)} -->` },
      pull_requests: [{ number: 28, head: { sha: 'abc123', ref: 'docs/phase-0-canon-check' }, base: { ref: 'main' } }],
      ...over,
    },
  });

  it('handles check_run.requested_action beside the re-run', () => {
    expect(HANDLED.check_run).toEqual(['rerequested', 'requested_action']);
    expect(CANON_ACTIONS.check_run).toEqual(['requested_action']);
  });

  it.each([CANON_ACTION.rewrite, CANON_ACTION.claim])('turns a click of %s on an inbox check run into one canon action event', async (identifier) => {
    const { response, send } = await deliver({ event: 'check_run', payload: clicked(identifier) });
    expect(response.status).toBe(200);
    expect(send.mock.calls[0]?.[0]).toEqual([
      {
        name: CANON_ACTION_EVENT,
        data: {
          installationId: 4242,
          owner: 'vertuoza',
          repo: 'vertuo-omni-loop',
          repository: 'vertuoza/vertuo-omni-loop',
          prNumber: 28,
          headSha: 'abc123',
          checkRunId: 77,
          action: identifier,
          facts: FACTS,
        },
      },
    ]);
  });

  it('never re-runs a check for a click', () => {
    expect(toEvents('check_run', clicked(CANON_ACTION.rewrite)).map((e) => e.name)).toEqual([CANON_ACTION_EVENT]);
    expect(toCheckRequests('check_run', clicked(CANON_ACTION.rewrite))).toEqual([]);
  });

  it.each([
    ['another check run', clicked(CANON_ACTION.rewrite, { external_id: 'someone-else' })],
    ['an unknown button', clicked('ship-anyway')],
    ['a check run without the canon facts', clicked(CANON_ACTION.claim, { output: { title: 'x', summary: 'PRD 839' } })],
    ['a check run tied to no pull request', clicked(CANON_ACTION.claim, { pull_requests: [] })],
  ])('sends nothing for %s', async (_, payload) => {
    expect(toCanonActionRequests('check_run', payload)).toEqual([]);
    const { response, send } = await deliver({ event: 'check_run', payload });
    expect(response.status).toBe(200);
    expect(send).not.toHaveBeenCalled();
  });
});
