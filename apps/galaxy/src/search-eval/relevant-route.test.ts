import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { JevOutcome } from '../jev/client';
import type { JevDecideDeps } from '../jev/resolve';
import type { JevCall, JevDecisionSettings, JevMode } from '../jev/store';
import { SEARCH_CATEGORIZE_SIGNATURE_HEADER } from '../search-categorize/route';
import { searchRelevantRoute, type JudgedEntry, type SearchRelevantDeps } from './relevant-route';

vi.mock('server-only', () => ({}));

// `POST /api/search/relevant` (PRD omni-loop-8 s3): signed, the workspace's `search-relevant` decision over each
// entry. A fake world: one product of two entries, and Jev as the client reports it.

const WORKSPACE = '00000000-0000-4000-8000-00000000ac01';
const PRODUCT = '00000000-0000-4000-8000-00000000b001';
const SECRET = 'search-secret';
const QUESTION = 'can a quote go out with no payment term';
const CALL = { workspaceId: WORKSPACE, productId: PRODUCT, question: QUESTION, entryIds: ['BL-QUOTES-1', 'BL-CRM-1'] };
const ENTRIES: JudgedEntry[] = [
  { id: 'BL-QUOTES-1', title: 'A quote needs a payment term', text: 'A quote never leaves without one.' },
  { id: 'BL-CRM-1', title: 'A contact has one owner', text: 'Every contact is owned.' },
];

function world({ mode = 'on', answers = [0.9, 0.2], jev = true, secret = SECRET, outcome, entries = ENTRIES }: {
  mode?: JevMode; answers?: number[]; jev?: boolean; secret?: string | undefined; outcome?: JevOutcome; entries?: JudgedEntry[] | null;
} = {}) {
  const asked: { state: unknown }[] = [];
  const logged: JevCall[] = [];
  const lines: string[] = [];
  const deps: JevDecideDeps = {
    settings: (_w, decision): Promise<JevDecisionSettings> => Promise.resolve({ decision, mode, threshold: 0.5, floor: 0.4 }),
    key: () => Promise.resolve({ kind: 'key', key: 'ts-key' }),
    ask: (_key, state) => {
      const answer = answers[asked.length] ?? 0;
      asked.push({ state });
      return Promise.resolve(outcome ?? { kind: 'answered', model: 'jev-1.13.0', answer, confidence: 0.9, probabilities: null, ms: 80 });
    },
    log: (_w, call) => {
      logged.push(call);
      return Promise.resolve();
    },
  };
  const read = vi.fn((_w: string, _p: string, ids: readonly string[]) => Promise.resolve(entries === null ? null : entries.filter((e) => ids.includes(e.id))));
  const route: SearchRelevantDeps = { secret, jev: jev ? deps : null, entriesOf: read, log: (line) => lines.push(line) };
  return { route, asked, logged, lines, read };
}

