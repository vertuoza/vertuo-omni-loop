import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { assertDefined } from 'omni-loop/kit/test/assert.ts';
import { inngest, OUTBOX_CHECK_EVENT } from '../inngest-client.ts';
import { EnvError, readEnv } from '../env.ts';
import { capture, throwing } from '../run-log/capture.ts';
import { githubRoute } from './github-route.ts';
import { FLEET_BOARD_EVENT } from '../fleet-board/events.ts';
import { SIGNED_MARKER } from 'omni-loop/kit/lib/signature.ts';

/** `/api/github`'s handlers over `source`, as the route reads the process's environment. */
const route = (source: Record<string, string> = { GITHUB_WEBHOOK_SECRET: 'route-secret' }) => githubRoute(readEnv(source));
const POST = (request: Request) => route().POST(request);

const SECRET = 'route-secret';
const sign = (body: string) => `sha256=${createHmac('sha256', SECRET).update(body).digest('hex')}`;

const body = JSON.stringify({
  action: 'synchronize',
  installation: { id: 7 },
  repository: { name: 'r', full_name: 'o/r', owner: { login: 'o' } },
  pull_request: { number: 3, head: { sha: 'def456' }, base: { ref: 'main' } },
});

const request = (headers: Record<string, string>) =>
  new Request('https://omni-loop.example/api/github', {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/json', 'x-github-event': 'pull_request', ...headers },
  });

/** Inngest's send, stubbed to take every event. */
const stubbedSend = () => vi.spyOn(inngest, 'send').mockResolvedValue({ ids: ['e1'] });

/** What the stage event's POST carried, as the test reads it. */
const StagePostSchema = z.looseObject({ body: z.string(), headers: z.record(z.string(), z.string()) });

