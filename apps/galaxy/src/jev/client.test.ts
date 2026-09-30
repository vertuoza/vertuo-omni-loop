import { describe, expect, it } from 'vitest';
import { JEV_MODEL, JEV_TIMEOUT_MS, JEV_URL, askJev, type JevQuestion } from './client';

// The Jev client (PRD 812 s1, decisions 6 and 8): one POST to TypeSafe's systemone endpoint with the
// pinned model, a 5 s timeout and no retry. Every failure is an outcome, never a throw.

const KEY = 'ts_live_0123456789abcdef1a2b';

const CHOICE: JevQuestion = {
  type: 'choice',
  instructions: 'Which category does this question belong to?',
  options: [{ key: 'business', description: 'pricing, customers' }, { key: 'product', description: 'scope, features' }],
};
const SCORE: JevQuestion = {
  type: 'score',
  instructions: 'How risky is this bug?',
  levels: [{ key: 'low', description: 'cosmetic' }, { key: 'medium', description: 'annoying' }, { key: 'high', description: 'data at risk' }],
};
const NOUL: JevQuestion = { type: 'noul', statement: 'This decision is hard to revert.' };

type Call = { url: string; init: RequestInit; body: Record<string, unknown> };

function stub(...replies: Array<Response | (() => Promise<Response>)>) {
  const calls: Call[] = [];
  const fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init, body: JSON.parse(String(init.body)) });
    const next = replies[Math.min(calls.length - 1, replies.length - 1)];
    return typeof next === 'function' ? next() : next;
  }) as unknown as typeof globalThis.fetch;
  return { fetch, calls };
}

const ok = (body: unknown) => Response.json(body, { status: 200 });

describe('the request', () => {
  it('posts the state and the question to systemone, with the key as bearer and the pinned model', async () => {
    const { fetch, calls } = stub(ok({ model: 'jev-1.13.0', answer: 'product', confidence: 0.9 }));
    await askJev({ key: KEY, state: { questions: ['What to build?'] }, question: CHOICE, fetch });
    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(JEV_URL).toBe('https://api.typesafe.ai/v1/systemone');
    expect(call.url).toBe(JEV_URL);
    expect(call.init.method).toBe('POST');
    const headers = new Headers(call.init.headers);
    expect(headers.get('authorization')).toBe(`Bearer ${KEY}`);
    expect(headers.get('content-type')).toBe('application/json');
    expect(JEV_MODEL).toBe('jev-1.13.0');
    expect(call.body.model).toBe('jev-1.13.0');
    expect(call.body.state).toEqual({ questions: ['What to build?'] });
    expect(call.body.question).toEqual({
      type: 'choice',
      instructions: 'Which category does this question belong to?',
      options: [{ key: 'business', description: 'pricing, customers' }, { key: 'product', description: 'scope, features' }],
    });
  });

  it('sends a score\'s levels and a noul\'s statement as their keys', async () => {
    const a = stub(ok({ model: 'jev-1.13.0', answer: 'low', confidence: 0.8 }));
    await askJev({ key: KEY, state: 'bug', question: SCORE, fetch: a.fetch });
    expect(a.calls[0].body.question).toEqual({ type: 'score', instructions: 'How risky is this bug?', levels: SCORE.type === 'score' ? SCORE.levels : [] });
    const b = stub(ok({ model: 'jev-1.13.0', answer: 0.7, confidence: 0.8 }));
    await askJev({ key: KEY, state: 'decision', question: NOUL, fetch: b.fetch });
    expect(b.calls[0].body.question).toEqual({ type: 'noul', statement: 'This decision is hard to revert.' });
  });

  it('masks every token in the state and the question before sending', async () => {
    const token = 'ghp_abcdefghijklmnopqrstuvwxyz0123456789';
    const { fetch, calls } = stub(ok({ model: 'jev-1.13.0', answer: 0.1, confidence: 0.5 }));
    await askJev({ key: KEY, state: { body: `leaked ${token}` }, question: { type: 'noul', statement: `uses ${token}` }, fetch });
    expect(String(calls[0].init.body)).not.toContain(token);
    expect(calls[0].body.state).toEqual({ body: 'leaked [masked]' });
  });

  it('waits 5 s at most by default', () => {
    expect(JEV_TIMEOUT_MS).toBe(5000);
  });
});

