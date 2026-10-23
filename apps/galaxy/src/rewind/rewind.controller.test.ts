import { describe, expect, it, vi } from 'vitest';
import { getRewindFacts, postRewindFindings, type RewindDeps } from './rewind.controller';
import type { RewindService } from './rewind.service';

// The rewind's calls at their HTTP edge (PRD 2410, s5): signed out is 401 and nothing is read, a malformed
// query or body is 400 naming the problem, and the service's refusals keep their status.

const FINDING = { check: 'ci', origin: 'repository', happened: 'Red and merged.', evidence: ['https://a.test/1'], fix: 'Require the lint.' };

function deps(service: Partial<RewindService> = {}, { signedIn = true }: { signedIn?: boolean } = {}) {
  const log = vi.fn();
  const facts = vi.fn(() => Promise.resolve({ ok: true as const, value: { watches: [], breaks: [], findings: [] } }));
  const propose = vi.fn(() => Promise.resolve({ ok: true as const, value: { added: 1 } }));
  const connect = () => ({
    auth: { getUser: () => Promise.resolve({ data: signedIn ? { user: { id: 'u1' } } : { user: null }, error: signedIn ? null : { message: 'no' } }) },
    service: { facts, propose, ...service },
  });
  const live: RewindDeps = { connect, log };
  return { deps: live, facts, propose, log };
}

const get = (query: string) => new Request(`https://omni.test/api/rewind/facts?${query}`, { headers: { authorization: 'Bearer t' } });
const post = (body: unknown, headers: Record<string, string> = { authorization: 'Bearer t' }) =>
  new Request('https://omni.test/api/rewind/findings', { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) });

describe('GET /api/rewind/facts', () => {
  it('answers the service\'s facts to a signed-in caller', async () => {
    const run = deps();
    const response = await getRewindFacts(get('repo=acme/widgets&prd=7'), run.deps);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ watches: [], breaks: [], findings: [] });
    expect(run.facts).toHaveBeenCalledWith('acme/widgets', 7);
  });

  it('answers 401 when signed out, and 503 with no database', async () => {
    const out = deps({}, { signedIn: false });
    expect((await getRewindFacts(get('repo=acme/widgets&prd=7'), out.deps)).status).toBe(401);
    expect(out.facts).not.toHaveBeenCalled();
    expect((await getRewindFacts(get('repo=acme/widgets&prd=7'), { connect: null, log: vi.fn() })).status).toBe(503);
  });

  it.each(['', 'repo=acme/widgets', 'repo=nope&prd=7', 'repo=acme/widgets&prd=0', 'repo=acme/widgets&prd=x'])('answers 400 to the query %j', async (query) => {
    const run = deps();
    expect((await getRewindFacts(get(query), run.deps)).status).toBe(400);
    expect(run.facts).not.toHaveBeenCalled();
  });

  it('logs a failure and answers 500 without its words', async () => {
    const run = deps({ facts: () => Promise.reject(new Error('db down')) });
    const response = await getRewindFacts(get('repo=acme/widgets&prd=7'), run.deps);
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('db down');
    expect(run.log).toHaveBeenCalledWith('rewind facts: db down');
  });
});

describe('POST /api/rewind/findings', () => {
  it('proposes the findings of a signed-in caller', async () => {
    const run = deps();
    const response = await postRewindFindings(post({ repo: 'acme/widgets', prd: 7, findings: [FINDING] }), run.deps);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ added: 1 });
    expect(run.propose).toHaveBeenCalledWith('acme/widgets', 7, [FINDING]);
  });

  it('answers 401 when signed out, before reading the body', async () => {
    const run = deps({}, { signedIn: false });
    expect((await postRewindFindings(post({}), run.deps)).status).toBe(401);
    expect((await postRewindFindings(post({}, {}), run.deps)).status).toBe(401);
    expect(run.propose).not.toHaveBeenCalled();
  });

  it.each([
    ['no evidence', { ...FINDING, evidence: [] }],
    ['an unknown origin', { ...FINDING, origin: 'production' }],
    ['an unknown check', { ...FINDING, check: 'vibes' }],
    ['evidence that is no https link', { ...FINDING, evidence: ['http://a.test'] }],
  ])('answers 400 to a finding with %s', async (_, bad) => {
    const run = deps();
    const response = await postRewindFindings(post({ repo: 'acme/widgets', prd: 7, findings: [bad] }), run.deps);
    expect(response.status).toBe(400);
    expect(run.propose).not.toHaveBeenCalled();
  });

  it('answers 400 to a body that is no object or names no findings', async () => {
    const run = deps();
    expect((await postRewindFindings(post('nope'), run.deps)).status).toBe(400);
    expect((await postRewindFindings(post({ repo: 'acme/widgets', prd: 7, findings: [] }), run.deps)).status).toBe(400);
  });

  it('keeps the service\'s refusal: 404 no watch, 409 already proposed', async () => {
    const missing = deps({ propose: () => Promise.resolve({ ok: false as const, kind: 'missing' as const, error: 'No watch.' }) });
    const body = { repo: 'acme/widgets', prd: 7, findings: [FINDING] };
    const gone = await postRewindFindings(post(body), missing.deps);
    expect([gone.status, await gone.json()]).toEqual([404, { error: 'No watch.' }]);
    const twice = deps({ propose: () => Promise.resolve({ ok: false as const, kind: 'duplicate' as const, error: 'Finding 1 (ci, repository) was already proposed for PRD 7.' }) });
    expect((await postRewindFindings(post(body), twice.deps)).status).toBe(409);
  });
});
