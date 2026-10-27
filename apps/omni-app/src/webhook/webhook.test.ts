import { parsePr } from 'omni-loop/kit/lib/ids.ts';
import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { assertDefined } from 'omni-loop/kit/test/assert.ts';
import { type AppEvent, APPROVED_CHECK_EVENT, APPROVED_EXTERNAL_ID, BUDGETS_CHECK_EVENT, BUDGETS_EXTERNAL_ID, HARVEST_EVENT, INBOX_CHECK_EVENT, INBOX_EXTERNAL_ID, OUTBOX_CHECK_EVENT, RETRO_EVENT } from '../inngest-client.ts';
import { CANON_ACTION, CANON_ACTION_EVENT } from '../inbox-check/canon-actions.ts';
import {
  APPROVED_LABEL_ACTIONS,
  CANON_ACTIONS,
  CHECK_ACTIONS,
  FIX_STAMP_ACTIONS,
  HANDLED,
  RETRO_ACTIONS,
  receiveWebhook,
  toApprovedLabelRequests,
  toCanonActionRequests,
  toCheckRequests,
  toEvents,
  toFixStampRequests,
  toFleetBoardRequests,
  toHarvestRequests,
  toMainWatchRequests,
  toRetroRequests,
} from './webhook.ts';
import { FLEET_BOARD_EVENT, type FleetBoardRequest } from '../fleet-board/events.ts';
import { OMNI_LOGIN } from '../pr-stats/signed.ts';
import { SIGNED_MARKER } from 'omni-loop/kit/lib/signature.ts';
import { MAIN_WATCH_CI_EVENT, MAIN_WATCH_EVENT, type MainWatchRequest } from '../main-watch/events.ts';
import { APPROVED_LABEL_EVENT } from '../inngest-client.ts';
import type { StageEvent } from '../stage-forward/stage-forward.ts';
import { FIX_STAMP_EVENT, type FixStampRequest } from '../fix-rows/fix-stamp.ts';
import type { Touch } from '../stage-forward/touch.ts';
import { appFunctions } from '../functions.ts';
import { readEnv } from '../env.ts';

/** The functions the app serves, bound to an empty environment. */
const { inboxCheck, approvedCheck } = appFunctions(readEnv({}));

const SECRET = 'shh-test-secret';

/** What `/api/github` hands Inngest, as a test stubs it. */
type Send = (events: AppEvent[]) => Promise<unknown>;
/** A send that takes every event: Inngest's answer, ids and all. */
const sending = () => vi.fn<Send>(() => Promise.resolve({ ids: ['evt'] }));
/** A forward that takes every stage event. */
const forwarding = () => vi.fn<(event: StageEvent) => Promise<unknown>>(() => Promise.resolve());

