// The `embed` Edge Function's handler (PRD 2728), as a pure function with a fake model session and a fake
// environment: no test calls the model or the edge runtime.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DIMENSIONS, MAX_CHARACTERS, MAX_TEXTS, handleEmbed, serverKeys, type EmbedSession, type ReadEnv } from './handler.ts';

const token = (payload: unknown): string => {
  const part = (value: unknown): string => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${part({ alg: 'HS256', typ: 'JWT' })}.${part(payload)}.fake-signature`;
};

// Fictional keys, built at run time: none is a real project's.
const SERVICE = token({ role: 'service_role', iss: 'supabase', ref: 'fake-project' });
const ANON = token({ role: 'anon', iss: 'supabase', ref: 'fake-project' });
const SECRET = ['sb', 'secret', 'fakeFakeFakeFakeFake0001'].join('_');
const OTHER_SECRET = ['sb', 'secret', 'fakeFakeFakeFakeFake0002'].join('_');
const PUBLISHABLE = ['sb', 'publishable', 'fakeFakeFakeFakeFake0003'].join('_');
const EVERY_KEY = [SERVICE, ANON, SECRET, OTHER_SECRET, PUBLISHABLE];

const envOf = (values: Record<string, string>): ReadEnv => (name) => values[name];
const ENV = envOf({
  SUPABASE_SERVICE_ROLE_KEY: SERVICE,
  SUPABASE_ANON_KEY: ANON,
  SUPABASE_SECRET_KEYS: JSON.stringify({ default: SECRET, backend: OTHER_SECRET }),
  SUPABASE_PUBLISHABLE_KEYS: JSON.stringify({ default: PUBLISHABLE }),
});

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

const post = (body: unknown, auth: string | null = SECRET, method = 'POST'): Request => {
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
    const response = await handleEmbed(post({ texts: ['a quote', 'a payment term', 'x'] }), session, ENV);
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
    const response = await handleEmbed(post({ texts: [] }), session, ENV);
    expect(response.status).toBe(200);
    expect(await json(response)).toEqual({ model: 'gte-small', vectors: [] });
    expect(session.seen).toEqual([]);
  });

  it(`cuts each text to ${MAX_CHARACTERS} characters, never refusing it, and never splits a character`, async () => {
    const session = fakeSession();
    const long = 'é'.repeat(MAX_CHARACTERS + 500);
    const emoji = `${'a'.repeat(MAX_CHARACTERS - 1)}😀tail`;
    const response = await handleEmbed(post({ texts: [long, emoji, 'short'] }), session, ENV);
    expect(response.status).toBe(200);
    expect(session.seen[0]).toBe('é'.repeat(MAX_CHARACTERS));
    expect(session.seen[1]).toBe(`${'a'.repeat(MAX_CHARACTERS - 1)}😀`);
    expect(session.seen[2]).toBe('short');
  });

  it(`takes ${MAX_TEXTS} texts, and refuses ${MAX_TEXTS + 1} whole, embedding nothing`, async () => {
    const ok = fakeSession();
    const full = await handleEmbed(post({ texts: Array.from({ length: MAX_TEXTS }, (_, i) => `t${i}`) }), ok, ENV);
    expect(full.status).toBe(200);
    expect(((await json(full)).vectors as unknown[]).length).toBe(MAX_TEXTS);

    const over = fakeSession();
    const refused = await handleEmbed(post({ texts: Array.from({ length: MAX_TEXTS + 1 }, (_, i) => `t${i}`) }), over, ENV);
    expect(refused.status).toBe(413);
    expect(over.seen).toEqual([]);
  });

  describe('who gets in', () => {
    it('lets in the legacy service-role JWT that SUPABASE_SERVICE_ROLE_KEY holds', async () => {
      const session = fakeSession();
      const response = await handleEmbed(post({ texts: ['x'] }, SERVICE), session, envOf({ SUPABASE_SERVICE_ROLE_KEY: SERVICE }));
      expect(response.status).toBe(200);
      expect(session.seen).toEqual(['x']);
    });

    it.each([['the default', SECRET], ['another', OTHER_SECRET]])('lets in %s secret key SUPABASE_SECRET_KEYS holds', async (_, key) => {
      const session = fakeSession();
      const env = envOf({ SUPABASE_SECRET_KEYS: JSON.stringify({ default: SECRET, backend: OTHER_SECRET }) });
      const response = await handleEmbed(post({ texts: ['x'] }, key), session, env);
      expect(response.status).toBe(200);
      expect(session.seen).toEqual(['x']);
    });

    it.each([
      ['no authorization header', null],
      ['the anon key', ANON],
      ['a publishable key', PUBLISHABLE],
      ['a JWT claiming the service role that is not the key', token({ role: 'service_role', iss: 'supabase', ref: 'another-project' })],
      ['a near miss of the secret key, its last character changed', `${SECRET.slice(0, -1)}X`],
      ['the secret key with one character more', `${SECRET}0`],
      ['the secret key cut short', SECRET.slice(0, -1)],
      ['a token that is not a key', 'not-a-key'],
    ])('answers 401 to %s, embedding nothing', async (_, auth) => {
      const session = fakeSession();
      const response = await handleEmbed(post({ texts: ['a secret question'] }, auth), session, ENV);
      expect(response.status).toBe(401);
      expect(session.seen).toEqual([]);
      expect(JSON.stringify(await json(response))).not.toContain('a secret question');
    });

    it.each([
      ['an empty environment', envOf({})],
      ['empty keys', envOf({ SUPABASE_SERVICE_ROLE_KEY: '', SUPABASE_SECRET_KEYS: JSON.stringify({ default: '' }) })],
      ['secret keys that are not JSON', envOf({ SUPABASE_SECRET_KEYS: SECRET })],
      ['secret keys that are a list', envOf({ SUPABASE_SECRET_KEYS: JSON.stringify([SECRET]) })],
    ])('answers 401 to every caller with %s', async (_, env) => {
      for (const auth of [SECRET, SERVICE, '', null]) {
        const session = fakeSession();
        const response = await handleEmbed(post({ texts: ['x'] }, auth), session, env);
        expect(response.status).toBe(401);
        expect(session.seen).toEqual([]);
      }
    });

    it('answers 401 to a non-Bearer authorization', async () => {
      const session = fakeSession();
      const request = new Request('https://fake-project.supabase.test/functions/v1/embed', {
        method: 'POST',
        headers: { authorization: `Basic ${SECRET}` },
        body: JSON.stringify({ texts: ['x'] }),
      });
      expect((await handleEmbed(request, session, ENV)).status).toBe(401);
      expect(session.seen).toEqual([]);
    });

    it('checks the caller before it reads the body', async () => {
      const response = await handleEmbed(post('{not json', ANON), fakeSession(), ENV);
      expect(response.status).toBe(401);
    });

    it('reads the keys of both variables, and ignores secret keys it cannot parse', () => {
      expect(serverKeys(ENV)).toEqual([SERVICE, SECRET, OTHER_SECRET]);
      expect(serverKeys(envOf({ SUPABASE_SERVICE_ROLE_KEY: SERVICE, SUPABASE_SECRET_KEYS: '{broken' }))).toEqual([SERVICE]);
      expect(serverKeys(envOf({ SUPABASE_SECRET_KEYS: JSON.stringify({ a: SECRET, b: 7, c: null }) }))).toEqual([SECRET]);
      expect(serverKeys(envOf({}))).toEqual([]);
    });

    it('never puts a key in an answer', async () => {
      const answers = [
        await handleEmbed(post({ texts: ['x'] }, SECRET), fakeSession(), ENV),
        await handleEmbed(post({ texts: ['x'] }, PUBLISHABLE), fakeSession(), ENV),
        await handleEmbed(post('{broken', SECRET), fakeSession(), ENV),
        await handleEmbed(post({ texts: ['x'] }, SECRET), fakeSession(() => { throw new Error(SECRET); }), ENV),
      ];
      for (const response of answers) {
        const parts: string[] = [];
        response.headers.forEach((value) => { parts.push(value); });
        const text = `${parts.join(' ')} ${await response.text()}`;
        for (const key of EVERY_KEY) expect(text).not.toContain(key);
      }
    });
  });

  it('answers 405 to anything but POST', async () => {
    const session = fakeSession();
    const response = await handleEmbed(post(null, SECRET, 'GET'), session, ENV);
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
    const response = await handleEmbed(post(body), session, ENV);
    expect(response.status).toBe(400);
    expect(session.seen).toEqual([]);
  });

  it('answers 500, with nothing it received, when the model fails', async () => {
    const session = fakeSession(() => { throw new Error('model down for a secret question'); });
    const response = await handleEmbed(post({ texts: ['a secret question'] }), session, ENV);
    expect(response.status).toBe(500);
    expect(JSON.stringify(await json(response))).not.toContain('secret question');
  });

  it.each([
    ['a vector of the wrong length', () => unit(1).slice(1)],
    ['something that is not a list', () => 'vector'],
    ['a list holding a non-number', () => [...unit(1).slice(1), 'x']],
    ['a list holding a non-finite number', () => [...unit(1).slice(1), Number.NaN]],
  ])('answers 500 when the model returns %s, never a partial answer', async (_, embed) => {
    const session = fakeSession(embed);
    const response = await handleEmbed(post({ texts: ['a', 'b'] }), session, ENV);
    expect(response.status).toBe(500);
    expect(await json(response)).not.toHaveProperty('vectors');
  });

  it('logs nothing it receives, its keys included, whatever the outcome', async () => {
    await handleEmbed(post({ texts: ['a secret question'] }, SECRET), fakeSession(), ENV);
    await handleEmbed(post({ texts: ['a secret question'] }, ANON), fakeSession(), ENV);
    await handleEmbed(post({ texts: ['a secret question'] }, `${SECRET}0`), fakeSession(), ENV);
    await handleEmbed(post('{a secret question'), fakeSession(), ENV);
    await handleEmbed(post({ texts: ['a secret question'] }), fakeSession(() => { throw new Error(SECRET); }), ENV);
    expect(logs).toEqual([]);
  });
});
