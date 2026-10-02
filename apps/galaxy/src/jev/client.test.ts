import { describe, expect, it } from 'vitest';
import { JEV_MODEL, JEV_TIMEOUT_MS, JEV_URL, askJev, type JevQuestion } from './client';
import { sure } from '../arcade/sure';

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
/** TypeSafe's reply to the one question, named `q`. */
const reply = (answer: Record<string, unknown>, model: string | null = 'jev-1.13.0') =>
  ok({ ...(model ? { model } : {}), answers: { q: answer } });
const choice = (c: string, confidence = 0.9, probabilities?: Record<string, number>) => reply({ type: 'choice', choice: c, confidence, ...(probabilities ? { probabilities } : {}) });
const noul = (p: number) => reply({ type: 'noul', noul: p });
const score = (value: number, extra: Record<string, unknown> = {}) => reply({ type: 'score', score: value, ...extra });

describe('the request', () => {
  it('posts the state and the question to systemone, with the key as bearer and the pinned model', async () => {
    const { fetch, calls } = stub(choice('product'));
    await askJev({ key: KEY, state: { questions: ['What to build?'] }, question: CHOICE, fetch });
    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(JEV_URL).toBe('https://api.typesafe.ai/v1/systemone');
    expect(sure(call, 'call').url).toBe(JEV_URL);
    expect(sure(call, 'call').init.method).toBe('POST');
    const headers = new Headers(sure(call, 'call').init.headers);
    expect(headers.get('authorization')).toBe(`Bearer ${KEY}`);
    expect(headers.get('content-type')).toBe('application/json');
    expect(JEV_MODEL).toBe('jev-1.13.0');
    expect(sure(call, 'call').body.model).toBe('jev-1.13.0');
    expect(sure(call, 'call').body.state).toEqual({ questions: ['What to build?'] });
    expect(sure(call, 'call').body.questions).toEqual({
      q: {
        type: 'choice',
        instructions: 'Which category does this question belong to?',
        criteria: { business: 'pricing, customers', product: 'scope, features' },
      },
    });
  });

  it('sends a score\'s levels lowest first as criteria, and a noul\'s statement as its instructions', async () => {
    const a = stub(score(0));
    await askJev({ key: KEY, state: 'bug', question: SCORE, fetch: a.fetch });
    expect(sure(a.calls[0], 'a.calls[0]').body.questions).toEqual({
      q: { type: 'score', instructions: 'How risky is this bug?', criteria: ['low: cosmetic', 'medium: annoying', 'high: data at risk'] },
    });
    const b = stub(noul(0.7));
    await askJev({ key: KEY, state: 'decision', question: NOUL, fetch: b.fetch });
    expect(sure(b.calls[0], 'b.calls[0]').body.questions).toEqual({ q: { type: 'noul', instructions: 'This decision is hard to revert.' } });
  });

  it('masks every token in the state and the question before sending', async () => {
    const token = 'ghp_abcdefghijklmnopqrstuvwxyz0123456789';
    const { fetch, calls } = stub(noul(0.1));
    await askJev({ key: KEY, state: { body: `leaked ${token}` }, question: { type: 'noul', statement: `uses ${token}` }, fetch });
    expect(String(sure(calls[0], 'calls[0]').init.body)).not.toContain(token);
    expect(sure(calls[0], 'calls[0]').body.state).toEqual({ body: 'leaked [masked]' });
  });

  it('waits 5 s at most by default', () => {
    expect(JEV_TIMEOUT_MS).toBe(5000);
  });
});

