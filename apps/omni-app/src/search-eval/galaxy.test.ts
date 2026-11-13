// The search eval jobs' galaxy ports (PRD omni-loop-8 s4) against a stubbed fetch: no test calls galaxy.
import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { evalSearchUrl, galaxyEvalSearcher, galaxyJudge, RELEVANT_MAX, relevantUrl } from './galaxy.ts';

const SECRET = 'shared-fixture-secret';
const ASK = { workspaceId: 'w-1', productId: 'p-1', question: 'can a quote be sent without a payment term' };

function stub(answer: () => Response | Promise<Response>) {
  const sent: { url: string; init: RequestInit }[] = [];
  const fetch = (url: string, init: RequestInit) => {
    sent.push({ url, init });
    return Promise.resolve(answer());
  };
  return { fetch, sent };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('the urls', () => {
  it('are galaxy\'s routes on its host', () => {
    expect(relevantUrl('https://galaxy.example/')).toBe('https://galaxy.example/api/search/relevant');
    expect(evalSearchUrl('https://galaxy.example/')).toBe('https://galaxy.example/api/search/eval-search');
  });
});

describe('galaxyJudge', () => {
  const url = 'https://galaxy.example/api/search/relevant';

  it('posts {workspaceId, productId, question, entryIds} signed over the exact body and answers the verdicts', async () => {
    const { fetch, sent } = stub(() => json({ verdicts: [{ entryId: 'BR-1', relevant: true, confidence: 0.9 }, { entryId: 'BR-2', relevant: null, confidence: 0 }] }));
    const verdicts = await galaxyJudge({ url, secret: SECRET, fetch })({ ...ASK, entryIds: ['BR-1', 'BR-2'] });
    expect(verdicts).toEqual([
      { entryId: 'BR-1', relevant: true, confidence: 0.9 },
      { entryId: 'BR-2', relevant: null, confidence: 0 },
    ]);
    const [call] = sent;
    expect(call?.url).toBe(url);
    const body = call?.init.body as string;
    expect(JSON.parse(body)).toEqual({ ...ASK, entryIds: ['BR-1', 'BR-2'] });
    expect((call?.init.headers as Record<string, string>)['x-omni-signature-256']).toBe(`sha256=${createHmac('sha256', SECRET).update(body).digest('hex')}`);
  });

  it('reads a missing confidence as 0', async () => {
    const { fetch } = stub(() => json({ verdicts: [{ entryId: 'BR-1', relevant: null }] }));
    expect(await galaxyJudge({ url, secret: SECRET, fetch })({ ...ASK, entryIds: ['BR-1'] })).toEqual([{ entryId: 'BR-1', relevant: null, confidence: 0 }]);
  });

  it('calls nothing with no secret, and nothing for no entry', async () => {
    const { fetch, sent } = stub(() => json({ verdicts: [] }));
    expect(await galaxyJudge({ url, secret: undefined, fetch })({ ...ASK, entryIds: ['BR-1'] })).toBeNull();
    expect(await galaxyJudge({ url, secret: SECRET, fetch })({ ...ASK, entryIds: [] })).toEqual([]);
    expect(sent).toEqual([]);
  });

  it('refuses more than 20 entries a call', async () => {
    const { fetch, sent } = stub(() => json({ verdicts: [] }));
    const entryIds = Array.from({ length: RELEVANT_MAX + 1 }, (_, i) => `BR-${String(i)}`);
    await expect(galaxyJudge({ url, secret: SECRET, fetch })({ ...ASK, entryIds })).rejects.toThrow('at most 20 entries');
    expect(sent).toEqual([]);
  });

  it('throws on a refusal, an answer out of shape and a failed call, never naming the question', async () => {
    const ask = { ...ASK, entryIds: ['BR-1'] };
    const make = (answer: () => Response | Promise<Response>) => galaxyJudge({ url, secret: SECRET, fetch: stub(answer).fetch })(ask);
    await expect(make(() => json({}, 401))).rejects.toThrow('relevant: galaxy answered 401');
    await expect(make(() => json({ verdicts: [{ entryId: 'BR-1', relevant: 'yes' }] }))).rejects.toThrow('relevant: galaxy answered out of shape');
    await expect(make(() => new Response('not json'))).rejects.toThrow('out of shape');
    const failure = await make(() => Promise.reject(new Error(ASK.question))).catch((error: unknown) => error);
    expect(failure).toEqual(new Error('relevant: galaxy could not be reached'));
  });
});

describe('galaxyEvalSearcher', () => {
  const url = 'https://galaxy.example/api/search/eval-search';

  it('posts {workspaceId, productId, question} signed over the exact body and answers the ranked ids', async () => {
    const { fetch, sent } = stub(() => json({ ids: ['BR-2', 'BR-1'], mode: 'hybrid' }));
    expect(await galaxyEvalSearcher({ url, secret: SECRET, fetch })(ASK)).toEqual(['BR-2', 'BR-1']);
    const body = sent[0]?.init.body as string;
    expect(JSON.parse(body)).toEqual(ASK);
    expect((sent[0]?.init.headers as Record<string, string>)['x-omni-signature-256']).toBe(`sha256=${createHmac('sha256', SECRET).update(body).digest('hex')}`);
  });

  it('calls nothing and answers null with no secret', async () => {
    const { fetch, sent } = stub(() => json({ ids: [] }));
    expect(await galaxyEvalSearcher({ url, secret: undefined, fetch })(ASK)).toBeNull();
    expect(sent).toEqual([]);
  });

  it('throws on a refusal, an answer out of shape and a failed call', async () => {
    const make = (answer: () => Response | Promise<Response>) => galaxyEvalSearcher({ url, secret: SECRET, fetch: stub(answer).fetch })(ASK);
    await expect(make(() => json({}, 500))).rejects.toThrow('eval-search: galaxy answered 500');
    await expect(make(() => json({ ids: 'BR-1' }))).rejects.toThrow('eval-search: galaxy answered out of shape');
    await expect(make(() => Promise.reject(new Error('down')))).rejects.toThrow('eval-search: galaxy could not be reached');
  });
});
