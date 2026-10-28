import { describe, expect, it, vi } from 'vitest';
import { getRewindFacts, postFindingOutcome, postRewindFindings, type RewindDeps } from './rewind.controller';
import type { RewindService } from './rewind.service';

// The rewind's calls at their HTTP edge (PRD 2410, s5): signed out is 401 and nothing is read, a malformed
// query or body is 400 naming the problem, and the service's refusals keep their status.

const FINDING = { check: 'ci', origin: 'repository', happened: 'Red and merged.', evidence: ['https://a.test/1'], fix: 'Require the lint.' };

function deps(service: Partial<RewindService> = {}, { signedIn = true }: { signedIn?: boolean } = {}) {
  const log = vi.fn();
  const facts = vi.fn(() => Promise.resolve({ ok: true as const, value: { watches: [], breaks: [], findings: [] } }));
  const propose = vi.fn(() => Promise.resolve({ ok: true as const, value: { added: 1 } }));
  const outcome = vi.fn(() => Promise.resolve({ ok: true as const, value: { outcome: 'proposed' as const } }));
  const connect = () => ({
    auth: { getUser: () => Promise.resolve({ data: signedIn ? { user: { id: 'u1' } } : { user: null }, error: signedIn ? null : { message: 'no' } }) },
    service: { facts, propose, outcome, ...service },
  });
  const live: RewindDeps = { connect, log };
  return { deps: live, facts, propose, outcome, log };
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

describe('POST /api/rewind/findings/<id>/outcome (PRD 2498, s2)', () => {
  const ID = '6f1c1b1e-8a0e-4c1f-9d55-2c1f7b0e9a11';
  const send = (body: unknown, id = ID, headers: Record<string, string> = { authorization: 'Bearer t' }) =>
    postFindingOutcome(new Request(`https://omni.test/api/rewind/findings/${id}/outcome`, { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) }), id, deps().deps);

  it('records the outcome of a signed-in caller', async () => {
    const run = deps();
    const request = new Request('https://omni.test/x', { method: 'POST', headers: { authorization: 'Bearer t' }, body: JSON.stringify({ outcome: 'proposed', pr: 42 }) });
    const response = await postFindingOutcome(request, ID, run.deps);
    expect([response.status, await response.json()]).toEqual([200, { outcome: 'proposed' }]);
    expect(run.outcome).toHaveBeenCalledWith(ID, { outcome: 'proposed', pr: 42 });
  });

  it('answers 401 when signed out and 503 with no database, reading nothing', async () => {
    const out = deps({}, { signedIn: false });
    const request = () => new Request('https://omni.test/x', { method: 'POST', headers: { authorization: 'Bearer t' }, body: JSON.stringify({ outcome: 'asks', note: 'Why?' }) });
    expect((await postFindingOutcome(request(), ID, out.deps)).status).toBe(401);
    expect(out.outcome).not.toHaveBeenCalled();
    expect((await postFindingOutcome(request(), ID, { connect: null, log: vi.fn() })).status).toBe(503);
  });

  it.each([
    ['no JSON', 'nope'],
    ['an unknown outcome', { outcome: 'done' }],
    ['a pull request of zero', { outcome: 'proposed', pr: 0 }],
    ['a field it does not know', { outcome: 'asks', note: 'Why?', extra: 1 }],
    ['a blank note', { outcome: 'asks', note: '  ' }],
  ])('answers 400 to %s, recording nothing', async (_, body) => {
    const run = deps();
    const request = new Request('https://omni.test/x', { method: 'POST', headers: { authorization: 'Bearer t' }, body: typeof body === 'string' ? body : JSON.stringify(body) });
    expect((await postFindingOutcome(request, ID, run.deps)).status).toBe(400);
    expect(run.outcome).not.toHaveBeenCalled();
  });

  it('answers 404 to an id that is no finding\'s', async () => {
    expect((await send({ outcome: 'asks', note: 'Why?' }, 'not-an-id')).status).toBe(404);
  });

  it('answers 413 to a body that is too large', async () => {
    expect((await send({ outcome: 'asks', note: 'x'.repeat(9000) })).status).toBe(413);
  });

  it('keeps the service\'s refusal: 404 no finding, 409 a second outcome or not approved, 403 not a member', async () => {
    const body = { outcome: 'already', note: 'playbook/testing#x' };
    for (const [kind, status] of [['missing', 404], ['recorded', 409], ['unapproved', 409], ['not-allowed', 403]] as const) {
      const run = deps({ outcome: () => Promise.resolve({ ok: false as const, kind, error: `no ${kind}` }) });
      const request = new Request('https://omni.test/x', { method: 'POST', headers: { authorization: 'Bearer t' }, body: JSON.stringify(body) });
      const response = await postFindingOutcome(request, ID, run.deps);
      expect([response.status, await response.json()]).toEqual([status, { error: `no ${kind}` }]);
    }
  });

  it('logs a failure and answers 500 without its words', async () => {
    const run = deps({ outcome: () => Promise.reject(new Error('db down')) });
    const request = new Request('https://omni.test/x', { method: 'POST', headers: { authorization: 'Bearer t' }, body: JSON.stringify({ outcome: 'asks', note: 'Why?' }) });
    const response = await postFindingOutcome(request, ID, run.deps);
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('db down');
    expect(run.log).toHaveBeenCalledWith('rewind outcome: db down');
  });
});