const sign = (body: string, secret = SECRET) => `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

const REPOSITORY = { name: 'vertuo-omni-loop', full_name: 'vertuoza/vertuo-omni-loop', owner: { login: 'vertuoza' }, default_branch: 'main' };
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
  return receiveWebhook({ body, headers, secret, send: sent, forward: forwarding() }).then((response) => ({ response, send: sent }));
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

  it('turns a re-run of an approved check run into the approved check event only (PRD 1548)', async () => {
    const payload = rerequestedPayload(RERUN_PULLS, { name: 'omni/approved', external_id: APPROVED_EXTERNAL_ID });
    const { send } = await deliver({ event: 'check_run', payload });
    expect(send.mock.calls[0]?.[0]).toHaveLength(1);
    expect(send.mock.calls[0]?.[0][0]).toMatchObject({ name: APPROVED_CHECK_EVENT, data: { prNumber: 28, trigger: 'check_run.rerequested' } });
  });

  it('turns a re-run of a budgets check run into the budgets check event only (PRD 1679)', async () => {
    const payload = rerequestedPayload(RERUN_PULLS, { name: 'omni / budgets', external_id: BUDGETS_EXTERNAL_ID });
    const { send } = await deliver({ event: 'check_run', payload });
    expect(send.mock.calls[0]?.[0]).toHaveLength(1);
    expect(send.mock.calls[0]?.[0][0]).toMatchObject({ name: BUDGETS_CHECK_EVENT, data: { prNumber: 28, trigger: 'check_run.rerequested' } });
  });

  it('keeps a re-run of any other check run the outbox check event, whatever its name', () => {
    const payload = rerequestedPayload(RERUN_PULLS, { name: 'inbox', external_id: 'someone-else' });
    expect(toCheckRequests('check_run', payload).map((e) => e.name)).toEqual([OUTBOX_CHECK_EVENT]);
  });

  it('sends, for every handled pull request action, the one event the outbox, inbox and approved checks all run on', () => {
    for (const action of CHECK_ACTIONS.pull_request) {
      expect(toEvents('pull_request', pullRequestPayload(action)).map((e) => e.name)).toEqual([OUTBOX_CHECK_EVENT]);
    }
    expect(inboxCheck.opts.triggers).toContainEqual({ event: OUTBOX_CHECK_EVENT });
    expect(inboxCheck.opts.triggers).toContainEqual({ event: INBOX_CHECK_EVENT });
    expect(approvedCheck.opts.triggers).toContainEqual({ event: OUTBOX_CHECK_EVENT });
    expect(approvedCheck.opts.triggers).toContainEqual({ event: APPROVED_CHECK_EVENT });
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
      forward: forwarding(),
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

  it('turns no event of a sub-PR, a pull request into another branch than the default, into an outbox check (#1413)', () => {
    const subPr = { number: 28, head: { sha: 'abc123', ref: 'feat/x--s1' }, base: { ref: 'feat/x' } };
    for (const action of CHECK_ACTIONS.pull_request) {
      expect(toCheckRequests('pull_request', pullRequestPayload(action, { pull_request: subPr })), action).toEqual([]);
    }
    expect(toCheckRequests('check_run', rerequestedPayload([subPr]))).toEqual([]);
  });

  it('still turns a pull request into the default branch, and its check re-run, into the outbox check (#1413)', () => {
    expect(toCheckRequests('pull_request', pullRequestPayload('synchronize'))).toHaveLength(1);
    expect(toCheckRequests('check_run', rerequestedPayload())).toHaveLength(1);
  });

  it('never turns a closed pull request into the outbox check, merged or not', () => {
    expect(toCheckRequests('pull_request', mergedPayload())).toEqual([]);
  });

  it('turns a review submitted or dismissed into the outbox check of its pull request (PRD 1726); no other review action', () => {
    expect(CHECK_ACTIONS.pull_request_review).toEqual(['submitted', 'dismissed']);
    for (const action of ['submitted', 'dismissed']) {
      expect(toCheckRequests('pull_request_review', pullRequestPayload(action, { review: { state: 'approved' } }))).toEqual([
        {
          name: OUTBOX_CHECK_EVENT,
          data: {
            installationId: 4242,
            owner: 'vertuoza',
            repo: 'vertuo-omni-loop',
            repository: 'vertuoza/vertuo-omni-loop',
            prNumber: parsePr(28),
            headSha: 'abc123',
            trigger: `pull_request_review.${action}`,
          },
        },
      ]);
    }
    expect(toCheckRequests('pull_request_review', pullRequestPayload('edited'))).toEqual([]);
    const subPr = { number: 28, head: { sha: 'abc123', ref: 'feat/x--s1' }, base: { ref: 'feat/x' } };
    expect(toCheckRequests('pull_request_review', pullRequestPayload('submitted', { pull_request: subPr }))).toEqual([]);
    expect(HANDLED.pull_request_review).toEqual(['submitted', 'dismissed']);
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
    // The retro, the harvest, and beside them the fix stamp (PRD 2011 s7) and the main watch (PRD 2410), which `send` never gets.
    expect(response.body).toBe('sent 4');
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

  it('turns a pull request merged into another branch than the default, a sub-PR, into no retro and no harvest event (#1409)', () => {
    const subPr = mergedPayload({ head: { sha: 'abc123', ref: 'feat/retro--s1' }, base: { ref: 'feat/retro' } });
    expect(toRetroRequests('pull_request', subPr)).toEqual([]);
    expect(toHarvestRequests('pull_request', subPr)).toEqual([]);
    expect(toEvents('pull_request', subPr)).toEqual([]);
  });

  it('leaves the rest of the qualifying to the functions: any pull request merged into the default branch becomes both events', () => {
    const events = toEvents('pull_request', mergedPayload({ head: { sha: 'abc123', ref: 'docs/phase-0-retro' } }));
    expect(events.map((event) => event.name)).toEqual([RETRO_EVENT, HARVEST_EVENT]);
  });

  it('sends both events when the delivery names no default branch, as before (#1409)', () => {
    const payload = { ...mergedPayload({ base: { ref: 'feat/retro' } }), repository: { name: 'vertuo-omni-loop', full_name: 'vertuoza/vertuo-omni-loop', owner: { login: 'vertuoza' } } };
    expect(toEvents('pull_request', payload).map((event) => event.name)).toEqual([RETRO_EVENT, HARVEST_EVENT]);
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
    { forward = forwarding(), send = sending(), signature }: { forward?: ReturnType<typeof forwarding>; send?: ReturnType<typeof sending>; signature?: string } = {},
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

describe('webhook — touches (PRD 902, s3)', () => {
  const deliver = (event: string, payload: unknown, touch: (touch: Touch) => Promise<unknown>, signature?: string) => {
    const body = JSON.stringify(payload);
    return receiveWebhook({
      body,
      headers: { 'x-github-event': event, 'x-hub-signature-256': signature ?? sign(body) },
      secret: SECRET,
      send: sending(),
      forward: forwarding(),
      touch,
    });
  };

  it('hands every touch of a signed delivery to `touch`, whether or not it becomes an event', async () => {
    const touch = vi.fn<(touch: Touch) => Promise<unknown>>(() => Promise.resolve());
    const push = { ref: 'refs/heads/feat/x', installation: INSTALLATION, repository: REPOSITORY, commits: [] };
    expect(await deliver('push', push, touch)).toEqual({ status: 200, body: 'ignored' });
    expect(touch.mock.calls.map(([one]) => one)).toEqual([{ repository: 'vertuoza/vertuo-omni-loop', branch: 'feat/x' }]);
  });

  it('hands nothing on a bad signature, and never fails the reply when a touch throws', async () => {
    const refused = vi.fn<(touch: Touch) => Promise<unknown>>(() => Promise.resolve());
    const issue = { action: 'opened', installation: INSTALLATION, repository: REPOSITORY, issue: { number: 902 } };
    expect((await deliver('issues', issue, refused, sign('x'))).status).toBe(401);
    expect(refused).not.toHaveBeenCalled();
    const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const failing = vi.fn<(touch: Touch) => Promise<unknown>>(() => Promise.reject(new Error('galaxy down')));
    try {
      expect((await deliver('issues', issue, failing)).status).toBe(200);
      // Said as a JSON note line at warn, today's sentence as its message (PRD 1723 s6).
      expect(write.mock.calls.map(([line]) => JSON.parse(String(line)) as unknown)).toEqual([
        { level: 'warn', event: 'note', fn: 'webhook', message: 'touch: could not forward — galaxy down' },
      ]);
    } finally {
      write.mockRestore();
    }
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

describe('webhook — the approved label (PRD 1612)', () => {
  const labelPayload = (action: string, over: { label?: string; issue?: Record<string, unknown> } = {}) => ({
    action,
    installation: INSTALLATION,
    repository: REPOSITORY,
    label: { name: over.label ?? 'omni:approved' },
    issue: { number: 1612, updated_at: '2026-10-11T10:00:00Z', ...over.issue },
  });

  it('handles the approved label added and removed on an issue', () => {
    expect(APPROVED_LABEL_ACTIONS).toEqual({ issues: ['labeled', 'unlabeled'] });
  });

  it.each(['labeled', 'unlabeled'])('the approved label %s on a PRD issue is one approved label event naming the PRD', (action) => {
    expect(toApprovedLabelRequests('issues', labelPayload(action))).toEqual([
      {
        name: APPROVED_LABEL_EVENT,
        data: {
          installationId: 4242,
          owner: 'vertuoza',
          repo: 'vertuo-omni-loop',
          repository: 'vertuoza/vertuo-omni-loop',
          prd: 1612,
          trigger: `issues.${action}`,
        },
      },
    ]);
  });

  it('another label, a pull request’s label, another action or another event is none', () => {
    expect(toApprovedLabelRequests('issues', labelPayload('labeled', { label: 'bug' }))).toEqual([]);
    expect(toApprovedLabelRequests('issues', labelPayload('labeled', { issue: { pull_request: {} } }))).toEqual([]);
    expect(toApprovedLabelRequests('issues', labelPayload('opened'))).toEqual([]);
    expect(toApprovedLabelRequests('pull_request', labelPayload('labeled'))).toEqual([]);
  });

  it('is not the outbox check’s event', () => {
    expect(toEvents('issues', labelPayload('labeled'))).toEqual([]);
  });

  it('a signed delivery of the approved label hands the event to sendApproved, nothing to send', async () => {
    const payload = labelPayload('unlabeled');
    const body = JSON.stringify(payload);
    const send = sending();
    const sendApproved = vi.fn(() => Promise.resolve());
    const response = await receiveWebhook({
      body,
      headers: { 'x-github-event': 'issues', 'x-hub-signature-256': sign(body) },
      secret: SECRET,
      send,
      sendApproved,
      forward: forwarding(),
    });
    expect(response).toEqual({ status: 200, body: 'sent 1' });
    expect(send).not.toHaveBeenCalled();
    expect(sendApproved).toHaveBeenCalledWith(toApprovedLabelRequests('issues', payload));
  });
});

describe('webhook — the fix stamp (PRD 2011 s7)', () => {
  const FIXES = 'The upload retries offline.\n\nFixes mobile-B74 · https://omni.example/bugs/mobile-B74';
  const closedPayload = (over = {}) =>
    pullRequestPayload('closed', {
      pull_request: { number: 28, merged: false, merged_at: null, closed_at: '2026-09-25T15:00:00Z', updated_at: '2026-09-25T15:00:00Z', head: { sha: 'abc123' }, base: { ref: 'main' }, ...over },
    });
  const stampOf = (kind: string, at: string, bug: string | null = null) => ({
    name: FIX_STAMP_EVENT,
    id: `fix-stamp:vertuoza/vertuo-omni-loop#28:${kind}:${at}`,
    data: { installationId: 4242, repository: 'vertuoza/vertuo-omni-loop', prNumber: 28, kind, at, bug },
  });

  it('turns a merged pull request into the default branch into one fix stamp, at its merge, naming the record its body names', () => {
    expect(toFixStampRequests('pull_request', mergedPayload())).toEqual([stampOf('merged', MERGED_AT)]);
    expect(toFixStampRequests('pull_request', mergedPayload({ body: FIXES }))).toEqual([stampOf('merged', MERGED_AT, 'mobile-B74')]);
  });

  it('turns a pull request closed unmerged into a close at its close, and one reopened into a reopen at its last update', () => {
    expect(toFixStampRequests('pull_request', closedPayload())).toEqual([stampOf('closed', '2026-09-25T15:00:00Z')]);
    const reopened = { ...closedPayload({ closed_at: null, updated_at: '2026-09-25T16:00:00Z' }), action: 'reopened' };
    expect(toFixStampRequests('pull_request', reopened)).toEqual([stampOf('reopened', '2026-09-25T16:00:00Z')]);
  });

  it('turns a pull request into another branch into none, unless its body names a record (#1409)', () => {
    expect(toFixStampRequests('pull_request', mergedPayload({ base: { ref: 'feat/retro' } }))).toEqual([]);
    expect(toFixStampRequests('pull_request', closedPayload({ base: { ref: 'feat/retro' } }))).toEqual([]);
    expect(toFixStampRequests('pull_request', mergedPayload({ base: { ref: 'develop' }, body: FIXES }))).toEqual([stampOf('merged', MERGED_AT, 'mobile-B74')]);
    const noDefault = { ...mergedPayload({ base: { ref: 'feat/retro' } }), repository: { name: 'vertuo-omni-loop', full_name: 'vertuoza/vertuo-omni-loop', owner: { login: 'vertuoza' } } };
    expect(toFixStampRequests('pull_request', noDefault)).toEqual([stampOf('merged', MERGED_AT)]);
  });

  it('turns no other action, no other event, and no delivery missing its installation, number or time into one', () => {
    for (const action of CHECK_ACTIONS.pull_request.filter((one) => one !== 'reopened')) {
      expect(toFixStampRequests('pull_request', { ...mergedPayload(), action }), action).toEqual([]);
    }
    expect(toFixStampRequests('pull_request_review', { ...mergedPayload(), action: 'submitted' })).toEqual([]);
    expect(toFixStampRequests('pull_request', { ...mergedPayload(), installation: null })).toEqual([]);
    expect(toFixStampRequests('pull_request', { ...mergedPayload({ number: null }), number: null })).toEqual([]);
    expect(toFixStampRequests('pull_request', mergedPayload({ merged_at: null }))).toEqual([]);
    expect(toFixStampRequests('pull_request', closedPayload({ closed_at: null }))).toEqual([]);
    expect(toFixStampRequests('pull_request', { ...closedPayload({ updated_at: null }), action: 'reopened' })).toEqual([]);
    expect(toFixStampRequests('pull_request', 'not a delivery')).toEqual([]);
    expect(FIX_STAMP_ACTIONS).toEqual({ pull_request: ['closed', 'reopened'] });
    expect(HANDLED.pull_request).toEqual(expect.arrayContaining([...FIX_STAMP_ACTIONS.pull_request]));
  });

  it('a signed delivery hands its fix stamp to sendStamps, beside the events `send` gets, and answers 502 when it cannot be sent', async () => {
    const payload = mergedPayload({ body: FIXES });
    const body = JSON.stringify(payload);
    const send = sending();
    const sendStamps = vi.fn((events: FixStampRequest[]) => Promise.resolve(events.length));
    const response = await receiveWebhook({ body, headers: { 'x-github-event': 'pull_request', 'x-hub-signature-256': sign(body) }, secret: SECRET, send, sendStamps, forward: forwarding() });
    expect(response).toEqual({ status: 200, body: 'sent 4' });
    expect(send.mock.calls[0]?.[0].map((event) => event.name)).toEqual([RETRO_EVENT, HARVEST_EVENT]);
    expect(sendStamps).toHaveBeenCalledWith([stampOf('merged', MERGED_AT, 'mobile-B74')]);

    const closed = JSON.stringify(closedPayload());
    const failing = vi.fn(() => Promise.reject(new Error('inngest is down')));
    const refused = await receiveWebhook({ body: closed, headers: { 'x-github-event': 'pull_request', 'x-hub-signature-256': sign(closed) }, secret: SECRET, send: sending(), sendStamps: failing, forward: forwarding() });
    expect(refused).toEqual({ status: 502, body: 'could not send the event: inngest is down' });
  });

  it('a delivery with a bad signature hands sendStamps nothing', async () => {
    const body = JSON.stringify(mergedPayload());
    const sendStamps = vi.fn(() => Promise.resolve());
    const response = await receiveWebhook({ body, headers: { 'x-github-event': 'pull_request', 'x-hub-signature-256': sign(body, 'another') }, secret: SECRET, send: sending(), sendStamps, forward: forwarding() });
    expect(response.status).toBe(401);
    expect(sendStamps).not.toHaveBeenCalled();
  });
});

