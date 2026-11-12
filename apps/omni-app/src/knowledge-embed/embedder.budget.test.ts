// Bug 2748: in production the `embed` Edge Function answered 546 (worker limit) to every call of 64 texts, so the
// knowledge-embed job threw and tried the same batch again, and no vector was ever stored. A batch the function
// cannot take within its budget is split in halves until each part fits.
import { describe, expect, it } from 'vitest';
import { EMBED_DIMENSIONS, embedClient } from './embedder.ts';

const vector = (seed: number) => Array.from({ length: EMBED_DIMENSIONS }, (_, i) => (i === seed % EMBED_DIMENSIONS ? 1 : 0));

/** An `embed` that runs out of budget above `fits` texts a call (546), and records each call's size. */
function budgeted(fits: number) {
  const sizes: number[] = [];
  const fetch: typeof globalThis.fetch = (_input, init = {}) => {
    const texts = (JSON.parse(typeof init.body === 'string' ? init.body : '{}') as { texts: string[] }).texts;
    sizes.push(texts.length);
    if (texts.length > fits) return Promise.resolve(new Response(JSON.stringify({ code: 'WORKER_LIMIT' }), { status: 546 }));
    const body = { model: 'gte-small', vectors: texts.map((t) => vector(Number(t.slice(1)))) };
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }));
  };
  return { fetch, sizes };
}

const connection = (fetch: typeof globalThis.fetch) => ({ url: 'https://acme.supabase.example/', key: 'service-role-fixture', fetch });

describe('embedClient within the function\'s budget (bug 2748)', () => {
  it('splits a batch the function answers 546 to until each part fits, and answers every vector in order', async () => {
    const { fetch, sizes } = budgeted(2);
    const texts = Array.from({ length: 8 }, (_, i) => `t${String(i)}`);
    expect(await embedClient(connection(fetch))(texts)).toEqual(texts.map((_, i) => vector(i)));
    expect(Math.max(...sizes.filter((n) => n <= 2))).toBe(2);
  });

  it('gives up only when a single text does not fit', async () => {
    const { fetch } = budgeted(0);
    await expect(embedClient(connection(fetch))(['t0'])).rejects.toThrow('embed answered 546');
  });
});
