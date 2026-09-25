import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { functions, GET, POST, PUT } from '../../api/inngest.mjs';
import { FUNCTION_ID, outboxCheck } from './outbox-check.mjs';

describe('/api/inngest', () => {
  beforeEach(() => {
    vi.stubEnv('INNGEST_DEV', '1');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('serves the outbox-check function, and nothing else', () => {
    expect(functions).toEqual([outboxCheck]);
    expect(outboxCheck.id()).toBe(FUNCTION_ID);
  });

  it('answers GET, POST and PUT — the three verbs Inngest calls', () => {
    for (const verb of [GET, POST, PUT]) expect(typeof verb).toBe('function');
  });

  it('describes the app on GET in dev mode', async () => {
    const response = await GET(new Request('https://omni-loop.example/api/inngest', { headers: { host: 'omni-loop.example' } }));
    expect(response.status).toBe(200);
    const body = await response.json();
    // Inngest registers the failure handler as a function of its own, beside outbox-check.
    expect(body.function_count).toBe(2);
  });
});
