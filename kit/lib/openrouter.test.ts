import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { AskInput } from './openrouter.ts';
import {
  DEFAULT_MODEL,
  MASK,
  MODEL_CALL,
  NO_KEY,
  OPENROUTER_URL,
  REFUSED,
  UNAVAILABLE,
  askModel,
  maskSecrets,
} from './openrouter.ts';
import { assertDefined } from '../test/assert.ts';
import { dig } from '../bin/dig.ts';

const KEY = { OPENROUTER_API_KEY: 'sk-or-v1-test-key-not-real-0000000000' };
const REPLY = { kind: 'adr', statement: 'The outbox check reads two snapshots.' };
const SCHEMA = {
  name: 'classification',
  schema: {
    type: 'object',
    properties: { kind: { type: 'string' }, statement: { type: 'string' } },
    required: ['kind', 'statement'],
    additionalProperties: false,
  },
};

/** A check in the retro's shape: what is wrong with a value, and the value kept. */
function check(input: unknown) {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { errors: ['the reply must be a JSON object'], reply: null };
  }
  const value = input as { kind?: unknown; statement?: unknown };
  const errors: string[] = [];
  if (typeof value.kind !== 'string') errors.push('kind must be a string');
  if (typeof value.statement !== 'string') errors.push('statement must be a string');
  return errors.length ? { errors, reply: null } : { errors, reply: { kind: value.kind, statement: value.statement } };
}

/** OpenRouter's streamed reply: a keep-alive comment, the content in pieces, split mid-line, then [DONE]. */
function streamed(content: string, { error = null }: { error?: unknown } = {}) {
  const pieces = [content.slice(0, 10), content.slice(10, 25), content.slice(25)];
  const events = [
    ': OPENROUTER PROCESSING\n\n',
    ...pieces.map((piece) => `data: ${JSON.stringify({ choices: [{ delta: { content: piece } }] })}\n\n`),
    ...(error ? [`data: ${JSON.stringify({ error, choices: [{ delta: { content: '' }, finish_reason: 'error' }] })}\n\n`] : []),
    'data: [DONE]\n\n',
  ];
  const text = events.join('');
  const chunks = [text.slice(0, 37), text.slice(37, 90), text.slice(90)];
  const body = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

const plain = (content: string) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }), { headers: { 'content-type': 'application/json' } });
const failed = (status: number) => new Response(JSON.stringify({ error: { code: status, message: 'no' } }), { status });

/** A stubbed fetch answering each call with the next response (the last one repeats). */
type Answer = Response | Error | ((init: RequestInit) => Response | Promise<Response>);
function stubFetch(...answers: Answer[]) {
  // Each recorded call keeps the JSON body it sent as `unknown`, read with `dig`.
  const calls: { url: string; init: RequestInit; body: unknown }[] = [];
  const fn = vi.fn(async (url: string, init: RequestInit): Promise<Response> => {
    const sent = init.body;
    if (typeof sent !== 'string') throw new Error('the request carries no text body');
    calls.push({ url, init, body: JSON.parse(sent) });
    const answer = answers[Math.min(calls.length, answers.length) - 1];
    assertDefined(answer, 'answer');
    if (answer instanceof Error) throw answer;
    return typeof answer === 'function' ? answer(init) : answer.clone();
  });
  return Object.assign(fn, { calls });
}

const noSleep = vi.fn<(ms: number) => Promise<void>>(() => Promise.resolve());
const ask = (fetch: unknown, over: Partial<AskInput> = {}) =>
  askModel({ system: 'You classify.', user: 'The item.', check, schema: SCHEMA, env: KEY, fetch: fetch as typeof globalThis.fetch, sleep: noSleep, ...over });

