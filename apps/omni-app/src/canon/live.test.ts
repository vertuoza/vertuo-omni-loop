// The canon gate's live ports, against a recording fetch: nothing here calls Supabase or OpenRouter.
import { describe, expect, it } from 'vitest';
import { CANON_MODEL, businessReader, canonFromEnv, constituentsReader } from './live.ts';

type Recorded = { url: URL; method: string; body: { model?: string } | null; headers: Headers };

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function recordingFetch(answer: (url: URL) => Response) {
  const requests: Recorded[] = [];
  const fetch: typeof globalThis.fetch = async (input, init = {}) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    requests.push({ url, method: init.method ?? 'GET', body: init.body ? JSON.parse(String(init.body)) : null, headers: new Headers(init.headers) });
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
    const request = db.requests[0]!;
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
    expect(model?.body?.model).toBe(CANON_MODEL);
    expect(model?.headers.get('authorization')).toBe('Bearer k');
  });
});

// ── PRD 871: the constituents read and the judge ──

const CONSTITUENTS = {
  state: 'ok',
  product: { name: 'Vertuoza UX' },
  statement: { id: 'statement', text: 'The component workshop, shown with fixtures.' },
  never: [{ id: 'never#1', text: 'Calls real Vertuoza data or real Vertuoza APIs' }],
  latestEventId: '7',
};
const API_SPEC = "The list loads with fetch('/api/v1/projects') and shows each project.";
const API_BREAK = { findings: [{ quote: "fetch('/api/v1/projects')", claims: ['never#1'], why: 'a real API' }], persona: { name: '', line: '' } };

/** Supabase, OpenRouter and galaxy's judge route, each answering as given. */
const world = ({ judge = () => json({ answer: 'true', confidence: null, decidedBy: 'old' }) } = {}) =>
  recordingFetch((url) => {
    if (url.hostname === 'openrouter.ai') return json({ choices: [{ message: { content: JSON.stringify(API_BREAK) } }] });
    if (url.pathname === '/api/constituents/judge') return judge();
    if (url.pathname.endsWith('/constituents_for_repo_app')) return json(CONSTITUENTS);
    return json({ ...BUSINESS, claims: [], personas: [] });
  });

const ENV = { SUPABASE_URL: 'https://db.example', SUPABASE_SERVICE_ROLE_KEY: 's', OPENROUTER_API_KEY: 'k', GALAXY_URL: 'https://galaxy.example' };

describe('constituentsReader — the service-role read by repository', () => {
  it('calls constituents_for_repo_app with the repository', async () => {
    const db = recordingFetch(() => json(CONSTITUENTS));
    const read = constituentsReader({ url: 'https://db.example', key: 'service-key', fetch: db.fetch });
    expect(await read('acme/ux')).toEqual(CONSTITUENTS);
    expect(db.requests[0]!.url.pathname).toBe('/rest/v1/rpc/constituents_for_repo_app');
    expect(db.requests[0]!.body).toEqual({ p_repo: 'acme/ux' });
  });
});

describe('canonFromEnv — the constituents judged through galaxy', () => {
  it('a spec quoting a real API call against never#1 is red, naming the quote and the line, judged on GALAXY_URL', async () => {
    const calls = world();
    const gate = await canonFromEnv({ ...ENV, CONSTITUENT_JUDGE_SECRET: 'j' }, { fetch: calls.fetch }).grade({ repo: 'acme/ux', spec: API_SPEC });
    expect(gate).toMatchObject({ ok: false, reason: 'canon ✗ 1' });
    expect(gate.details[0]).toBe(`never#1 "Calls real Vertuoza data or real Vertuoza APIs" — the spec: "fetch('/api/v1/projects')"`);
    const judged = calls.requests.find((request) => request.url.pathname === '/api/constituents/judge');
    expect(judged!.url.origin).toBe('https://galaxy.example');
    expect(judged!.headers.get('x-omni-signature-256')).toMatch(/^sha256=[0-9a-f]{64}$/);
    expect(judged!.body).toMatchObject({ repo: 'acme/ux', old: 'true' });
  });

  it('without CONSTITUENT_JUDGE_SECRET it is neutral, never red, and galaxy is not called', async () => {
    const calls = world();
    const gate = await canonFromEnv(ENV, { fetch: calls.fetch }).grade({ repo: 'acme/ux', spec: API_SPEC });
    expect(gate).toMatchObject({ ok: true, neutral: true, reason: 'judge not configured (CONSTITUENT_JUDGE_SECRET is not set)' });
    expect(calls.requests.some((request) => request.url.pathname === '/api/constituents/judge')).toBe(false);
  });

  it('a refused judge call (no Jev key, a Jev error) is neutral, never red', async () => {
    const calls = world({ judge: () => json({ error: 'The workspace of this repository could not be looked up. Try again.' }, 500) });
    const gate = await canonFromEnv({ ...ENV, CONSTITUENT_JUDGE_SECRET: 'j' }, { fetch: calls.fetch }).grade({ repo: 'acme/ux', spec: API_SPEC });
    expect(gate).toMatchObject({ ok: true, neutral: true });
    expect(gate.reason).toMatch(/^judge error: galaxy answered 500/);
  });
});
