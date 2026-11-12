import { describe, expect, it } from 'vitest';
import { EMBED_DIMENSIONS, EMBED_MODEL, embedClient } from './client';

// The galaxy's client of the `embed` Edge Function (PRD 2728 s5), against a fake fetch that plays the
// function as the spec writes it: POST {texts} → {model: "gte-small", vectors}, the service role's JWT alone.

const vector = (seed: number): number[] => Array.from({ length: EMBED_DIMENSIONS }, (_, i) => (i === seed ? 1 : 0));
const KEY = 'service-role-jwt-for-tests';

function fakeFetch(answer: (body: { texts: string[] }) => Response) {
  const sent: { url: string; init: RequestInit; body: string }[] = [];
  const fetch = (url: string, init: RequestInit): Promise<Response> => {
    const body = typeof init.body === 'string' ? init.body : '';
    sent.push({ url, init, body });
    return Promise.resolve(answer(JSON.parse(body) as { texts: string[] }));
  };
  return { fetch, sent };
}

describe('embedClient', () => {
  it('posts the texts to the function with the service role\'s key and answers one vector per text, in order', async () => {
    const { fetch, sent } = fakeFetch(({ texts }) => Response.json({ model: EMBED_MODEL, vectors: texts.map((_, i) => vector(i)) }));
    const embed = embedClient({ url: 'https://db.example/', serviceRoleKey: KEY, fetch });
    const vectors = await embed(['a quote', 'a payment term'], new AbortController().signal);
    expect(vectors).toEqual([vector(0), vector(1)]);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.url).toBe('https://db.example/functions/v1/embed');
    expect(sent[0]?.init.method).toBe('POST');
    expect(new Headers(sent[0]?.init.headers).get('authorization')).toBe(`Bearer ${KEY}`);
    expect(JSON.parse(sent[0]?.body ?? '')).toEqual({ texts: ['a quote', 'a payment term'] });
  });

  it('asks nothing for no texts', async () => {
    const { fetch, sent } = fakeFetch(() => Response.json({}));
    expect(await embedClient({ url: 'https://db.example', serviceRoleKey: KEY, fetch })([], new AbortController().signal)).toEqual([]);
    expect(sent).toEqual([]);
  });

  it('passes the signal on, so a caller can stop waiting', async () => {
    const { fetch, sent } = fakeFetch(({ texts }) => Response.json({ model: EMBED_MODEL, vectors: texts.map(() => vector(0)) }));
    const controller = new AbortController();
    await embedClient({ url: 'https://db.example', serviceRoleKey: KEY, fetch })(['x'], controller.signal);
    expect(sent[0]?.init.signal).toBe(controller.signal);
  });

  it('throws on a refusal, naming the status and never the key', async () => {
    const { fetch } = fakeFetch(() => new Response('no', { status: 401 }));
    const failure = await embedClient({ url: 'https://db.example', serviceRoleKey: KEY, fetch })(['x'], new AbortController().signal)
      .then(() => null, (error: unknown) => (error instanceof Error ? error.message : String(error)));
    expect(failure).toBe('embed: answered 401');
  });

  it('throws on an answer out of shape: another model, a vector count or length that does not match', async () => {
    const answers = [
      { model: 'other-model', vectors: [vector(0)] },
      { model: EMBED_MODEL, vectors: [] },
      { model: EMBED_MODEL, vectors: [[1, 0, 0]] },
      { nothing: true },
    ];
    for (const answer of answers) {
      const { fetch } = fakeFetch(() => Response.json(answer));
      await expect(embedClient({ url: 'https://db.example', serviceRoleKey: KEY, fetch })(['x'], new AbortController().signal))
        .rejects.toThrow('embed: answered out of shape');
    }
  });
});
