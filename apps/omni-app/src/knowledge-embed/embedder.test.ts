// The client of the `embed` Edge Function (PRD 2728 s4) against a stubbed fetch: no test calls Supabase or a model.
import { describe, expect, it } from 'vitest';
import { EMBED_DIMENSIONS, embedClient, embedUrl } from './embedder.ts';

const vector = (seed: number) => Array.from({ length: EMBED_DIMENSIONS }, (_, i) => (i === seed ? 1 : 0));

type Sent = { url: string; init: RequestInit; body: string };

/** A fetch that answers `status` and `body` to every call, recording what was sent. */
function stub(answer: (texts: string[]) => { status?: number; body: unknown }) {
  const sent: Sent[] = [];
  const fetch: typeof globalThis.fetch = (input, init = {}) => {
    const url = input instanceof Request ? input.url : input.toString();
    const sentBody = typeof init.body === 'string' ? init.body : '';
    sent.push({ url, init, body: sentBody });
    const texts = (JSON.parse(sentBody) as { texts: string[] }).texts;
    const { status = 200, body } = answer(texts);
    return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
  };
  return { fetch, sent };
}

const connection = (fetch: typeof globalThis.fetch) => ({ url: 'https://acme.supabase.example/', key: 'service-role-fixture', fetch });

describe('embedClient', () => {
  it('posts the texts to the embed function as the service role, and answers the vectors in order', async () => {
    const { fetch, sent } = stub((texts) => ({ body: { model: 'gte-small', vectors: texts.map((_, i) => vector(i)) } }));
    expect(await embedClient(connection(fetch))(['a rule', 'a term'])).toEqual([vector(0), vector(1)]);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.url).toBe('https://acme.supabase.example/functions/v1/embed');
    expect(sent[0]?.init.method).toBe('POST');
    expect(sent[0]?.init.headers).toMatchObject({ authorization: 'Bearer service-role-fixture', 'content-type': 'application/json' });
    expect(JSON.parse(sent[0]?.body ?? '')).toEqual({ texts: ['a rule', 'a term'] });
  });

  it('calls nothing for no text', async () => {
    const { fetch, sent } = stub(() => ({ body: {} }));
    expect(await embedClient(connection(fetch))([])).toEqual([]);
    expect(sent).toHaveLength(0);
  });

  it('refuses more than 64 texts a call, unsent', async () => {
    const { fetch, sent } = stub(() => ({ body: {} }));
    await expect(embedClient(connection(fetch))(Array.from({ length: 65 }, () => 'x'))).rejects.toThrow('at most 64 texts');
    expect(sent).toHaveLength(0);
  });

  it('throws a refusal, naming its status and never the texts', async () => {
    const { fetch } = stub(() => ({ status: 401, body: { error: 'no' } }));
    const error = await embedClient(connection(fetch))(['a secret rule']).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('embed answered 401');
  });

  it('throws an answer out of shape: another model, a short vector, or one vector too few', async () => {
    const other = stub(() => ({ body: { model: 'other', vectors: [vector(0)] } }));
    await expect(embedClient(connection(other.fetch))(['a'])).rejects.toThrow('out of shape: model');
    const short = stub(() => ({ body: { model: 'gte-small', vectors: [[1, 0]] } }));
    await expect(embedClient(connection(short.fetch))(['a'])).rejects.toThrow('out of shape: vectors.0');
    const fewer = stub(() => ({ body: { model: 'gte-small', vectors: [vector(0)] } }));
    await expect(embedClient(connection(fewer.fetch))(['a', 'b'])).rejects.toThrow('1 vectors for 2 texts');
  });

  it('throws when no answer comes within the timeout', async () => {
    const fetch = ((_: unknown, init: RequestInit = {}) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => { reject(init.signal?.reason as Error); });
      })) as typeof globalThis.fetch;
    await expect(embedClient(connection(fetch), { timeoutMs: 10 })(['a'])).rejects.toThrow('embed: no answer within 10 ms');
  });

  it('throws a failed call without its cause', async () => {
    const fetch = (() => Promise.reject(new Error('getaddrinfo ENOTFOUND'))) as typeof globalThis.fetch;
    await expect(embedClient(connection(fetch))(['a'])).rejects.toThrow(/^embed: the call failed$/);
  });

  it('names the function on a project URL with or without its slash', () => {
    expect(embedUrl('https://x.example')).toBe('https://x.example/functions/v1/embed');
    expect(embedUrl('https://x.example//')).toBe('https://x.example/functions/v1/embed');
  });
});