describe('/api/github', () => {
  let send: ReturnType<typeof stubbedSend>;
  beforeEach(() => {
    send = stubbedSend();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends one event on the app’s Inngest client for a signed, handled delivery', async () => {
    const response = await POST(request({ 'x-hub-signature-256': sign(body) }));
    expect(response.status).toBe(200);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0]).toMatchObject([{ name: OUTBOX_CHECK_EVENT, data: { repository: 'o/r', prNumber: 3 } }]);
  });

  it('sends a loop pull request’s fleet board event on the app’s Inngest client, beside its check event (PRD 2530)', async () => {
    const opened = JSON.stringify({
      action: 'opened',
      installation: { id: 7 },
      repository: { name: 'r', full_name: 'o/r', owner: { login: 'o' }, default_branch: 'main' },
      pull_request: {
        number: 3,
        node_id: 'PR_3',
        html_url: 'https://github.com/o/r/pull/3',
        state: 'open',
        user: { login: 'ada' },
        body: `Closes #9\n\n${SIGNED_MARKER}`,
        updated_at: '2026-10-27T10:00:00Z',
        head: { sha: 'def456' },
        base: { ref: 'main' },
      },
    });
    const response = await POST(new Request('https://omni-loop.example/api/github', { method: 'POST', body: opened, headers: { 'x-github-event': 'pull_request', 'x-hub-signature-256': sign(opened) } }));
    expect(response.status).toBe(200);
    expect(send.mock.calls.map((call) => call[0])).toMatchObject([[{ name: OUTBOX_CHECK_EVENT }], [{ name: FLEET_BOARD_EVENT, data: { repository: 'o/r', prNumber: 3, author: 'ada' } }]]);
  });

  it('answers 401 to a bad signature and creates no event', async () => {
    const response = await POST(request({ 'x-hub-signature-256': 'sha256=' + '0'.repeat(64) }));
    expect(response.status).toBe(401);
    expect(send).not.toHaveBeenCalled();
  });

  it('reads the secret from GITHUB_WEBHOOK_SECRET, failing closed when it is unset', async () => {
    const response = await route({}).POST(request({ 'x-hub-signature-256': sign(body) }));
    expect(response.status).toBe(500);
    expect(send).not.toHaveBeenCalled();
  });

  it('forwards a stage event to GALAXY_URL, signed with STAGE_EVENT_SECRET (PRD 587)', async () => {
    const post = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok', { status: 200 }));
    const merged = JSON.stringify({
      action: 'closed',
      installation: { id: 7 },
      repository: { name: 'r', full_name: 'o/r', owner: { login: 'o' }, default_branch: 'main' },
      pull_request: {
        number: 4, merged: true, merge_commit_sha: 'm', merged_at: '2026-09-29T10:00:00Z',
        head: { sha: 'h', ref: 'docs/phase-0-x' }, base: { ref: 'main' }, body: 'Refs #9',
      },
    });
    const stageRoute = route({ GITHUB_WEBHOOK_SECRET: SECRET, STAGE_EVENT_SECRET: 'stage-secret', GALAXY_URL: 'https://galaxy.example' });
    const response = await stageRoute.POST(new Request('https://omni-loop.example/api/github', {
      method: 'POST',
      body: merged,
      headers: { 'x-github-event': 'pull_request', 'x-hub-signature-256': sign(merged) },
    }));
    expect(response.status).toBe(200);
    expect(post.mock.calls.map(([url]) => url)).toEqual(['https://galaxy.example/api/stages/event', 'https://galaxy.example/api/github/touched']);
    const [stageCall, touchCall] = post.mock.calls;
    assertDefined(stageCall, 'the stage event POST');
    const init = StagePostSchema.parse(stageCall[1]);
    expect(JSON.parse(init.body)).toEqual({ repository: 'o/r', topic: 'x', prd: 9, stage: 'inbox', at: '2026-09-29T10:00:00Z' });
    expect(init.headers['x-omni-signature-256']).toBe(`sha256=${createHmac('sha256', 'stage-secret').update(init.body).digest('hex')}`);
    // PRD 902 (s3): the same pull request is a touch, POSTed to /api/github/touched, signed the same way.
    assertDefined(touchCall, 'the touch POST');
    const touch = StagePostSchema.parse(touchCall[1]);
    expect(JSON.parse(touch.body)).toEqual({ repository: 'o/r', pr: 4, branch: 'docs/phase-0-x' });
    expect(touch.headers['x-omni-signature-256']).toBe(`sha256=${createHmac('sha256', 'stage-secret').update(touch.body).digest('hex')}`);
  });

  it('forwards a touch for an event that becomes no Inngest event, an issue comment (PRD 902)', async () => {
    const post = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok', { status: 200 }));
    const comment = JSON.stringify({ action: 'created', installation: { id: 7 }, repository: { name: 'r', full_name: 'o/r', owner: { login: 'o' } }, issue: { number: 9 } });
    const touchRoute = route({ GITHUB_WEBHOOK_SECRET: SECRET, STAGE_EVENT_SECRET: 'stage-secret', GALAXY_URL: 'https://galaxy.example' });
    const response = await touchRoute.POST(new Request('https://omni-loop.example/api/github', {
      method: 'POST',
      body: comment,
      headers: { 'x-github-event': 'issue_comment', 'x-hub-signature-256': sign(comment) },
    }));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('ignored');
    expect(send).not.toHaveBeenCalled();
    expect(post).toHaveBeenCalledTimes(1);
    const call = post.mock.calls[0];
    assertDefined(call, 'the touch POST');
    expect(call[0]).toBe('https://galaxy.example/api/github/touched');
    expect(JSON.parse(StagePostSchema.parse(call[1]).body)).toEqual({ repository: 'o/r', issue: 9 });
  });

  it('answers 405 to anything but POST', async () => {
    const response = await route().GET(new Request('https://omni-loop.example/api/github'));
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('POST');
  });
});

