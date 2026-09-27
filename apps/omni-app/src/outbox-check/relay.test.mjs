// The outbox-check function's relay (PRD 251), against a stubbed GitHub and a stubbed Omni page: a
// comment re-checks the pull request, the outbox the check read is sent signed after it is published,
// nothing is sent with the switch off or to another host, a failed send never changes the check, and
// a closed pull request gets its last send and no check.
import { createHmac } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { InngestTestEngine, mockCtx } from '@inngest/test';
import { describe, expect, it } from 'vitest';
import { inngest, OUTBOX_CHECK_EVENT } from '../inngest-client.mjs';
import { LAST_SEND_TRIGGER } from '../webhook/webhook.mjs';
import { fakeGitHub } from './fake-github.mjs';
import { createFailureHandler, createOutboxCheck } from './outbox-check.mjs';

const FIXTURES = fileURLToPath(new URL('../../test/fixtures/', import.meta.url));
const fixture = (name) => join(FIXTURES, name);
const SECRET = 'relay-secret';
const NOW = '2026-09-27T10:00:00.000Z';

const event = (over = {}) => ({
  name: OUTBOX_CHECK_EVENT,
  data: {
    installationId: 7,
    owner: 'acme',
    repo: 'widgets',
    repository: 'acme/widgets',
    prNumber: 12,
    headSha: 'head1',
    trigger: 'pull_request.synchronize',
    ...over,
  },
});

function github({ base = 'base-answers', comments = [] } = {}) {
  return fakeGitHub({
    commits: { base1: fixture(base), head1: fixture('head-answers') },
    pull: { number: 12, base: { ref: 'main', sha: 'base1' }, head: { ref: 'feat/widget', sha: 'head1' } },
    comments,
  });
}

/** A stubbed page: records each send, answers with `status`. */
function page(status = 200) {
  const sends = [];
  const fetch = async (url, init) => {
    sends.push({ url, headers: init.headers, raw: init.body, body: JSON.parse(init.body) });
    return status === 200
      ? new Response(JSON.stringify({ id: 'd1', url: 'https://omni.example/prd/d1?tab=outbox' }), { status })
      : new Response('{"error":"down"}', { status });
  };
  return { sends, fetch };
}

async function run(gh, stub, e = event(), pageUrl = 'https://omni.example', transformCtx = undefined) {
  const fn = createOutboxCheck({
    client: inngest,
    octokitFor: () => gh.octokit,
    relay: () => ({ pageUrl, secret: SECRET, fetch: stub.fetch, now: () => NOW }),
  });
  return new InngestTestEngine({ function: fn, events: [e], ...(transformCtx ? { transformCtx } : {}) }).execute();
}

/** The step "relay" as Inngest hands it back once its retries are spent: `step.run` rejects. */
function relaySpent(rawCtx) {
  const ctx = mockCtx(rawCtx);
  const run = ctx.step.run;
  ctx.step.run = (id, fn) => (id === 'relay' ? Promise.reject(new Error('the page answered 503: down')) : run(id, fn));
  return ctx;
}

const stepIds = (ctx) => ctx.step.run.mock.calls.map(([id]) => id);

