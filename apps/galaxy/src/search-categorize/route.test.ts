import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { JevOutcome } from '../jev/client';
import type { JevDecideDeps } from '../jev/resolve';
import type { JevCall, JevDecisionSettings, JevMode } from '../jev/store';
import { SEARCH_CATEGORIZE_SECRET_VAR, SEARCH_CATEGORIZE_SIGNATURE_HEADER, searchCategorizeRoute, type SearchCategorizeDeps } from './route';

vi.mock('server-only', () => ({}));

// `POST /api/search/categorize` (PRD omni-loop-7 s2): the App's job asks the workspace's `search-category`
// decision, signed with an HMAC over the body. A fake world: one workspace and product, Jev as the client
// reports it, and a product of two domains.

const WORKSPACE = '00000000-0000-4000-8000-00000000ac01';
const PRODUCT = '00000000-0000-4000-8000-00000000b001';
const SECRET = 'search-secret';
const QUESTION = 'can a quote go out with no payment term';
const CALL = { workspaceId: WORKSPACE, productId: PRODUCT, question: QUESTION };
const DOMAINS = [{ key: 'quotes', name: 'Quotes' }, { key: 'crm', name: 'CRM' }];

function world({ mode = 'on', answer = 'quotes', jev = true, secret = SECRET, outcome, domains }: {
  mode?: JevMode; answer?: string | number; jev?: boolean; secret?: string | undefined; outcome?: JevOutcome; domains?: () => Promise<typeof DOMAINS>;
} = {}) {
  const asked: { state: unknown; options: string[] }[] = [];
  const logged: JevCall[] = [];
  const lines: string[] = [];
  const deps: JevDecideDeps = {
    settings: (_w, decision): Promise<JevDecisionSettings> => Promise.resolve({ decision, mode, threshold: 0.5, floor: 0.4 }),
    key: () => Promise.resolve({ kind: 'key', key: 'ts-key' }),
    ask: (_key, state, question) => {
      asked.push({ state, options: question.type === 'choice' ? question.options.map((o) => o.key) : [] });
      return Promise.resolve(outcome ?? { kind: 'answered', model: 'jev-1.13.0', answer, confidence: 0.9, probabilities: null, ms: 80 });
    },
    log: (_w, call) => {
      logged.push(call);
      return Promise.resolve();
    },
  };
  const route: SearchCategorizeDeps = {
    secret,
    jev: jev ? deps : null,
    domainsOf: domains ?? (() => Promise.resolve(DOMAINS)),
    log: (line) => lines.push(line),
  };
  return { route, asked, logged, lines };
}

const sign = (body: string, secret = SECRET) => `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

async function send(w: ReturnType<typeof world>, body: unknown = CALL, { signature }: { signature?: string | null } = {}) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  const sig = signature === undefined ? sign(text) : signature;
  const request = new Request('https://galaxy.test/api/search/categorize', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(sig ? { [SEARCH_CATEGORIZE_SIGNATURE_HEADER]: sig } : {}) },
    body: text,
  });
  const response = await searchCategorizeRoute(request, w.route);
  return { status: response.status, body: (await response.json()) as unknown };
}

const NONE = { status: 200, body: { category: null, confidence: null, decidedBy: 'old' } };

describe('POST /api/search/categorize', () => {
  it('refuses a call without a signature, or signed with another secret, and asks nothing', async () => {
    const w = world();
    expect(await send(w, CALL, { signature: null })).toMatchObject({ status: 401 });
    expect(await send(w, CALL, { signature: sign(JSON.stringify(CALL), 'other-secret') })).toMatchObject({ status: 401 });
    expect(w.asked).toEqual([]);
  });

  it('refuses every call where the secret is not set, naming the variable and never the question', async () => {
    const w = world({ secret: '' });
    expect(await send(w)).toMatchObject({ status: 401 });
    expect(w.lines.join('\n')).toContain(SEARCH_CATEGORIZE_SECRET_VAR);
    expect(w.lines.join('\n')).not.toContain(QUESTION);
    expect(w.asked).toEqual([]);
  });

  it('refuses a signed body that is not the wire\'s shape (400) and one past its cap (413)', async () => {
    const w = world();
    expect(await send(w, 'not json')).toMatchObject({ status: 400 });
    expect(await send(w, { ...CALL, workspaceId: 'acme' })).toMatchObject({ status: 400 });
    expect(await send(w, { ...CALL, question: '' })).toMatchObject({ status: 400 });
    expect(await send(w, { ...CALL, extra: 1 })).toMatchObject({ status: 400 });
    expect(await send(w, { ...CALL, question: 'x'.repeat(20_000) })).toMatchObject({ status: 413 });
    expect(w.asked).toEqual([]);
  });

  it('On: answers the product\'s domain Jev chose, asking the product\'s domains and other, the question alone', async () => {
    const w = world({ answer: 'crm' });
    expect(await send(w)).toEqual({ status: 200, body: { category: 'crm', confidence: 0.9, decidedBy: 'jev' } });
    expect(w.asked).toEqual([{ state: QUESTION, options: ['quotes', 'crm', 'other'] }]);
  });

  it('On: answers other when Jev does', async () => {
    expect(await send(world({ answer: 'other' }))).toMatchObject({ status: 200, body: { category: 'other' } });
  });

  it('answers null with the decision Off, without calling Jev', async () => {
    const w = world({ mode: 'off' });
    expect(await send(w)).toEqual(NONE);
    expect(w.asked).toEqual([]);
  });

  it('answers null in Shadow, logging Jev\'s answer beside none', async () => {
    const w = world({ mode: 'shadow' });
    expect(await send(w)).toEqual(NONE);
    expect(w.logged).toEqual([expect.objectContaining({ decision: 'search-category', jevAnswer: 'quotes', oldAnswer: null })]);
  });

  it('answers null with no Jev key, no service role, a failed Jev, or an answer outside the options', async () => {
    expect(await send(world({ jev: false }))).toEqual(NONE);
    expect(await send(world({ outcome: { kind: 'failed', reason: 'timeout', status: null, message: 'Jev timed out.', ms: 5000 } }))).toEqual(NONE);
    expect(await send(world({ answer: 'invoicing' }))).toEqual(NONE);
    const noKey = world();
    noKey.route.jev = { ...(noKey.route.jev as JevDecideDeps), key: () => Promise.resolve({ kind: 'none' }) };
    expect(await send(noKey)).toEqual(NONE);
  });

  it('answers 500 when the domains cannot be read, never logging the question', async () => {
    const w = world({ domains: () => Promise.reject(new Error('db down')) });
    expect(await send(w)).toMatchObject({ status: 500 });
    expect(w.lines.join('\n')).toMatch(/db down/);
    expect(w.lines.join('\n')).not.toContain(QUESTION);
  });

  it('never logs the question in a Jev call', async () => {
    const w = world();
    await send(w);
    expect(JSON.stringify(w.logged)).not.toContain(QUESTION);
  });
});