describe('/api/github — one webhook line per delivery (PRD 1723 s6)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const delivered = (headers: Record<string, string>) =>
    new Request('https://omni-loop.example/api/github', {
      method: 'POST',
      body,
      headers: { 'x-github-event': 'pull_request', 'x-github-delivery': 'del-42', ...headers },
    });
  const logged = (send: () => Promise<unknown>) => {
    const log = capture();
    return { log, route: githubRoute(readEnv({ GITHUB_WEBHOOK_SECRET: SECRET }), { send, logger: log.logger }) };
  };

  it('logs ok with the delivery id, the repository and the GitHub event', async () => {
    const { log, route: logRoute } = logged(() => Promise.resolve());
    const response = await logRoute.POST(delivered({ 'x-hub-signature-256': sign(body) }));
    expect(response.status).toBe(200);
    expect(log.lines()).toEqual([
      { level: 'info', event: 'webhook', outcome: 'ok', ms: 0, deliveryId: 'del-42', fn: 'pull_request', repo: 'o/r', status: 200 },
    ]);
  });

  it('logs refused on a bad signature, naming no repository', async () => {
    const { log, route: logRoute } = logged(() => Promise.resolve());
    const response = await logRoute.POST(delivered({ 'x-hub-signature-256': 'sha256=' + '0'.repeat(64) }));
    expect(response.status).toBe(401);
    expect(log.lines()).toEqual([{ level: 'warn', event: 'webhook', outcome: 'refused', ms: 0, deliveryId: 'del-42', fn: 'pull_request', status: 401 }]);
  });

  it('logs refused on a GET, 405', async () => {
    const { log, route: logRoute } = logged(() => Promise.resolve());
    expect((await logRoute.GET(new Request('https://omni-loop.example/api/github'))).status).toBe(405);
    expect(log.lines()).toEqual([{ level: 'warn', event: 'webhook', outcome: 'refused', ms: 0, status: 405 }]);
  });

  it('logs failed on a thrown error, and rethrows the very error', async () => {
    const { log, route: logRoute } = logged(() => Promise.resolve());
    const thrown = new Error('the body could not be read');
    const request = delivered({ 'x-hub-signature-256': sign(body) });
    vi.spyOn(request, 'text').mockRejectedValue(thrown);
    await expect(logRoute.POST(request)).rejects.toBe(thrown);
    expect(log.lines()).toEqual([
      { level: 'error', event: 'webhook', outcome: 'failed', ms: 0, deliveryId: 'del-42', fn: 'pull_request', error: { name: 'Error', message: 'the body could not be read' } },
    ]);
  });

  it('logs failed when the event could not be sent on, 502', async () => {
    const { log, route: logRoute } = logged(() => Promise.reject(new Error('inngest is down')));
    expect((await logRoute.POST(delivered({ 'x-hub-signature-256': sign(body) }))).status).toBe(502);
    expect(log.lines()).toEqual([expect.objectContaining({ level: 'error', outcome: 'failed', status: 502, repo: 'o/r' })]);
  });

  it('answers the same when the logger throws', async () => {
    const route = githubRoute(readEnv({ GITHUB_WEBHOOK_SECRET: SECRET }), { send: () => Promise.resolve(), logger: throwing });
    expect((await route.POST(delivered({ 'x-hub-signature-256': sign(body) }))).status).toBe(200);
    expect((await route.GET(new Request('https://omni-loop.example/api/github'))).status).toBe(405);
  });
});

describe('/api/github — the environment, read when the route loads (PRD 1059)', () => {
  afterEach(() => {
    vi.doUnmock('../env.ts');
    vi.resetModules();
  });

  /** The route, loaded afresh over `source` in place of the process's environment. */
  async function loadOver(source: Record<string, string>) {
    vi.resetModules();
    vi.doMock('../env.ts', async (importOriginal) => ({ ...(await importOriginal<object>()), processEnv: () => source }));
    return import('../../entries/github.ts');
  }

  it('fails to load in production without the webhook secret and the GitHub App, naming them and never a value', async () => {
    const loading = loadOver({ VERCEL_ENV: 'production', GITHUB_APP_ID: 'not-a-number', GITHUB_APP_PRIVATE_KEY: 'pem-secret' });
    // A fresh load has its own EnvError class: the error is told by its name.
    await expect(loading).rejects.toMatchObject({ name: new EnvError([]).name });
    await expect(loading).rejects.toThrow('GITHUB_WEBHOOK_SECRET must be set in production (the webhook secret); GITHUB_APP_ID is not valid: must be a number');
    await expect(loading).rejects.not.toThrow(/not-a-number|pem-secret/);
  });

  it('loads in production with the secret and the GitHub App set, and verifies with that secret', async () => {
    const { POST: post } = await loadOver({ VERCEL_ENV: 'production', GITHUB_WEBHOOK_SECRET: SECRET, GITHUB_APP_ID: '1', GITHUB_APP_PRIVATE_KEY: 'pem' });
    const ping = (signature: string) =>
      post(new Request('https://omni-loop.example/api/github', { method: 'POST', body, headers: { 'x-github-event': 'ping', 'x-hub-signature-256': signature } }));
    expect(await (await ping(sign(body))).text()).toBe('ignored');
    expect((await ping('sha256=' + '0'.repeat(64))).status).toBe(401);
  });
});
