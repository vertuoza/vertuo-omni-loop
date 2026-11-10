import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { AskLaws } from './judge.service';
import { BUSINESS_LAWS_SIGNATURE_HEADER, businessLawsJudgeRoute, MAX_BODY_BYTES, type BusinessLawsRouteDeps, type RepoLaws } from './judge-route';

vi.mock('server-only', () => ({}));

// `POST /api/business-laws/judge` (PRD 2632 s5): omni-app's inbox check judges a phase-0 pull request's spec,
// signed with an HMAC over the body. A fake product reading and a fake model: nothing here calls a database or
// a model; every law and spec is fictional.

const SECRET = 'laws-secret';
const SPEC = '---\nareas: [quotes]\n---\nA template can be sent with a zero total.\n';
const LAW = '## BL-QUOTES-1\nA quote is sent only with a total above zero.\nWhy: An empty quote loses the customer.\n';
const LAWS: RepoLaws = {
  home: 'acme/plan',
  pack: {
    sha: 'c'.repeat(40),
    files: [
      { path: '.omni-loop/config.yml', content: 'kit: 1\nlaws:\n  owners: [ana]\n' },
      { path: '.omni-loop/knowledge/domains/quotes/business-laws.md', content: LAW },
    ],
  },
  glossary: [],
  domains: [{ key: 'quotes', name: 'Quotes' }],
};

const sign = (body: string, secret = SECRET) => `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

function world({ laws = LAWS, ask, unset = false, fail = false }: { laws?: RepoLaws; ask?: AskLaws | null; unset?: boolean; fail?: boolean } = {}) {
  const lines: string[] = [];
  const asked: string[] = [];
  const model: AskLaws = ({ user }) => {
    asked.push(user);
    return Promise.resolve({ ok: true, reply: { findings: [{ law: 'BL-QUOTES-1', quote: 'sent with a zero total', why: 'The design sends a quote whose total is zero.' }] } });
  };
  const deps: BusinessLawsRouteDeps = {
    secret: unset ? undefined : SECRET,
    read: () => (fail ? Promise.reject(new Error('boom\nsecond line')) : Promise.resolve(laws)),
    ask: ask === undefined ? model : ask,
    log: (line) => lines.push(line),
  };
  return { deps, lines, asked };
}

async function send(w: ReturnType<typeof world>, body: unknown = { repo: 'Acme/Plan', spec: SPEC }, { signature }: { signature?: string | null } = {}) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  const sig = signature === undefined ? sign(text) : signature;
  const headers = new Headers(sig === null ? {} : { [BUSINESS_LAWS_SIGNATURE_HEADER]: sig });
  const response = await businessLawsJudgeRoute(new Request('https://galaxy.test/api/business-laws/judge', { method: 'POST', body: text, headers }), w.deps);
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

describe('the refusals', () => {
  it('refuses every call when no secret is set, and says so in the log', async () => {
    const w = world({ unset: true });
    expect((await send(w)).status).toBe(401);
    expect(w.lines.join(' ')).toContain('BUSINESS_LAWS_JUDGE_SECRET');
  });

  it('refuses a missing and a wrong signature', async () => {
    const w = world();
    expect((await send(w, undefined, { signature: null })).status).toBe(401);
    expect((await send(w, undefined, { signature: sign('{"repo":"acme/plan","spec":"x"}', 'other') })).status).toBe(401);
    expect(w.asked).toEqual([]);
  });

  it('refuses a malformed body', async () => {
    const w = world();
    expect((await send(w, 'not json')).status).toBe(400);
    expect((await send(w, { repo: 'nowhere', spec: SPEC })).status).toBe(400);
    expect((await send(w, { repo: 'acme/plan' })).status).toBe(400);
    expect((await send(w, { repo: 'acme/plan', spec: '' })).status).toBe(400);
  });

  it('refuses a body past its cap', async () => {
    const w = world();
    expect((await send(w, { repo: 'acme/plan', spec: 'x'.repeat(MAX_BODY_BYTES) })).status).toBe(413);
  });

  it('refuses with a plain 500 when the laws cannot be read', async () => {
    const w = world({ fail: true });
    const answer = await send(w);
    expect(answer.status).toBe(500);
    expect(w.lines.join(' ')).toContain('boom');
    expect(w.lines.join(' ')).not.toContain('second line');
  });
});

describe('the verdict', () => {
  it('is red with the law, its Why, the quote and the owner when the spec breaks a law', async () => {
    const answer = await send(world());
    expect(answer.status).toBe(200);
    expect(answer.body).toMatchObject({
      state: 'red',
      laws: ['BL-QUOTES-1'],
      findings: [{ law: 'BL-QUOTES-1', why: 'An empty quote loses the customer.', quote: 'sent with a zero total', owners: ['ana'] }],
    });
  });

  it('is green when the model finds nothing', async () => {
    const ask: AskLaws = () => Promise.resolve({ ok: true, reply: { findings: [] } });
    expect((await send(world({ ask }))).body).toMatchObject({ state: 'green' });
  });

  it('drops a quote the spec does not hold', async () => {
    const ask: AskLaws = () => Promise.resolve({ ok: true, reply: { findings: [{ law: 'BL-QUOTES-1', quote: 'never written', why: 'The design sends a quote whose total is zero.' }] } });
    expect((await send(world({ ask }))).body).toMatchObject({ state: 'green', findings: [] });
  });

  it('is neutral with no law home, no pack, no law, no key and a model error', async () => {
    const reasons = async (w: ReturnType<typeof world>) => (await send(w)).body;
    expect(await reasons(world({ laws: { ...LAWS, home: null, pack: null } }))).toMatchObject({ state: 'neutral', reason: 'the repository has no law home' });
    expect(await reasons(world({ laws: { ...LAWS, pack: null } }))).toMatchObject({ state: 'neutral' });
    expect(await reasons(world({ laws: { ...LAWS, pack: { sha: 'a', files: [] } } }))).toMatchObject({ state: 'neutral', reason: 'the law home holds no business law' });
    expect(await reasons(world({ ask: null }))).toMatchObject({ state: 'neutral' });
    const failing: AskLaws = () => Promise.resolve({ ok: false, why: 'it took too long' });
    expect(await reasons(world({ ask: failing }))).toMatchObject({ state: 'neutral' });
  });

  it('names each domain taken with the product\'s name for it', async () => {
    const answer = await send(world());
    expect(answer.body.domains).toEqual([expect.objectContaining({ key: 'quotes', name: 'Quotes' })]);
  });
});