describe('webhook — the main watch (PRD 2410)', () => {
  const suitePayload = (over: Record<string, unknown> = {}, repository: Record<string, unknown> = REPOSITORY) => ({
    action: 'completed',
    installation: INSTALLATION,
    repository,
    check_suite: { id: 77, head_branch: 'main', head_sha: MERGE_SHA, status: 'completed', conclusion: 'failure', ...over },
  });
  const ciEvent = { name: MAIN_WATCH_CI_EVENT, id: 'main-watch-ci:vertuoza/vertuo-omni-loop:77', data: { installationId: 4242, repository: 'vertuoza/vertuo-omni-loop', sha: MERGE_SHA } };

  it('turns a pull request merged into the default branch into one main watch event, carrying its merge, with an id', () => {
    expect(toMainWatchRequests('pull_request', mergedPayload())).toEqual([
      {
        name: MAIN_WATCH_EVENT,
        id: `main-watch:vertuoza/vertuo-omni-loop#28:${MERGE_SHA}`,
        data: { installationId: 4242, owner: 'vertuoza', repo: 'vertuo-omni-loop', repository: 'vertuoza/vertuo-omni-loop', prNumber: 28, mergeSha: MERGE_SHA, mergedAt: MERGED_AT },
      },
    ]);
    expect(toMainWatchRequests('pull_request', mergedPayload({ base: { ref: 'feat/retro' } }))).toEqual([]);
    expect(toMainWatchRequests('pull_request', pullRequestPayload('closed', { pull_request: { number: 28, merged: false, head: { sha: 'abc123' }, base: { ref: 'main' } } }))).toEqual([]);
    expect(toMainWatchRequests('pull_request', pullRequestPayload('opened'))).toEqual([]);
  });

  it('turns a check suite of the default branch that completed red into one CI event naming its commit', () => {
    for (const conclusion of ['failure', 'timed_out', 'startup_failure']) {
      expect(toMainWatchRequests('check_suite', suitePayload({ conclusion })), conclusion).toEqual([ciEvent]);
    }
    const noDefault = { name: 'vertuo-omni-loop', full_name: 'vertuoza/vertuo-omni-loop', owner: { login: 'vertuoza' } };
    expect(toMainWatchRequests('check_suite', suitePayload({ head_branch: 'feat/x' }, noDefault))).toEqual([ciEvent]);
  });

  it('turns a green, neutral or cancelled suite, a suite of another branch, another action or a suite missing its commit into none', () => {
    for (const conclusion of ['success', 'neutral', 'cancelled', 'skipped', null]) {
      expect(toMainWatchRequests('check_suite', suitePayload({ conclusion })), String(conclusion)).toEqual([]);
    }
    expect(toMainWatchRequests('check_suite', suitePayload({ head_branch: 'feat/x' }))).toEqual([]);
    expect(toMainWatchRequests('check_suite', { ...suitePayload(), action: 'requested' })).toEqual([]);
    expect(toMainWatchRequests('check_suite', suitePayload({ head_sha: null }))).toEqual([]);
    expect(toMainWatchRequests('check_suite', suitePayload({ id: null }))).toEqual([]);
    expect(toMainWatchRequests('check_suite', { ...suitePayload(), installation: null })).toEqual([]);
    expect(toEvents('check_suite', suitePayload())).toEqual([]);
  });

  it('a signed delivery hands the main watch its events, nothing to send, and answers 502 when they cannot be sent', async () => {
    const body = JSON.stringify(suitePayload());
    const headers = { 'x-github-event': 'check_suite', 'x-hub-signature-256': sign(body) };
    const send = sending();
    const sendWatch = vi.fn((events: MainWatchRequest[]) => Promise.resolve(events.length));
    expect(await receiveWebhook({ body, headers, secret: SECRET, send, sendWatch, forward: forwarding() })).toEqual({ status: 200, body: 'sent 1' });
    expect(sendWatch).toHaveBeenCalledWith([ciEvent]);
    expect(send).not.toHaveBeenCalled();

    const failing = vi.fn(() => Promise.reject(new Error('inngest is down')));
    expect(await receiveWebhook({ body, headers, secret: SECRET, send, sendWatch: failing, forward: forwarding() })).toEqual({ status: 502, body: 'could not send the event: inngest is down' });
    const bad = vi.fn(() => Promise.resolve());
    expect((await receiveWebhook({ body, headers: { ...headers, 'x-hub-signature-256': sign(body, 'another') }, secret: SECRET, send, sendWatch: bad, forward: forwarding() })).status).toBe(401);
    expect(bad).not.toHaveBeenCalled();
  });
});

