import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { inngest, OUTBOX_CHECK_EVENT } from '../inngest-client.mjs';
import { GET, POST } from '../../api/github.mjs';

const SECRET = 'route-secret';
const sign = (body) => `sha256=${createHmac('sha256', SECRET).update(body).digest('hex')}`;

const body = JSON.stringify({
  action: 'synchronize',
  installation: { id: 7 },
  repository: { name: 'r', full_name: 'o/r', owner: { login: 'o' } },
  pull_request: { number: 3, head: { sha: 'def456' }, base: { ref: 'main' } },
});

const request = (headers) =>
  new Request('https://omni-loop.example/api/github', {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/json', 'x-github-event': 'pull_request', ...headers },
  });

describe('/api/github', () => {
  let send;
  beforeEach(() => {
    vi.stubEnv('GITHUB_WEBHOOK_SECRET', SECRET);
    send = vi.spyOn(inngest, 'send').mockResolvedValue({ ids: ['e1'] });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('sends one event on the app’s Inngest client for a signed, handled delivery', async () => {
    const response = await POST(request({ 'x-hub-signature-256': sign(body) }));
    expect(response.status).toBe(200);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toMatchObject([{ name: OUTBOX_CHECK_EVENT, data: { repository: 'o/r', prNumber: 3 } }]);
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

  it('answers 405 to anything but POST', async () => {
    const response = await GET();
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('POST');
  });
});
