// The `embed` Edge Function's handler (PRD 2728), as a pure function with a fake model session: no
// test calls the model or the edge runtime.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DIMENSIONS, MAX_CHARACTERS, MAX_TEXTS, handleEmbed, type EmbedSession } from './handler.ts';

const token = (payload: unknown): string => {
  const part = (value: unknown): string => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${part({ alg: 'HS256', typ: 'JWT' })}.${part(payload)}.fake-signature`;
};

const SERVICE = token({ role: 'service_role', iss: 'supabase' });

const unit = (seed: number): number[] => {
  const raw = Array.from({ length: DIMENSIONS }, (_, i) => Math.sin(seed + i) + 1.5);
  const norm = Math.hypot(...raw);
  return raw.map((x) => x / norm);
};

interface Fake extends EmbedSession {
  seen: string[];
  options: unknown[];
}

const fakeSession = (embed: (text: string) => unknown = (text) => unit(text.length)): Fake => {
  const seen: string[] = [];
  const options: unknown[] = [];
  return {
    seen,
    options,
    run: (text, opts) => {
      seen.push(text);
      options.push(opts);
      return Promise.resolve(embed(text));
    },
  };
};

const post = (body: unknown, auth: string | null = SERVICE, method = 'POST'): Request => {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (auth !== null) headers.set('authorization', `Bearer ${auth}`);
  return new Request('https://fake-project.supabase.test/functions/v1/embed', {
    method,
    headers,
    ...(method === 'POST' ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
  });
};

const json = async (response: Response): Promise<Record<string, unknown>> => (await response.json()) as Record<string, unknown>;

describe('the embed handler', () => {
  let logs: unknown[][];
  beforeEach(() => {
    logs = [];
    for (const name of ['log', 'info', 'warn', 'error', 'debug'] as const) {
      vi.spyOn(console, name).mockImplementation((...args: unknown[]) => { logs.push(args); });
    }
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('answers one normalized 384-long gte-small vector per text, in order', async () => {
    const session = fakeSession();
    const response = await handleEmbed(post({ texts: ['a quote', 'a payment term', 'x'] }), session);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    const body = await json(response);
    expect(body.model).toBe('gte-small');
    expect(body.vectors).toEqual([unit(7), unit(14), unit(1)]);
    expect(session.seen).toEqual(['a quote', 'a payment term', 'x']);
    expect(session.options).toEqual([
      { mean_pool: true, normalize: true },
      { mean_pool: true, normalize: true },
      { mean_pool: true, normalize: true },
    ]);
  });

  it('answers no vectors for an empty list, without touching the model', async () => {
    const session = fakeSession();
    const response = await handleEmbed(post({ texts: [] }), session);
    expect(response.status).toBe(200);
    expect(await json(response)).toEqual({ model: 'gte-small', vectors: [] });
    expect(session.seen).toEqual([]);
  });

  it(`cuts each text to ${MAX_CHARACTERS} characters, never refusing it, and never splits a character`, async () => {
    const session = fakeSession();
    const long = 'é'.repeat(MAX_CHARACTERS + 500);
    const emoji = `${'a'.repeat(MAX_CHARACTERS - 1)}😀tail`;
    const response = await handleEmbed(post({ texts: [long, emoji, 'short'] }), session);
    expect(response.status).toBe(200);
    expect(session.seen[0]).toBe('é'.repeat(MAX_CHARACTERS));
    expect(session.seen[1]).toBe(`${'a'.repeat(MAX_CHARACTERS - 1)}😀`);
    expect(session.seen[2]).toBe('short');
  });

  it(`takes ${MAX_TEXTS} texts, and refuses ${MAX_TEXTS + 1} whole, embedding nothing`, async () => {
    const ok = fakeSession();
    const full = await handleEmbed(post({ texts: Array.from({ length: MAX_TEXTS }, (_, i) => `t${i}`) }), ok);
    expect(full.status).toBe(200);
    expect(((await json(full)).vectors as unknown[]).length).toBe(MAX_TEXTS);

    const over = fakeSession();
    const refused = await handleEmbed(post({ texts: Array.from({ length: MAX_TEXTS + 1 }, (_, i) => `t${i}`) }), over);
    expect(refused.status).toBe(413);
    expect(over.seen).toEqual([]);
  });

  it.each([
    ['no authorization header', null],
    ['an anon token', token({ role: 'anon' })],
    ['a signed-in person', token({ role: 'authenticated', sub: '00000000-0000-4000-8000-000000000001' })],
    ['a token with no role', token({ iss: 'supabase' })],
    ['a token that is not a JWT', 'not-a-token'],
    ['a payload that is not JSON', 'aGVhZGVy.bm90IGpzb24.sig'],
    ['a payload that is not an object', token('service_role')],
  ])('answers 401 to %s, embedding nothing', async (_, auth) => {
    const session = fakeSession();
    const response = await handleEmbed(post({ texts: ['a secret question'] }, auth), session);
    expect(response.status).toBe(401);
    expect(session.seen).toEqual([]);
    expect(JSON.stringify(await json(response))).not.toContain('a secret question');
  });

  it('answers 401 to a non-Bearer authorization', async () => {
    const session = fakeSession();
    const request = new Request('https://fake-project.supabase.test/functions/v1/embed', {
      method: 'POST',
      headers: { authorization: `Basic ${SERVICE}` },
      body: JSON.stringify({ texts: ['x'] }),
    });
    expect((await handleEmbed(request, session)).status).toBe(401);
    expect(session.seen).toEqual([]);
  });

  it('checks the caller before it reads the body', async () => {
    const session = fakeSession();
    const response = await handleEmbed(post('{not json', token({ role: 'anon' })), session);
    expect(response.status).toBe(401);
  });

  it('answers 405 to anything but POST', async () => {
    const session = fakeSession();
    const response = await handleEmbed(post(null, SERVICE, 'GET'), session);
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('POST');
    expect(session.seen).toEqual([]);
  });

  it.each([
    ['a body that is not JSON', '{not json'],
    ['no texts', {}],
    ['texts that are not a list', { texts: 'one text' }],
    ['a text that is not a string', { texts: ['a', 2] }],
    ['a body that is not an object', ['a', 'b']],
    ['a null body', null],
  ])('answers 400 to %s, embedding nothing', async (_, body) => {
    const session = fakeSession();
    const response = await handleEmbed(post(body), session);
    expect(response.status).toBe(400);
    expect(session.seen).toEqual([]);
  });

  it('answers 500, with nothing it received, when the model fails', async () => {
    const session = fakeSession(() => { throw new Error('model down for a secret question'); });
    const response = await handleEmbed(post({ texts: ['a secret question'] }), session);
    expect(response.status).toBe(500);
    expect(JSON.stringify(await json(response))).not.toContain('secret');
  });

  it.each([
    ['a vector of the wrong length', () => unit(1).slice(1)],
    ['something that is not a list', () => 'vector'],
    ['a list holding a non-number', () => [...unit(1).slice(1), 'x']],
    ['a list holding a non-finite number', () => [...unit(1).slice(1), Number.NaN]],
  ])('answers 500 when the model returns %s, never a partial answer', async (_, embed) => {
    const session = fakeSession(embed);
    const response = await handleEmbed(post({ texts: ['a', 'b'] }), session);
    expect(response.status).toBe(500);
    expect(await json(response)).not.toHaveProperty('vectors');
  });

  it('logs nothing it receives, whatever the outcome', async () => {
    await handleEmbed(post({ texts: ['a secret question'] }), fakeSession());
    await handleEmbed(post({ texts: ['a secret question'] }, token({ role: 'anon' })), fakeSession());
    await handleEmbed(post('{a secret question'), fakeSession());
    await handleEmbed(post({ texts: ['a secret question'] }), fakeSession(() => { throw new Error('a secret question'); }));
    expect(logs).toEqual([]);
  });
});
