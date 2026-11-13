import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { SEARCH_CATEGORIZE_SIGNATURE_HEADER } from '../search-categorize/route';
import { evalSearchRoute, type EvalSearchDeps, type SearchedIds } from './eval-search-route';

vi.mock('server-only', () => ({}));

// `POST /api/search/eval-search` (PRD omni-loop-8 s3): signed, the product's search of a question, top 10.

const WORKSPACE = '00000000-0000-4000-8000-00000000ac01';
const PRODUCT = '00000000-0000-4000-8000-00000000b001';
const SECRET = 'search-secret';
const QUESTION = 'can a quote go out with no payment term';
const CALL = { workspaceId: WORKSPACE, productId: PRODUCT, question: QUESTION };

function world({ found = { ids: ['BL-QUOTES-1', 'BL-CRM-1'], mode: 'meaning' }, secret = SECRET }: { found?: SearchedIds | null; secret?: string } = {}) {
  const lines: string[] = [];
  const search = vi.fn<EvalSearchDeps['search']>(() => Promise.resolve(found));
  const route: EvalSearchDeps = { secret, search, log: (line) => lines.push(line) };
  return { route, lines, search };
}

const sign = (body: string, secret = SECRET) => `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

async function send(w: ReturnType<typeof world>, body: unknown = CALL, { signature }: { signature?: string | null } = {}) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  const sig = signature === undefined ? sign(text) : signature;
  const request = new Request('https://galaxy.test/api/search/eval-search', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(sig ? { [SEARCH_CATEGORIZE_SIGNATURE_HEADER]: sig } : {}) },
    body: text,
  });
  const response = await evalSearchRoute(request, w.route);
  return { status: response.status, body: (await response.json()) as unknown };
}

describe('POST /api/search/eval-search', () => {
  it('refuses a bad or missing signature and searches nothing', async () => {
    const w = world();
    expect(await send(w, CALL, { signature: null })).toMatchObject({ status: 401 });
    expect(await send(w, CALL, { signature: sign(JSON.stringify(CALL), 'other') })).toMatchObject({ status: 401 });
    expect(w.search).not.toHaveBeenCalled();
  });

  it('refuses every call where the secret is not set, never logging the question', async () => {
    const w = world({ secret: '' });
    expect(await send(w)).toMatchObject({ status: 401 });
    expect(w.lines.join('\n')).not.toContain(QUESTION);
  });

  it('refuses a body that is not the wire\'s shape (400) and one past its cap (413)', async () => {
    const w = world();
    expect(await send(w, 'nope')).toMatchObject({ status: 400 });
    expect(await send(w, { ...CALL, productId: 'p' })).toMatchObject({ status: 400 });
    expect(await send(w, { ...CALL, question: ' ' })).toMatchObject({ status: 400 });
    expect(await send(w, { ...CALL, question: 'x'.repeat(301) })).toMatchObject({ status: 400 });
    expect(await send(w, { ...CALL, extra: true })).toMatchObject({ status: 400 });
    expect(await send(w, { ...CALL, question: 'x'.repeat(20_000) })).toMatchObject({ status: 413 });
    expect(w.search).not.toHaveBeenCalled();
  });

  it('answers the ids and the mode of the product\'s search, the question passed through', async () => {
    const w = world();
    expect(await send(w)).toEqual({ status: 200, body: { ids: ['BL-QUOTES-1', 'BL-CRM-1'], mode: 'meaning' } });
    expect(w.search).toHaveBeenCalledWith(WORKSPACE, PRODUCT, QUESTION);
  });

  it('answers at most 10 ids', async () => {
    const ids = Array.from({ length: 20 }, (_, i) => `E-${i}`);
    expect(await send(world({ found: { ids, mode: 'words' } }))).toEqual({ status: 200, body: { ids: ids.slice(0, 10), mode: 'words' } });
  });

  it('answers 404 for a product that is not the workspace\'s and 500 when it cannot be searched', async () => {
    expect(await send(world({ found: null }))).toMatchObject({ status: 404 });
    const w = world();
    w.route.search = () => Promise.reject(new Error('db down'));
    expect(await send(w)).toMatchObject({ status: 500 });
    expect(w.lines.join('\n')).toMatch(/db down/);
    expect(w.lines.join('\n')).not.toContain(QUESTION);
  });
});