describe('askModel — no key', () => {
  it('returns an error naming OPENROUTER_API_KEY, before any request', async () => {
    const fetch = stubFetch(plain(JSON.stringify(REPLY)));
    const out = await askModel({ system: 's', user: 'u', check, env: {}, fetch: fetch as unknown as typeof globalThis.fetch });
    expect(out).toEqual({ ok: false, error: NO_KEY, model: null, reply: null, reason: 'OPENROUTER_API_KEY is not set' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('never reaches the network: fetch is injected, and a missing one is refused', async () => {
    const out = await askModel({ system: 's', user: 'u', check, env: KEY, fetch: undefined });
    expect(out.ok).toBe(false);
    expect(out.reason).toMatch(/fetch/);
  });
});

describe('askModel — the request', () => {
  it('goes to OpenRouter’s chat completions with PRD 72’s default model, at temperature 0, with a JSON-schema response format', async () => {
    const fetch = stubFetch(plain(JSON.stringify(REPLY)));
    const out = await ask(fetch);
    expect(out).toEqual({ ok: true, error: null, model: DEFAULT_MODEL, reply: REPLY, reason: null });
    expect(DEFAULT_MODEL).toBe('anthropic/claude-opus-5.5');
    expect(fetch).toHaveBeenCalledTimes(1);
    const [first] = fetch.calls;
    assertDefined(first, 'the request');
    const { url, init, body } = first;
    expect(url).toBe(OPENROUTER_URL);
    expect(OPENROUTER_URL).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(init.method).toBe('POST');
    expect(dig(init.headers, 'authorization')).toBe(`Bearer ${KEY.OPENROUTER_API_KEY}`);
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(body).toMatchObject({
      model: DEFAULT_MODEL,
      temperature: 0,
      max_tokens: MODEL_CALL.maxTokens,
      response_format: { type: 'json_schema', json_schema: { name: SCHEMA.name, strict: true, schema: SCHEMA.schema } },
    });
    expect(dig(body, 'messages')).toEqual([
      { role: 'system', content: 'You classify.' },
      { role: 'user', content: 'The item.' },
    ]);
  });

  it('asks the model OPENROUTER_MODEL names instead', async () => {
    const fetch = stubFetch(plain(JSON.stringify(REPLY)));
    const out = await ask(fetch, { env: { ...KEY, OPENROUTER_MODEL: 'anthropic/claude-sonnet-5' } });
    expect(out.model).toBe('anthropic/claude-sonnet-5');
    expect(dig(fetch.calls, 0, 'body', 'model')).toBe('anthropic/claude-sonnet-5');
  });

  it('sends no response format when no schema is given, and names its caller in x-title', async () => {
    const fetch = stubFetch(plain(JSON.stringify(REPLY)));
    await ask(fetch, { schema: undefined, title: 'omni loop harvest' });
    expect(dig(fetch.calls, 0, 'body')).not.toHaveProperty('response_format');
    expect(dig(fetch.calls, 0, 'init', 'headers', 'x-title')).toBe('omni loop harvest');
  });

  it('streams when asked, and reads the streamed reply', async () => {
    const fetch = stubFetch(streamed(JSON.stringify(REPLY)));
    expect((await ask(fetch, { stream: true })).reply).toEqual(REPLY);
    expect(dig(fetch.calls, 0, 'body', 'stream')).toBe(true);
  });

  it('reads a reply fenced as a code block', async () => {
    const out = await ask(stubFetch(plain(`\`\`\`json\n${JSON.stringify(REPLY)}\n\`\`\``)));
    expect(out.reply).toEqual(REPLY);
  });

  it('masks every token-shaped string in the prompt before anything is sent', async () => {
    const secrets = [
      'ghp_abcdefghijklmnopqrstuvwxyz0123456789',
      'ghs_ABCDEFGHIJKLMNOPQRSTUVWX0123456789ab',
      'github_pat_11ABCDEFG0123456789_abcdefghijklmnopqrstuvwxyz',
      'sk-or-v1-0123456789abcdef0123456789abcdef',
      'sk-ant-api03-abcdefghijklmnopqrstuvwxyz',
      'AKIAIOSFODNN7EXAMPLE',
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
    ];
    const fetch = stubFetch(plain(JSON.stringify(REPLY)));
    await ask(fetch, {
      system: `system ${secrets[0]}`,
      user: `curl -H "Authorization: Bearer abc.def-ghi" ${secrets.join(' ')}`,
    });
    const sent = dig(fetch.calls, 0, 'init', 'body');
    for (const secret of [...secrets, 'abc.def-ghi']) expect(sent).not.toContain(secret);
    expect(sent).toContain(`Bearer ${MASK}`);
    expect(maskSecrets('a task-list and sk-short stay')).toBe('a task-list and sk-short stay');
    expect(maskSecrets(maskSecrets(`Bearer x.y ${secrets[0]}`))).toBe(`Bearer ${MASK} ${MASK}`);
  });
});

describe('askModel — a reply the schema refuses', () => {
  it('gets one repair request, showing the model its reply and what is wrong with it', async () => {
    const broken = JSON.stringify({ kind: 7 });
    const fetch = stubFetch(plain(broken), plain(JSON.stringify(REPLY)));
    expect((await ask(fetch)).reply).toEqual(REPLY);
    expect(fetch).toHaveBeenCalledTimes(2);
    const repair = dig(fetch.calls, 1, 'body', 'messages');
    expect(repair).toHaveLength(4);
    expect([0, 1, 2, 3].map((index) => dig(repair, index, 'role'))).toEqual(['system', 'user', 'assistant', 'user']);
    expect(dig(repair, 2, 'content')).toBe(broken);
    expect(dig(repair, 3, 'content')).toContain('kind must be a string');
  });

  it('failing again returns a refusal with its reason, and never throws', async () => {
    const fetch = stubFetch(plain('not json at all'), plain('{"kind": "adr"}'));
    const out = await ask(fetch);
    expect(out).toEqual({
      ok: false,
      error: REFUSED,
      model: DEFAULT_MODEL,
      reply: null,
      reason: 'model reply invalid: statement must be a string',
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('takes a zod schema as the check, naming each issue by its path', async () => {
    const Reply = z.object({ kind: z.enum(['adr', 'rule']), statement: z.string().max(40) });
    const fetch = stubFetch(plain('{"kind": "poem", "statement": "x"}'), plain(JSON.stringify(REPLY)));
    const out = await ask(fetch, { check: Reply });
    expect(out.reply).toEqual(REPLY);
    expect(dig(fetch.calls, 1, 'body', 'messages', 3, 'content')).toContain('kind:');
  });

  it('a check that throws is a refusal, not a throw', async () => {
    const boom = () => {
      throw new Error('bad check');
    };
    const out = await ask(stubFetch(plain(JSON.stringify(REPLY))), { check: boom });
    expect(out.ok).toBe(false);
    expect(out.error).toBe(REFUSED);
  });
});

describe('askModel — the model unavailable', () => {
  it('tries a 500 again, and after its retries says so', async () => {
    const sleep = vi.fn<(ms: number) => Promise<void>>(() => Promise.resolve());
    const fetch = stubFetch(failed(500));
    const out = await ask(fetch, { sleep });
    expect(out).toEqual({ ok: false, error: UNAVAILABLE, model: DEFAULT_MODEL, reply: null, reason: 'model unavailable (500)' });
    expect(fetch).toHaveBeenCalledTimes(MODEL_CALL.attempts);
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual(MODEL_CALL.backoffMs.slice(0, MODEL_CALL.attempts - 1));
  });

  it('takes the reply of a retry that succeeds', async () => {
    const fetch = stubFetch(failed(503), failed(429), plain(JSON.stringify(REPLY)));
    expect((await ask(fetch)).reply).toEqual(REPLY);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('does not try a refused key again', async () => {
    const fetch = stubFetch(failed(401));
    expect((await ask(fetch)).reason).toBe('model unavailable (401)');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('names a network error, and an error OpenRouter sends inside the stream', async () => {
    expect((await ask(stubFetch(new TypeError('fetch failed')))).reason).toBe('model unavailable (network error)');
    const midStream = stubFetch(streamed('{"kind": "ad', { error: { code: 502, message: 'provider down' } }));
    expect((await ask(midStream, { stream: true })).reason).toBe('model unavailable (502)');
    expect(midStream).toHaveBeenCalledTimes(MODEL_CALL.attempts);
  });

  it('gives up when the call outlasts its time budget', async () => {
    const hang = (init: RequestInit) =>
      new Promise<Response>((_, reject) => {
        const { signal } = init;
        assertDefined(signal, 'the abort signal');
        signal.addEventListener('abort', () => {
          const reason: unknown = signal.reason;
          reject(reason instanceof Error ? reason : new Error(String(reason)));
        });
      });
    const out = await ask(stubFetch(hang), { call: { ...MODEL_CALL, budgetMs: 20 } });
    expect(out.reason).toBe('model unavailable (timeout)');
  });
});