describe('outbox-check — the relay to the Omni page', () => {
  it('sends the outbox after the check and the comment are published, signed with the secret', async () => {
    const gh = github();
    const stub = page();
    const { ctx, result } = await run(gh, stub);

    expect(stepIds(ctx)).toEqual(['in-progress', 'evaluate', 'publish', 'relay']);
    expect(result).toMatchObject({ conclusion: 'failure', comment: 'created', relay: { sent: true, status: 200 } });
    expect(stub.sends).toHaveLength(1);
    const [send] = stub.sends;
    expect(send.url).toBe('https://omni.example/api/outbox');
    expect(send.headers['x-omni-signature']).toBe(`sha256=${createHmac('sha256', SECRET).update(send.raw).digest('hex')}`);
    expect(send.body).toMatchObject({
      repo: 'acme/widgets',
      prd: 42,
      pr: { number: 12, url: 'https://github.com/acme/widgets/pull/12', headSha: 'head1', state: 'open' },
      evaluatedAt: NOW,
    });
    expect(send.body.open.map((item) => [item.number, item.id])).toEqual([
      [1, 's1-02-widget-key'],
      [2, 's1-01-widget-colour'],
    ]);
    expect(send.body.adopted.map((item) => [item.number, item.id])).toEqual([[3, 's1-03-widget-size']]);
    expect(send.body.settled.map((entry) => [entry.id, entry.verdict])).toEqual([['s1-00-widget-name', 'agreed']]);
    // The numbering sent is the one the comment just published carries.
    expect(gh.state.comments[0].body).toContain(`2=s1-01-widget-colour@${NOW}`);
  });

  it('sends what the replies say as pending, read from the comments the check read', async () => {
    const first = github();
    await run(first, page());
    const outboxComment = { ...first.state.comments[0], user: { login: 'omni-loop[bot]' }, author_association: 'NONE', created_at: '2026-09-27T09:00:00Z' };
    const answer = {
      id: 50,
      body: '2: B because red is the brand',
      user: { login: 'ada' },
      author_association: 'MEMBER',
      created_at: '2026-09-27T09:30:00Z',
      html_url: 'https://github.com/acme/widgets/pull/12#issuecomment-50',
    };
    const stub = page();
    await run(github({ comments: [outboxComment, answer] }), stub);
    expect(stub.sends[0].body.pending).toEqual([
      {
        number: 2,
        id: 's1-01-widget-colour',
        text: 'B because red is the brand',
        by: 'ada',
        at: '2026-09-27T09:30:00Z',
        url: answer.html_url,
        via: 'github',
      },
    ]);
  });

  it('checks the pull request’s own head when a comment started the run', async () => {
    const gh = github();
    const stub = page();
    const { result } = await run(gh, stub, event({ headSha: null, trigger: 'issue_comment.created' }));
    expect(result).toMatchObject({ conclusion: 'failure', relay: { sent: true } });
    expect(gh.state.checkRuns).toHaveLength(1);
    expect(gh.state.checkRuns[0]).toMatchObject({ head_sha: 'head1', status: 'completed' });
    expect(stub.sends[0].body.pr.headSha).toBe('head1');
  });

  it('sends nothing with the switch off', async () => {
    const stub = page();
    const { ctx, result } = await run(github({ base: 'base-answers-off' }), stub);
    expect(stepIds(ctx)).toEqual(['in-progress', 'evaluate', 'publish']);
    expect(result.relay).toBeUndefined();
    expect(stub.sends).toEqual([]);
  });

  it('sends nothing when ask.url names another host, when the repository names none, or the App has no page', async () => {
    for (const [base, pageUrl] of [
      ['base-answers-elsewhere', 'https://omni.example'],
      ['base-active', 'https://omni.example'],
      ['base-answers', null],
    ]) {
      const stub = page();
      const { ctx } = await run(github({ base }), stub, event(), pageUrl);
      expect(stepIds(ctx), base).toEqual(['in-progress', 'evaluate', 'publish']);
      expect(stub.sends, base).toEqual([]);
    }
  });

  it('retries a send the page refuses as a step, with the check and the comment already published', async () => {
    const gh = github();
    const { error } = await run(gh, page(503));
    expect(error?.message).toContain('the page answered 503');
    expect(gh.state.checkRuns).toHaveLength(1);
    expect(gh.state.checkRuns[0]).toMatchObject({ status: 'completed', conclusion: 'failure', output: { title: '2 open outbox items' } });
    expect(gh.state.comments).toHaveLength(1);
  });

  it('logs a send that still fails after its retries, and ends as the check concluded', async () => {
    const gh = github();
    const { result, error } = await run(gh, page(), event(), 'https://omni.example', relaySpent);
    expect(error).toBeUndefined();
    expect(result).toMatchObject({ conclusion: 'failure', comment: 'created', relay: { sent: false, error: expect.stringContaining('503') } });
    expect(gh.state.checkRuns).toHaveLength(1);
    expect(gh.state.checkRuns[0]).toMatchObject({ conclusion: 'failure', output: { title: '2 open outbox items' } });
    expect(gh.state.comments).toHaveLength(1);
  });

  it('gives a merged pull request its last send with `merged`, and writes no check and no comment', async () => {
    const gh = github();
    const stub = page();
    const { ctx, result } = await run(gh, stub, event({ trigger: LAST_SEND_TRIGGER, state: 'merged' }));
    expect(stepIds(ctx)).toEqual(['evaluate', 'relay']);
    expect(result).toMatchObject({ relay: { sent: true } });
    expect(stub.sends[0].body.pr).toMatchObject({ number: 12, state: 'merged' });
    expect(gh.state.checkRuns).toEqual([]);
    expect(gh.state.comments).toEqual([]);
    expect(gh.state.requests.filter((r) => r.route.startsWith('POST') || r.route.startsWith('PATCH'))).toEqual([]);
  });

  it('gives a closed pull request its last send with `closed`', async () => {
    const stub = page();
    await run(github(), stub, event({ trigger: LAST_SEND_TRIGGER, state: 'closed' }));
    expect(stub.sends[0].body.pr.state).toBe('closed');
  });

  it('reads nothing of GitHub for a last send when the App has no page', async () => {
    const gh = github();
    const { result } = await run(gh, page(), event({ trigger: LAST_SEND_TRIGGER, state: 'merged' }), null);
    expect(result).toEqual({ relay: 'off' });
    expect(gh.state.requests).toEqual([]);
  });
});

describe('outbox-check — the failure handler, for the runs PRD 251 adds', () => {
  const failed = (data) => ({ name: 'inngest/function.failed', data: { event: event(data), error: { message: 'boom' } } });

  it('fails the check on the pull request’s head when a comment started the run', async () => {
    const gh = github();
    const handler = createFailureHandler({ octokitFor: () => gh.octokit });
    await handler({ event: failed({ headSha: null, trigger: 'issue_comment.created' }), error: new Error('boom') });
    expect(gh.state.checkRuns).toHaveLength(1);
    expect(gh.state.checkRuns[0]).toMatchObject({ head_sha: 'head1', conclusion: 'failure' });
  });

  it('writes nothing when a last send failed: it made no check', async () => {
    const gh = github();
    const handler = createFailureHandler({ octokitFor: () => gh.octokit });
    const outcome = await handler({ event: failed({ trigger: LAST_SEND_TRIGGER, state: 'merged' }), error: new Error('boom') });
    expect(outcome.checkRunIds).toEqual([]);
    expect(gh.state.requests).toEqual([]);
  });
});
