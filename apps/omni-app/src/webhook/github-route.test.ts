import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { assertDefined } from 'vertuo-omni-plan/kit/test/assert.ts';
import { inngest, OUTBOX_CHECK_EVENT } from '../inngest-client.ts';
import { EnvError, readEnv } from '../env.ts';
import { githubRoute } from './github-route.ts';

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
    expect(post).toHaveBeenCalledTimes(1);
    const call = post.mock.calls[0];
    assertDefined(call, 'the stage event POST');
    const [url, sent] = call;
    expect(url).toBe('https://galaxy.example/api/stages/event');
    const init = StagePostSchema.parse(sent);
    expect(JSON.parse(init.body)).toEqual({ repository: 'o/r', topic: 'x', prd: 9, stage: 'inbox', at: '2026-09-29T10:00:00Z' });
    expect(init.headers['x-omni-signature-256']).toBe(`sha256=${createHmac('sha256', 'stage-secret').update(init.body).digest('hex')}`);
  });

  it('answers 405 to anything but POST', () => {
    const response = route().GET();
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('POST');
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
    return import('../../api/github.ts');
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