describe('each outcome', () => {
  it('a Choice: the option\'s key, the confidence and the model Jev reports', async () => {
    const { fetch } = stub(choice('business', 0.82, { business: 0.82, product: 0.18 }));
    const out = await askJev({ key: KEY, state: 's', question: CHOICE, fetch });
    expect(out).toMatchObject({ kind: 'answered', model: 'jev-1.13.0', answer: 'business', confidence: 0.82, probabilities: { business: 0.82, product: 0.18 } });
  });

  it('a reply without a model is logged under the pinned one', async () => {
    const { fetch } = stub(reply({ type: 'choice', choice: 'product', confidence: 0.7 }, null));
    expect(await askJev({ key: KEY, state: 's', question: CHOICE, fetch })).toMatchObject({ kind: 'answered', model: JEV_MODEL, answer: 'product' });
  });

  it('a Score with probabilities: the most probable level, keyed by index or by level', async () => {
    const byIndex = stub(score(0.9, { confidence: 0.6, probabilities: { '0': 0.1, '1': 0.2, '2': 0.7 } }));
    expect(await askJev({ key: KEY, state: 's', question: SCORE, fetch: byIndex.fetch })).toMatchObject({
      kind: 'answered', answer: 'high', confidence: 0.6, probabilities: { low: 0.1, medium: 0.2, high: 0.7 },
    });
    const byKey = stub(score(0.5, { probabilities: { low: 0.1, medium: 0.8, high: 0.1 } }));
    const out = await askJev({ key: KEY, state: 's', question: SCORE, fetch: byKey.fetch });
    expect(out).toMatchObject({ kind: 'answered', answer: 'medium' });
    expect(out.kind === 'answered' && out.confidence).toBeCloseTo(0.7);   // (3 × 0.8 − 1) / 2
  });

  it('a Score without probabilities: its position from 0 to 1, rounded to a level', async () => {
    const low = await askJev({ key: KEY, state: 's', question: SCORE, fetch: stub(score(0.1)).fetch });
    expect(low).toMatchObject({ kind: 'answered', answer: 'low' });
    expect(low.kind === 'answered' && low.confidence).toBeCloseTo(0.6);   // 1 − 2 × 0.2
    const high = await askJev({ key: KEY, state: 's', question: SCORE, fetch: stub(score(1, { confidence: 0.9 })).fetch });
    expect(high).toMatchObject({ kind: 'answered', answer: 'high', confidence: 0.9 });
  });

  it('a Noul: how true the statement is, 0 to 1, sure in proportion to its distance from 0.5', async () => {
    const out = await askJev({ key: KEY, state: 's', question: NOUL, fetch: stub(noul(0.82)).fetch });
    expect(out).toMatchObject({ kind: 'answered', answer: 0.82 });
    expect(out.kind === 'answered' && out.confidence).toBeCloseTo(0.64);
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
      init.signal?.addEventListener('abort', () => { reject(Object.assign(new Error('aborted'), { name: 'AbortError' })); });
    })) as unknown as typeof globalThis.fetch;
    const out = await askJev({ key: KEY, state: 's', question: NOUL, fetch, timeoutMs: 20 });
    expect(out).toMatchObject({ kind: 'failed', reason: 'timeout' });
  });

  it('a network error: failed', async () => {
    const fetch = (() => Promise.reject(new TypeError('fetch failed'))) as unknown as typeof globalThis.fetch;
    expect(await askJev({ key: KEY, state: 's', question: NOUL, fetch })).toMatchObject({ kind: 'failed', reason: 'network' });
  });

  it('a reply outside the schema: failed', async () => {
    const outside = [
      { model: 'jev-1.13.0', answers: { q: { type: 'choice', choice: 'finance', confidence: 0.9 } } },   // not an option
      { model: 'jev-1.13.0', answers: { q: { type: 'choice', choice: 'business' } } },                   // no confidence
      { model: 'jev-1.13.0', answers: { q: { type: 'choice', choice: 'business', confidence: 1.5 } } },  // confidence above 1
      { model: 'jev-1.13.0', answers: { q: { type: 'noul', noul: 0.5 } } },                             // another type
      { model: 'jev-1.13.0', answers: {} },                                                            // no answer
      { model: 'jev-1.13.0', answer: 'business', confidence: 0.5 },                                    // not TypeSafe's shape
      'business',
    ];
    for (const body of outside) {
      const out = await askJev({ key: KEY, state: 's', question: CHOICE, fetch: stub(ok(body)).fetch });
      expect(out, JSON.stringify(body)).toMatchObject({ kind: 'failed', reason: 'schema' });
    }
    const noulOut = await askJev({ key: KEY, state: 's', question: NOUL, fetch: stub(reply({ type: 'noul', noul: 'yes' })).fetch });
    expect(noulOut).toMatchObject({ kind: 'failed', reason: 'schema' });
    const noul2 = await askJev({ key: KEY, state: 's', question: NOUL, fetch: stub(noul(1.2)).fetch });
    expect(noul2).toMatchObject({ kind: 'failed', reason: 'schema' });
    const scoreOut = await askJev({ key: KEY, state: 's', question: SCORE, fetch: stub(score(3)).fetch });
    expect(scoreOut).toMatchObject({ kind: 'failed', reason: 'schema' });
    const scoreLevel = await askJev({ key: KEY, state: 's', question: SCORE, fetch: stub(score(0.5, { probabilities: { critical: 1 } })).fetch });
    expect(scoreLevel).toMatchObject({ kind: 'failed', reason: 'schema' });
    const notJson = await askJev({ key: KEY, state: 's', question: NOUL, fetch: stub(new Response('<html>', { status: 200 })).fetch });
    expect(notJson).toMatchObject({ kind: 'failed', reason: 'schema' });
  });

  it('times every call', async () => {
    let t = 1000;
    const out = await askJev({ key: KEY, state: 's', question: NOUL, fetch: stub(noul(0.5)).fetch, now: () => (t += 180) });
    expect(out.ms).toBe(180);
  });
});
