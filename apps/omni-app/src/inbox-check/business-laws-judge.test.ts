// The inbox check's business laws judge port, against a recording fetch: nothing here calls galaxy.
import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { assertDefined } from 'omni-loop/kit/test/assert.ts';
import { readEnv } from '../env.ts';
import { businessLawsJudge, businessLawsJudgeUrl } from './business-laws-judge.ts';

/** Any value, as `String` prints it: a request body is whatever the port sent. */
const printed = (value: unknown) => String(value);

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function recordingFetch(answer: () => Response) {
  const requests: { url: string; body: string; headers: Headers }[] = [];
  const fetch = (url: string, init: RequestInit = {}) =>
    new Promise<Response>((resolve) => {
      requests.push({ url, body: printed(init.body), headers: new Headers(init.headers) });
      resolve(answer());
    });
  return { fetch, requests };
}

const FINDING = { law: 'BL-QUOTES-1', statement: 'A quote is sent only with a total above zero.', why: 'An empty quote loses the customer.', quote: 'sent with a zero total', owners: ['ana', 'bo'] };
const RED = { state: 'red', reason: '1 law broken', laws: ['BL-QUOTES-1'], domains: [{ key: 'quotes', name: 'Quotes' }], findings: [FINDING] };
const ASKED = { repo: 'acme/plan', spec: 'A template can be sent with a zero total.' };

describe('businessLawsJudgeUrl', () => {
  it('is on GALAXY_URL when set, else galaxy\'s production host', () => {
    expect(businessLawsJudgeUrl(readEnv({ GALAXY_URL: 'https://preview.example/' }).galaxyUrl)).toBe('https://preview.example/api/business-laws/judge');
    expect(businessLawsJudgeUrl(readEnv({}).galaxyUrl)).toBe('https://www.omni-loop.xyz/api/business-laws/judge');
  });
});

describe('businessLawsJudge', () => {
  it('POSTs {repo, spec} signed with an HMAC-SHA256 over the exact body', async () => {
    const galaxy = recordingFetch(() => json(RED));
    await businessLawsJudge({ url: 'https://g.example/j', secret: 's3cret', fetch: galaxy.fetch }).grade(ASKED);
    const request = galaxy.requests[0];
    assertDefined(request, 'request');
    expect(JSON.parse(request.body)).toEqual(ASKED);
    expect(request.headers.get('x-omni-signature-256')).toBe(`sha256=${createHmac('sha256', 's3cret').update(request.body).digest('hex')}`);
  });

  it('a red is a not-ok gate with the law, its Why, the quote and the owners', async () => {
    const gate = await businessLawsJudge({ url: 'u', secret: 's', fetch: recordingFetch(() => json(RED)).fetch }).grade(ASKED);
    expect(gate).toEqual({
      name: 'business laws',
      ok: false,
      title: 'business laws ✗ 1',
      reason: '1 law broken: BL-QUOTES-1',
      details: [
        'BL-QUOTES-1: A quote is sent only with a total above zero.',
        'Why: An empty quote loses the customer.',
        'The spec says: "sent with a zero total"',
        'Owner: @ana or @bo',
      ],
    });
  });

  it('a green says what it judged', async () => {
    const green = { state: 'green', reason: '12 judged', laws: Array.from({ length: 12 }, (_, i) => `BL-QUOTES-${i + 1}`), domains: [{ key: 'quotes', name: 'Quotes' }, { key: 'invoicing' }], findings: [] };
    const gate = await businessLawsJudge({ url: 'u', secret: 's', fetch: recordingFetch(() => json(green)).fetch }).grade(ASKED);
    expect(gate).toEqual({ name: 'business laws', ok: true, reason: '12 judged · Quotes, invoicing' });
  });

  it('a neutral verdict is a neutral gate with its why', async () => {
    const neutral = { state: 'neutral', reason: 'the repository has no law home', laws: [], domains: [], findings: [] };
    const gate = await businessLawsJudge({ url: 'u', secret: 's', fetch: recordingFetch(() => json(neutral)).fetch }).grade(ASKED);
    expect(gate).toEqual({ name: 'business laws', ok: true, neutral: true, reason: 'not judged: the repository has no law home' });
  });

  it('without a secret it calls nothing and is neutral', async () => {
    const galaxy = recordingFetch(() => json(RED));
    const gate = await businessLawsJudge({ url: 'u', secret: undefined, fetch: galaxy.fetch }).grade(ASKED);
    expect(gate).toMatchObject({ ok: true, neutral: true });
    expect(gate.reason).toContain('BUSINESS_LAWS_JUDGE_SECRET');
    expect(galaxy.requests).toEqual([]);
  });

  it.each([
    ['a refusal', () => json({ error: 'Bad signature.' }, 401), 'not judged: galaxy answered 401: Bad signature.'],
    ['a failure', () => json({}, 500), 'not judged: galaxy answered 500'],
    ['a reply out of shape', () => json({ state: 'maybe' }), 'not judged: galaxy answered no verdict'],
    ['a reply that is not JSON', () => new Response('<html>', { status: 200 }), 'not judged: galaxy answered no verdict'],
    ['a red with no finding', () => json({ ...RED, findings: [] }), 'not judged: galaxy answered a red with no finding'],
    ['a network failure', () => { throw new Error('socket hang up'); }, 'not judged: galaxy could not be reached: socket hang up'],
  ])('%s is never red: a neutral gate', async (_, answer, reason) => {
    const gate = await businessLawsJudge({ url: 'u', secret: 's', fetch: recordingFetch(answer).fetch }).grade(ASKED);
    expect(gate).toEqual({ name: 'business laws', ok: true, neutral: true, reason });
  });
});
