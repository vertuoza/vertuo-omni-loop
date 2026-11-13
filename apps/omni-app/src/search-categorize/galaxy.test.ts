// The categorize job's galaxy port (PRD omni-loop-7 s3) against a stubbed fetch: no test calls galaxy.
import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { categorizeUrl, galaxyCategorizer } from './galaxy.ts';

const ASK = { workspaceId: 'w-1', productId: 'p-1', question: 'can a quote be sent without a payment term' };
const SECRET = 'shared-fixture-secret';

function stub(answer: () => Response | Promise<Response>) {
  const sent: { url: string; init: RequestInit }[] = [];
  const fetch = (url: string, init: RequestInit) => {
    sent.push({ url, init });
    return Promise.resolve(answer());
  };
  return { fetch, sent };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('categorizeUrl', () => {
  it('is galaxy\'s route on its host', () => {
    expect(categorizeUrl('https://galaxy.example/')).toBe('https://galaxy.example/api/search/categorize');
  });
});

describe('galaxyCategorizer', () => {
  it('posts {workspaceId, productId, question} signed with an HMAC-SHA256 of the exact body, and answers the category', async () => {
    const { fetch, sent } = stub(() => json({ category: 'quotes', decidedBy: 'jev', confidence: 0.9 }));
    expect(await galaxyCategorizer({ url: 'https://galaxy.example/api/search/categorize', secret: SECRET, fetch })(ASK)).toBe('quotes');
    const [call] = sent;
    expect(call?.url).toBe('https://galaxy.example/api/search/categorize');
    const body = call?.init.body as string;
    expect(JSON.parse(body)).toEqual(ASK);
    const headers = call?.init.headers as Record<string, string>;
    expect(headers['x-omni-signature-256']).toBe(`sha256=${createHmac('sha256', SECRET).update(body).digest('hex')}`);
  });

  it('answers null when galaxy kept no category', async () => {
    const { fetch } = stub(() => json({ category: null, decidedBy: null, confidence: null }));
    expect(await galaxyCategorizer({ url: 'https://g.example/x', secret: SECRET, fetch })(ASK)).toBeNull();
  });

  it('calls nothing and answers null with no secret', async () => {
    const { fetch, sent } = stub(() => json({ category: 'quotes' }));
    expect(await galaxyCategorizer({ url: 'https://g.example/x', secret: undefined, fetch })(ASK)).toBeNull();
    expect(sent).toEqual([]);
  });

  it('throws on a refusal, on a reply out of shape and on a failed call, never naming the question', async () => {
    const make = (answer: () => Response | Promise<Response>) => galaxyCategorizer({ url: 'https://g.example/x', secret: SECRET, fetch: stub(answer).fetch })(ASK);
    await expect(make(() => json({ error: 'bad' }, 401))).rejects.toThrow('galaxy answered 401');
    await expect(make(() => json({ nope: 1 }))).rejects.toThrow('out of shape');
    await expect(make(() => new Response('not json'))).rejects.toThrow('out of shape');
    const failing = galaxyCategorizer({ url: 'https://g.example/x', secret: SECRET, fetch: () => Promise.reject(new Error(ASK.question)) })(ASK);
    await expect(failing).rejects.toThrow('could not be reached');
    await expect(failing).rejects.not.toThrow(ASK.question);
  });
});
