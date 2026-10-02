// The canon gate's judge port, against a recording fetch: nothing here calls galaxy.
import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { JUDGE_NOT_CONFIGURED, type JudgeRequest } from './canon.ts';
import { constituentJudge, judgeUrl } from './judge.ts';

type Recorded = { url: string; method: string | undefined; body: string; headers: Headers };

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function recordingFetch(answer: () => Response) {
  const requests: Recorded[] = [];
  const fetch = async (input: string, init: RequestInit = {}) => {
    requests.push({ url: String(input), method: init.method, body: String(init.body), headers: new Headers(init.headers) });
    return answer();
  };
  return { fetch, requests };
}

const ASKED: JudgeRequest = Object.freeze({
  repo: 'acme/ux',
  state: { spec: 'x', statement: null, never: [{ id: 'never#1', text: 'Calls real APIs' }], verdict: { broken: true, findings: [] } },
  old: 'true',
  ref: 'PRD 9',
});

describe('judgeUrl — galaxy\'s judge route', () => {
  it('on GALAXY_URL when set, else galaxy\'s production host', () => {
    expect(judgeUrl({ GALAXY_URL: 'https://preview.example/' })).toBe('https://preview.example/api/constituents/judge');
    expect(judgeUrl({})).toBe('https://www.omni-loop.xyz/api/constituents/judge');
  });
});

describe('constituentJudge — one signed call, the answer that counts', () => {
  it('POSTs {repo, state, old, ref} signed with an HMAC-SHA256 over the exact body, and reads `answer`', async () => {
    const galaxy = recordingFetch(() => json({ answer: 'false', confidence: 0.91, decidedBy: 'jev' }));
    const judge = constituentJudge({ url: 'https://g.example/api/constituents/judge', secret: 's3cret', fetch: galaxy.fetch });
    expect(await judge(ASKED)).toEqual({ ok: true, error: null, answer: 'false', confidence: 0.91, decidedBy: 'jev', reason: null });
    const request = galaxy.requests[0]!;
    expect([request.method, request.url]).toEqual(['POST', 'https://g.example/api/constituents/judge']);
    expect(JSON.parse(request.body)).toEqual(ASKED);
    const expected = `sha256=${createHmac('sha256', 's3cret').update(request.body).digest('hex')}`;
    expect(request.headers.get('x-omni-signature-256')).toBe(expected);
  });

  it("today's answer comes back as decided by old, with no confidence", async () => {
    const galaxy = recordingFetch(() => json({ answer: 'true', confidence: null, decidedBy: 'old' }));
    const judge = constituentJudge({ url: 'https://g.example/j', secret: 's', fetch: galaxy.fetch });
    expect(await judge(ASKED)).toMatchObject({ ok: true, answer: 'true', confidence: null, decidedBy: 'old' });
  });

  it('without a secret it calls nothing and says it is not configured', async () => {
    const galaxy = recordingFetch(() => json({}));
    const judge = constituentJudge({ url: 'https://g.example/j', secret: undefined, fetch: galaxy.fetch });
    expect(await judge(ASKED)).toMatchObject({ ok: false, error: JUDGE_NOT_CONFIGURED, reason: 'CONSTITUENT_JUDGE_SECRET is not set' });
    expect(galaxy.requests).toEqual([]);
  });

  it.each([
    ['a refusal', () => json({ error: 'Bad signature.' }, 401), 'galaxy answered 401: Bad signature.'],
    ['a reply without an answer', () => json({ answer: null, confidence: null, decidedBy: null }), 'galaxy answered no verdict'],
    ['a reply that is not JSON', () => new Response('<html>', { status: 200 }), 'galaxy answered no verdict'],
    ['a network failure', () => { throw new Error('socket hang up'); }, 'galaxy could not be reached: socket hang up'],
  ])('a failure on %s, never thrown', async (_, answer, reason) => {
    const judge = constituentJudge({ url: 'https://g.example/j', secret: 's', fetch: recordingFetch(answer).fetch });
    expect(await judge(ASKED)).toMatchObject({ ok: false, error: 'judge', reason });
  });
});
