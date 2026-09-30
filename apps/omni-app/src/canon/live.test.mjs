// The canon gate's live ports, against a recording fetch: nothing here calls Supabase or OpenRouter.
import { describe, expect, it } from 'vitest';
import { CANON_MODEL, businessReader, canonFromEnv } from './live.mjs';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function recordingFetch(answer) {
  const requests = [];
  const fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    requests.push({ url, method: init.method ?? 'GET', body: init.body ? JSON.parse(init.body) : null, headers: new Headers(init.headers) });
    return answer(url);
  };
  return { fetch, requests };
}

const BUSINESS = {
  state: 'ok',
  business: { name: 'Vertuoza' },
  product: null,
  claims: [{ id: 'never#4', kind: 'never', value: 'Never: build for groups of companies', source: 'pick', state: 'confirmed' }],
  personas: [{ name: 'Marc', stance: 'skeptic', trade: 'plumbing', who: 'runs five plumbers', usage: 'phone' }],
  updatedAt: '2026-09-30T10:00:00Z',
};

describe('businessReader — the service-role read by repository', () => {
  it('calls business_for_repo_app with the repository, as the service role', async () => {
    const db = recordingFetch(() => json(BUSINESS));
    const read = businessReader({ url: 'https://db.example', key: 'service-key', fetch: db.fetch });
    expect(await read('acme/widgets')).toEqual(BUSINESS);
    const [request] = db.requests;
    expect([request.method, request.url.pathname]).toEqual(['POST', '/rest/v1/rpc/business_for_repo_app']);
    expect(request.body).toEqual({ p_repo: 'acme/widgets' });
    expect(request.headers.get('apikey')).toBe('service-key');
  });

  it('throws when the database refuses', async () => {
    const db = recordingFetch(() => json({ message: 'permission denied', code: '42501' }, 403));
    const read = businessReader({ url: 'https://db.example', key: 'service-key', fetch: db.fetch });
    await expect(read('acme/widgets')).rejects.toThrow(/permission denied/);
  });
});

describe('canonFromEnv — the gate bound to the environment', () => {
  it('without SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY it is neutral and asks nothing', async () => {
    const calls = recordingFetch(() => json({}));
    const canon = canonFromEnv({ OPENROUTER_API_KEY: 'k' }, { fetch: calls.fetch });
    const gate = await canon.grade({ repo: 'acme/widgets', spec: 'x' });
    expect(gate).toMatchObject({ neutral: true, reason: 'no business: the App cannot read businesses here' });
    expect(calls.requests).toEqual([]);
  });

  it('without OPENROUTER_API_KEY it is neutral, "model not configured"', async () => {
    const calls = recordingFetch(() => json(BUSINESS));
    const canon = canonFromEnv({ SUPABASE_URL: 'https://db.example', SUPABASE_SERVICE_ROLE_KEY: 's' }, { fetch: calls.fetch });
    const gate = await canon.grade({ repo: 'acme/widgets', spec: 'We build for groups of companies.' });
    expect(gate).toMatchObject({ neutral: true, reason: 'model not configured (OPENROUTER_API_KEY is not set)' });
  });

  it('asks the small model through OpenRouter, whatever OPENROUTER_MODEL names', async () => {
    const reply = { findings: [{ quote: 'for groups of companies', claims: ['never#4'], why: 'a group' }], persona: { name: 'Marc', line: 'Not me.' } };
    const calls = recordingFetch((url) =>
      url.hostname === 'openrouter.ai' ? json({ choices: [{ message: { content: JSON.stringify(reply) } }] }) : json(BUSINESS),
    );
    const env = { SUPABASE_URL: 'https://db.example', SUPABASE_SERVICE_ROLE_KEY: 's', OPENROUTER_API_KEY: 'k', OPENROUTER_MODEL: 'anthropic/claude-opus-5.5' };
    const gate = await canonFromEnv(env, { fetch: calls.fetch }).grade({ repo: 'acme/widgets', spec: 'We build for groups of companies.' });
    expect(gate).toMatchObject({ ok: false, reason: 'canon ✗ 1' });
    const model = calls.requests.find((request) => request.url.hostname === 'openrouter.ai');
    expect(model.body.model).toBe(CANON_MODEL);
    expect(model.headers.get('authorization')).toBe('Bearer k');
  });
});