describe('each outcome', () => {
  it('a Choice: the option\'s key, the confidence and the model Jev reports', async () => {
    const { fetch } = stub(ok({ model: 'jev-1.13.0', answer: 'business', confidence: 0.82, probabilities: { business: 0.82, product: 0.18 } }));
    const out = await askJev({ key: KEY, state: 's', question: CHOICE, fetch });
    expect(out).toMatchObject({ kind: 'answered', model: 'jev-1.13.0', answer: 'business', confidence: 0.82 });
  });

  it('a Score: the level\'s key', async () => {
    const { fetch } = stub(ok({ model: 'jev-1.13.0', answer: 'high', confidence: 0.6 }));
    expect(await askJev({ key: KEY, state: 's', question: SCORE, fetch })).toMatchObject({ kind: 'answered', answer: 'high', confidence: 0.6 });
  });

  it('a Noul: how true the statement is, 0 to 1', async () => {
    const { fetch } = stub(ok({ model: 'jev-1.13.0', answer: 0.82, confidence: 0.9 }));
    expect(await askJev({ key: KEY, state: 's', question: NOUL, fetch })).toMatchObject({ kind: 'answered', answer: 0.82, confidence: 0.9 });
  });

  it('a non-200: failed, with TypeSafe\'s reason, and no retry', async () => {
    const { fetch, calls } = stub(Response.json({ error: { message: 'Invalid API key' } }, { status: 401 }));
    const out = await askJev({ key: KEY, state: 's', question: NOUL, fetch });
    expect(out).toMatchObject({ kind: 'failed', reason: 'status', status: 401, message: 'Invalid API key' });
    expect(calls).toHaveLength(1);
  });

  it('a non-200 with a plain-text body or no body still says something', async () => {
    const a = await askJev({ key: KEY, state: 's', question: NOUL, fetch: stub(new Response('quota exceeded', { status: 429 })).fetch });
    expect(a).toMatchObject({ kind: 'failed', reason: 'status', status: 429, message: 'quota exceeded' });
    const b = await askJev({ key: KEY, state: 's', question: NOUL, fetch: stub(new Response('', { status: 503 })).fetch });
    expect(b).toMatchObject({ kind: 'failed', reason: 'status', status: 503, message: 'TypeSafe answered 503.' });
  });

  it('a timeout: failed, once the time is up', async () => {
    const fetch = ((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    })) as unknown as typeof globalThis.fetch;
    const out = await askJev({ key: KEY, state: 's', question: NOUL, fetch, timeoutMs: 20 });
    expect(out).toMatchObject({ kind: 'failed', reason: 'timeout' });
  });

  it('a network error: failed', async () => {
    const fetch = (async () => { throw new TypeError('fetch failed'); }) as unknown as typeof globalThis.fetch;
    expect(await askJev({ key: KEY, state: 's', question: NOUL, fetch })).toMatchObject({ kind: 'failed', reason: 'network' });
  });

  it('a reply outside the schema: failed', async () => {
    const outside = [
      { model: 'jev-1.13.0', answer: 'finance', confidence: 0.9 },             // not an option
      { model: 'jev-1.13.0', answer: 'business' },                             // no confidence
      { model: 'jev-1.13.0', answer: 'business', confidence: 1.5 },            // confidence above 1
      { answer: 'business', confidence: 0.5 },                                 // no model
      'business',
    ];
    for (const body of outside) {
      const out = await askJev({ key: KEY, state: 's', question: CHOICE, fetch: stub(ok(body)).fetch });
      expect(out, JSON.stringify(body)).toMatchObject({ kind: 'failed', reason: 'schema' });
    }
    const noul = await askJev({ key: KEY, state: 's', question: NOUL, fetch: stub(ok({ model: 'jev-1.13.0', answer: 'yes', confidence: 0.5 })).fetch });
    expect(noul).toMatchObject({ kind: 'failed', reason: 'schema' });
    const noul2 = await askJev({ key: KEY, state: 's', question: NOUL, fetch: stub(ok({ model: 'jev-1.13.0', answer: 1.2, confidence: 0.5 })).fetch });
    expect(noul2).toMatchObject({ kind: 'failed', reason: 'schema' });
    const score = await askJev({ key: KEY, state: 's', question: SCORE, fetch: stub(ok({ model: 'jev-1.13.0', answer: 'critical', confidence: 0.5 })).fetch });
    expect(score).toMatchObject({ kind: 'failed', reason: 'schema' });
    const notJson = await askJev({ key: KEY, state: 's', question: NOUL, fetch: stub(new Response('<html>', { status: 200 })).fetch });
    expect(notJson).toMatchObject({ kind: 'failed', reason: 'schema' });
  });

  it('times every call', async () => {
    let t = 1000;
    const out = await askJev({ key: KEY, state: 's', question: NOUL, fetch: stub(ok({ model: 'jev-1.13.0', answer: 0.5, confidence: 0.5 })).fetch, now: () => (t += 180) });
    expect(out.ms).toBe(180);
  });
});