describe('webhook — the fleet board (PRD 2530)', () => {
  const SIGNED_BODY = `Closes #2530\n\n🦸 Omni-man by [Omni Loop](https://www.omni-loop.xyz) © ${SIGNED_MARKER}`;
  const UPDATED_AT = '2026-10-27T10:00:00Z';
  const loopPull = (action: string, pull: Record<string, unknown> = {}, over: Record<string, unknown> = {}) =>
    pullRequestPayload(action, {
      pull_request: {
        number: 28,
        node_id: 'PR_kwDOabc',
        html_url: 'https://github.com/vertuoza/vertuo-omni-loop/pull/28',
        state: 'open',
        body: SIGNED_BODY,
        user: { login: 'Ada-L' },
        updated_at: UPDATED_AT,
        head: { sha: 'abc123', ref: 'feat/fleet-project-board' },
        base: { ref: 'main' },
        ...pull,
      },
      ...over,
    });
  const boardEvent = (action: string, author = 'Ada-L') => ({
    name: FLEET_BOARD_EVENT,
    id: `fleet-board:vertuoza/vertuo-omni-loop#28:${action}:${UPDATED_AT}`,
    data: {
      installationId: 4242,
      owner: 'vertuoza',
      repo: 'vertuo-omni-loop',
      repository: 'vertuoza/vertuo-omni-loop',
      prNumber: 28,
      nodeId: 'PR_kwDOabc',
      url: 'https://github.com/vertuoza/vertuo-omni-loop/pull/28',
      author,
    },
  });

  it.each(['opened', 'reopened', 'ready_for_review', 'edited'])('turns pull_request.%s of a signed, open pull request into the default branch into one fleet board event', (action) => {
    expect(toFleetBoardRequests('pull_request', loopPull(action))).toEqual([boardEvent(action)]);
  });

  it('counts a pull request the loop’s bot opened as signed, whatever its body', () => {
    assertDefined(OMNI_LOGIN, 'the loop’s bot login');
    expect(toFleetBoardRequests('pull_request', loopPull('opened', { body: 'no footer', user: { login: OMNI_LOGIN } }))).toEqual([boardEvent('opened', OMNI_LOGIN)]);
  });

  it('turns a pull request typed by hand into none', () => {
    expect(toFleetBoardRequests('pull_request', loopPull('opened', { body: 'Fixes the login page.' }))).toEqual([]);
    expect(toFleetBoardRequests('pull_request', loopPull('edited', { body: null }))).toEqual([]);
  });

  it('turns a sub-PR into its feature branch into none, and a delivery naming no default branch too', () => {
    expect(toFleetBoardRequests('pull_request', loopPull('opened', { base: { ref: 'feat/fleet-project-board' } }))).toEqual([]);
    const noDefault = { name: 'vertuo-omni-loop', full_name: 'vertuoza/vertuo-omni-loop', owner: { login: 'vertuoza' } };
    expect(toFleetBoardRequests('pull_request', loopPull('opened', {}, { repository: noDefault }))).toEqual([]);
  });

  it('turns a closed pull request into none, whatever its action says', () => {
    expect(toFleetBoardRequests('pull_request', loopPull('edited', { state: 'closed' }))).toEqual([]);
    expect(toFleetBoardRequests('pull_request', loopPull('closed', { state: 'closed', merged: true, merge_commit_sha: MERGE_SHA, merged_at: MERGED_AT }))).toEqual([]);
  });

  it.each(['synchronize', 'labeled', 'unlabeled', 'converted_to_draft', 'assigned'])('turns pull_request.%s into none', (action) => {
    expect(toFleetBoardRequests('pull_request', loopPull(action))).toEqual([]);
  });

  it('turns a delivery missing its installation, author, node id, link or update time into none, and any other event too', () => {
    expect(toFleetBoardRequests('pull_request', { ...loopPull('opened'), installation: null })).toEqual([]);
    expect(toFleetBoardRequests('pull_request', loopPull('opened', { user: null }))).toEqual([]);
    expect(toFleetBoardRequests('pull_request', loopPull('opened', { node_id: null }))).toEqual([]);
    expect(toFleetBoardRequests('pull_request', loopPull('opened', { html_url: null }))).toEqual([]);
    expect(toFleetBoardRequests('pull_request', loopPull('opened', { updated_at: null }))).toEqual([]);
    expect(toFleetBoardRequests('pull_request_review', loopPull('submitted'))).toEqual([]);
    expect(toFleetBoardRequests('issues', loopPull('opened'))).toEqual([]);
  });

  it('leaves every event the pull request became before unchanged: signed, it becomes what it would by hand, and the board’s event beside', () => {
    for (const action of ['opened', 'reopened', 'ready_for_review', 'edited']) {
      const signed = loopPull(action);
      const byHand = loopPull(action, { body: 'by hand' });
      expect(toEvents('pull_request', signed)).toEqual(toEvents('pull_request', byHand));
      expect(toEvents('pull_request', signed).map((event) => event.name)).toEqual([OUTBOX_CHECK_EVENT]);
      expect(toFixStampRequests('pull_request', signed)).toEqual(toFixStampRequests('pull_request', byHand));
      expect(toMainWatchRequests('pull_request', signed)).toEqual([]);
      expect(toApprovedLabelRequests('pull_request', signed)).toEqual([]);
    }
    expect(toFixStampRequests('pull_request', loopPull('reopened')).map((event) => event.name)).toEqual([FIX_STAMP_EVENT]);
  });

  it('a signed delivery hands the fleet board its event beside the outbox check’s, and answers 502 when it cannot be sent', async () => {
    const body = JSON.stringify(loopPull('opened'));
    const headers = { 'x-github-event': 'pull_request', 'x-hub-signature-256': sign(body) };
    const send = sending();
    const sendBoard = vi.fn((events: FleetBoardRequest[]) => Promise.resolve(events.length));
    expect(await receiveWebhook({ body, headers, secret: SECRET, send, sendBoard, forward: forwarding() })).toEqual({ status: 200, body: 'sent 2' });
    expect(sendBoard).toHaveBeenCalledWith([boardEvent('opened')]);
    expect(send.mock.calls[0]?.[0].map((event) => event.name)).toEqual([OUTBOX_CHECK_EVENT]);

    const failing = vi.fn(() => Promise.reject(new Error('inngest is down')));
    expect(await receiveWebhook({ body, headers, secret: SECRET, send, sendBoard: failing, forward: forwarding() })).toEqual({ status: 502, body: 'could not send the event: inngest is down' });
    const bad = vi.fn(() => Promise.resolve());
    expect((await receiveWebhook({ body, headers: { ...headers, 'x-hub-signature-256': sign(body, 'another') }, secret: SECRET, send, sendBoard: bad, forward: forwarding() })).status).toBe(401);
    expect(bad).not.toHaveBeenCalled();
  });

  it('a pull request typed by hand hands the fleet board nothing', async () => {
    const body = JSON.stringify(loopPull('opened', { body: 'by hand' }));
    const sendBoard = vi.fn(() => Promise.resolve());
    const response = await receiveWebhook({ body, headers: { 'x-github-event': 'pull_request', 'x-hub-signature-256': sign(body) }, secret: SECRET, send: sending(), sendBoard, forward: forwarding() });
    expect(response).toEqual({ status: 200, body: 'sent 1' });
    expect(sendBoard).not.toHaveBeenCalled();
  });
});
