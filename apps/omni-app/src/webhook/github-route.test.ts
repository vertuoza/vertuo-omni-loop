import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { assertDefined } from 'vertuo-omni-plan/kit/test/assert.ts';
import { inngest, OUTBOX_CHECK_EVENT } from '../inngest-client.ts';
import { GET, POST } from '../../api/github.ts';

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
    vi.stubEnv('GITHUB_WEBHOOK_SECRET', SECRET);
    send = stubbedSend();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
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
    vi.stubEnv('GITHUB_WEBHOOK_SECRET', '');
    const response = await POST(request({ 'x-hub-signature-256': sign(body) }));
    expect(response.status).toBe(500);
    expect(send).not.toHaveBeenCalled();
  });

  it('forwards a stage event to GALAXY_URL, signed with STAGE_EVENT_SECRET (PRD 587)', async () => {
    vi.stubEnv('STAGE_EVENT_SECRET', 'stage-secret');
    vi.stubEnv('GALAXY_URL', 'https://galaxy.example');
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
    const response = await POST(new Request('https://omni-loop.example/api/github', {
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
    const response = GET();
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('POST');
  });
});