const sign = (body: string, secret = SECRET) => `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

async function send(w: ReturnType<typeof world>, body: unknown = CALL, { signature }: { signature?: string | null } = {}) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  const sig = signature === undefined ? sign(text) : signature;
  const request = new Request('https://galaxy.test/api/search/relevant', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(sig ? { [SEARCH_CATEGORIZE_SIGNATURE_HEADER]: sig } : {}) },
    body: text,
  });
  const response = await searchRelevantRoute(request, w.route);
  return { status: response.status, body: (await response.json()) as unknown };
}

const NULLS = { status: 200, body: { verdicts: [{ entryId: 'BL-QUOTES-1', relevant: null, confidence: null }, { entryId: 'BL-CRM-1', relevant: null, confidence: null }] } };

describe('POST /api/search/relevant', () => {
  it('refuses a call without a signature, or signed with another secret, and reads and asks nothing', async () => {
    const w = world();
    expect(await send(w, CALL, { signature: null })).toMatchObject({ status: 401 });
    expect(await send(w, CALL, { signature: sign(JSON.stringify(CALL), 'other-secret') })).toMatchObject({ status: 401 });
    expect(w.asked).toEqual([]);
    expect(w.read).not.toHaveBeenCalled();
  });

  it('refuses every call where the secret is not set, naming the variable and never the question', async () => {
    const w = world({ secret: '' });
    expect(await send(w)).toMatchObject({ status: 401 });
    expect(w.lines.join('\n')).toContain('SEARCH_CATEGORIZE_SECRET');
    expect(w.lines.join('\n')).not.toContain(QUESTION);
  });

  it('refuses a signed body that is not the wire\'s shape (400) and one past its cap (413)', async () => {
    const w = world();
    expect(await send(w, 'not json')).toMatchObject({ status: 400 });
    expect(await send(w, { ...CALL, workspaceId: 'acme' })).toMatchObject({ status: 400 });
    expect(await send(w, { ...CALL, question: '' })).toMatchObject({ status: 400 });
    expect(await send(w, { ...CALL, entryIds: 'BL-QUOTES-1' })).toMatchObject({ status: 400 });
    expect(await send(w, { ...CALL, entryIds: Array.from({ length: 21 }, (_, i) => `E-${i}`) })).toMatchObject({ status: 400 });
    expect(await send(w, { ...CALL, extra: 1 })).toMatchObject({ status: 400 });
    expect(await send(w, { ...CALL, question: 'x'.repeat(20_000) })).toMatchObject({ status: 413 });
    expect(w.asked).toEqual([]);
  });

  it('On: answers each entry\'s verdict with Jev\'s confidence, the question and the entry\'s text alone sent', async () => {
    const w = world();
    expect(await send(w)).toEqual({ status: 200, body: { verdicts: [
      { entryId: 'BL-QUOTES-1', relevant: true, confidence: 0.9 },
      { entryId: 'BL-CRM-1', relevant: false, confidence: 0.9 },
    ] } });
    expect(w.asked).toEqual([
      { state: `Question: ${QUESTION}\nEntry: A quote needs a payment term\nA quote never leaves without one.` },
      { state: `Question: ${QUESTION}\nEntry: A contact has one owner\nEvery contact is owned.` },
    ]);
  });

  it('answers 20 ids in the order sent, null for one the product does not hold', async () => {
    const w = world();
    const ids = ['BL-CRM-1', 'GHOST', 'BL-QUOTES-1'];
    expect(await send(w, { ...CALL, entryIds: ids })).toEqual({ status: 200, body: { verdicts: [
      { entryId: 'BL-CRM-1', relevant: true, confidence: 0.9 },
      { entryId: 'GHOST', relevant: null, confidence: null },
      { entryId: 'BL-QUOTES-1', relevant: false, confidence: 0.9 },
    ] } });
    expect(await send(w, { ...CALL, entryIds: [] })).toEqual({ status: 200, body: { verdicts: [] } });
  });

  it('answers null for every id with the decision Off, without calling Jev', async () => {
    const w = world({ mode: 'off' });
    expect(await send(w)).toEqual(NULLS);
    expect(w.asked).toEqual([]);
  });

  it('answers null in Shadow, logging Jev\'s answer beside none', async () => {
    const w = world({ mode: 'shadow' });
    expect(await send(w)).toEqual(NULLS);
    expect(w.logged).toEqual([
      expect.objectContaining({ decision: 'search-relevant', jevAnswer: 'true', oldAnswer: null }),
      expect.objectContaining({ decision: 'search-relevant', jevAnswer: 'false', oldAnswer: null }),
    ]);
  });

  it('answers null with no Jev key, no service role, a failed Jev, or an answer outside the question', async () => {
    expect(await send(world({ jev: false }))).toEqual(NULLS);
    expect(await send(world({ outcome: { kind: 'failed', reason: 'timeout', status: null, message: 'Jev timed out.', ms: 5000 } }))).toEqual(NULLS);
    expect(await send(world({ answers: [5, 5] }))).toEqual(NULLS);
    const noKey = world();
    noKey.route.jev = { ...(noKey.route.jev as JevDecideDeps), key: () => Promise.resolve({ kind: 'none' }) };
    expect(await send(noKey)).toEqual(NULLS);
  });

  it('answers 404 for a product that is not the workspace\'s and 500 when its knowledge cannot be read', async () => {
    expect(await send(world({ entries: null }))).toMatchObject({ status: 404 });
    const w = world();
    w.route.entriesOf = () => Promise.reject(new Error('db down'));
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
