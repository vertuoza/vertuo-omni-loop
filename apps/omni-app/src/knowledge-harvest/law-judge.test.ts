// The harvest's law judge port (PRD 1342 s5), against a recording fetch: nothing here calls galaxy.
import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { assertDefined } from 'vertuo-omni-plan/kit/test/assert.ts';
import type { LawQuestion } from 'vertuo-omni-plan/kit/lib/knowledge/pipeline.ts';
import { readEnv } from '../env.ts';
import { lawJudge, lawJudgeUrl } from './law-judge.ts';

type Recorded = { url: string; method: string | undefined; body: string; headers: Headers };

/** The body the port sent, as these tests read it. */
const sent = (body: string) => JSON.parse(body) as { state: Record<string, unknown>; old: string };

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function recordingFetch(answer: () => Response | Promise<Response>) {
  const requests: Recorded[] = [];
  const fetch = async (input: string, init: RequestInit = {}) => {
    requests.push({ url: input, method: init.method, body: typeof init.body === 'string' ? init.body : '', headers: new Headers(init.headers) });
    return answer();
  };
  return { fetch, requests };
}

const QUESTION: LawQuestion = Object.freeze({
  id: 's1-02-set-secret',
  old: true,
  state: { statement: 'A secret is set in the console.', why: 'a provable rule', principle: 'new: Secrets never live in the repository.', domain: 'product', prdTitle: 'Widgets that remember' },
});
const ASKED = { repo: 'acme/widgets', ref: 'PRD 42 s1-02-set-secret' };
const JUDGE_URL = 'https://g.example/api/laws/judge';

describe("lawJudgeUrl — galaxy's law judge route", () => {
  it("on GALAXY_URL when set, else galaxy's production host", () => {
    expect(lawJudgeUrl(readEnv({ GALAXY_URL: 'https://preview.example/' }).galaxyUrl)).toBe('https://preview.example/api/laws/judge');
    expect(lawJudgeUrl(readEnv({}).galaxyUrl)).toBe('https://www.omni-loop.xyz/api/laws/judge');
  });
});

describe('lawJudge — one signed call, Jev\'s answer when it counted', () => {
  it('POSTs {repo, state, old, ref} signed with an HMAC-SHA256 over the exact body under the law judge secret', async () => {
    const galaxy = recordingFetch(() => json({ answer: 'false', confidence: 0.91, decidedBy: 'jev' }));
    const judge = lawJudge({ url: JUDGE_URL, secret: 's3cret', fetch: galaxy.fetch });
    expect(await judge(QUESTION, ASKED)).toEqual({ worth: { worth: false, decidedBy: 'Jev', confidence: 0.91 }, reason: null });
    const request = galaxy.requests[0];
    assertDefined(request, 'the request');
    expect([request.method, request.url]).toEqual(['POST', JUDGE_URL]);
    expect(JSON.parse(request.body)).toEqual({ repo: 'acme/widgets', state: QUESTION.state, old: 'true', ref: 'PRD 42 s1-02-set-secret' });
    expect(request.headers.get('content-type')).toBe('application/json');
    expect(request.headers.get('x-omni-signature-256')).toBe(`sha256=${createHmac('sha256', 's3cret').update(request.body).digest('hex')}`);
  });

  it('sends exactly the five state fields, whatever else the question carries', async () => {
    const galaxy = recordingFetch(() => json({ answer: 'true', confidence: 0.8, decidedBy: 'jev' }));
    const judge = lawJudge({ url: JUDGE_URL, secret: 's', fetch: galaxy.fetch });
    const extra = { ...QUESTION, state: { ...QUESTION.state, secret: 'no' } } as LawQuestion;
    await judge(extra, ASKED);
    const request = galaxy.requests[0];
    assertDefined(request, 'the request');
    expect(Object.keys(sent(request.body).state).sort()).toEqual(['domain', 'prdTitle', 'principle', 'statement', 'why']);
  });

  it("a yes counts as a yes, and old's false is sent as \"false\"", async () => {
    const galaxy = recordingFetch(() => json({ answer: 'true', confidence: 0.75, decidedBy: 'jev' }));
    const judge = lawJudge({ url: JUDGE_URL, secret: 's', fetch: galaxy.fetch });
    expect(await judge({ ...QUESTION, old: false }, ASKED)).toEqual({ worth: { worth: true, decidedBy: 'Jev', confidence: 0.75 }, reason: null });
    expect(sent(galaxy.requests[0]?.body ?? '{}').old).toBe('false');
  });

  it("today's answer (decided by old) leaves the classifier's answer to count", async () => {
    const galaxy = recordingFetch(() => json({ answer: 'true', confidence: null, decidedBy: 'old' }));
    expect(await lawJudge({ url: JUDGE_URL, secret: 's', fetch: galaxy.fetch })(QUESTION, ASKED)).toEqual({ worth: null, reason: 'galaxy kept the classifier\'s answer' });
  });

  it('Jev with no confidence is read as not counted', async () => {
    const galaxy = recordingFetch(() => json({ answer: 'true', confidence: null, decidedBy: 'jev' }));
    expect((await lawJudge({ url: JUDGE_URL, secret: 's', fetch: galaxy.fetch })(QUESTION, ASKED)).worth).toBeNull();
  });

  it('with no secret, calls nothing and says so', async () => {
    const galaxy = recordingFetch(() => json({ answer: 'true', confidence: 0.9, decidedBy: 'jev' }));
    expect(await lawJudge({ url: JUDGE_URL, secret: undefined, fetch: galaxy.fetch })(QUESTION, ASKED)).toEqual({ worth: null, reason: 'LAW_JUDGE_SECRET is not set' });
    expect(galaxy.requests).toEqual([]);
  });

  it('a refusal falls back, naming the status and the error galaxy gave', async () => {
    const galaxy = recordingFetch(() => json({ error: 'Bad signature.' }, 401));
    expect(await lawJudge({ url: JUDGE_URL, secret: 's', fetch: galaxy.fetch })(QUESTION, ASKED)).toEqual({ worth: null, reason: 'galaxy answered 401: Bad signature.' });
  });

  it('a refusal with no readable body falls back, naming the status', async () => {
    const galaxy = recordingFetch(() => new Response('oops', { status: 500 }));
    expect(await lawJudge({ url: JUDGE_URL, secret: 's', fetch: galaxy.fetch })(QUESTION, ASKED)).toEqual({ worth: null, reason: 'galaxy answered 500' });
  });

  it('a reply with no verdict falls back', async () => {
    const galaxy = recordingFetch(() => json({ answer: 'maybe' }));
    expect(await lawJudge({ url: JUDGE_URL, secret: 's', fetch: galaxy.fetch })(QUESTION, ASKED)).toEqual({ worth: null, reason: 'galaxy answered no verdict' });
  });

  it('a network failure falls back and never throws', async () => {
    const galaxy = recordingFetch(() => Promise.reject(new Error('ECONNRESET')));
    expect(await lawJudge({ url: JUDGE_URL, secret: 's', fetch: galaxy.fetch })(QUESTION, ASKED)).toEqual({ worth: null, reason: 'galaxy could not be reached: ECONNRESET' });
  });

  it('gives up after its timeout', async () => {
    const fetch = (_url: string, init: RequestInit = {}) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          reject(new Error('timed out'));
        });
      });
    expect((await lawJudge({ url: JUDGE_URL, secret: 's', fetch, timeoutMs: 5 })(QUESTION, ASKED)).reason).toBe('galaxy could not be reached: timed out');
  });
});
