import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { JevOutcome } from '../client';
import { openSecret } from '../secret-box';
import { JevStoreError, type SealedKey } from '../store';
import { KEY_CHECK, NOT_AVAILABLE, ONLY_OWNER, keyCheck, removeKeyRoute, saveKeyRoute, testRefusal, type KeyRouteDeps } from './api';

// Settings › Jev's key routes with fakes (PRD 812 s1): a key is stored only after one test call
// answered, sealed; a refused test stores nothing and says TypeSafe's reason; a non-owner's key is never
// sent to TypeSafe; without SECRETS_MASTER_KEY nothing can be saved.

const MASTER = randomBytes(32);
const W = 'ws-1';
const KEY = 'ts_live_0123456789abcdef1a2b';
const ANSWERED: JevOutcome = { kind: 'answered', model: 'jev-1.13.0', answer: 0.5, confidence: 0.9, probabilities: null, ms: 120 };
const REFUSED: JevOutcome = { kind: 'failed', reason: 'status', status: 401, message: 'Invalid API key', ms: 90 };

function fakeStore({ owner = true, refuse }: { owner?: boolean; refuse?: string } = {}) {
  const saved: Array<[string, SealedKey]> = [];
  const removed: string[] = [];
  const store = {
    async isOwner() { return owner; },
    async setKey(workspace: string, sealed: SealedKey) {
      if (refuse) throw new JevStoreError('save the Jev key', refuse, 'no');
      saved.push([workspace, sealed]);
      return { stored: true, lastFour: sealed.lastFour, setAt: '2026-09-30T10:00:00Z' };
    },
    async removeKey(workspace: string) {
      if (refuse) throw new JevStoreError('remove the Jev key', refuse, 'no');
      removed.push(workspace);
    },
  };
  return { store, saved, removed };
}

function deps(over: Partial<KeyRouteDeps> & { outcome?: JevOutcome } = {}) {
  const tested: string[] = [];
  const { store, saved, removed } = fakeStore();
  const d: KeyRouteDeps = {
    store: async () => store,
    master: () => MASTER,
    test: async (key) => { tested.push(key); return over.outcome ?? ANSWERED; },
    ...over,
  };
  return { deps: d, tested, saved, removed };
}

const post = (body: unknown, method = 'POST') =>
  new Request('https://galaxy.test/api/jev/key', { method, headers: { 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) });

describe('POST /api/jev/key', () => {
  it('tests the key once, then stores it sealed, and answers only its last four', async () => {
    const { deps: d, tested, saved } = deps();
    const res = await saveKeyRoute(post({ workspace: W, key: `  ${KEY} ` }), d);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ key: { stored: true, lastFour: '1a2b', setAt: '2026-09-30T10:00:00Z' } });
    expect(JSON.stringify(body)).not.toContain(KEY);
    expect(tested).toEqual([KEY]);
    expect(saved).toHaveLength(1);
    const [[workspace, sealed]] = saved;
    expect(workspace).toBe(W);
    expect(sealed.ciphertext).not.toContain(KEY);
    expect(openSecret(sealed, MASTER)).toBe(KEY);
  });

  it('stores nothing when TypeSafe refuses the test call, and says TypeSafe\'s reason', async () => {
    const { deps: d, saved } = deps({ outcome: REFUSED });
    const res = await saveKeyRoute(post({ workspace: W, key: KEY }), d);
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: 'TypeSafe refused this key: Invalid API key' });
    expect(saved).toEqual([]);
  });

  it('stores nothing on a timeout, a network error or an answer outside the schema', async () => {
    for (const reason of ['timeout', 'network', 'schema'] as const) {
      const { deps: d, saved } = deps({ outcome: { kind: 'failed', reason, status: null, message: 'x', ms: 5000 } });
      const res = await saveKeyRoute(post({ workspace: W, key: KEY }), d);
      expect(res.status, reason).toBe(422);
      expect(saved, reason).toEqual([]);
    }
  });

  it('never sends a non-owner\'s key to TypeSafe', async () => {
    const { store, saved } = fakeStore({ owner: false });
    const { deps: d, tested } = deps({ store: async () => store });
    const res = await saveKeyRoute(post({ workspace: W, key: KEY }), d);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: ONLY_OWNER });
    expect(tested).toEqual([]);
    expect(saved).toEqual([]);
  });

  it('refuses the database\'s 42501 as not the owner, and any other failure as 500', async () => {
    expect((await saveKeyRoute(post({ workspace: W, key: KEY }), deps({ store: async () => fakeStore({ refuse: '42501' }).store }).deps)).status).toBe(403);
    expect((await saveKeyRoute(post({ workspace: W, key: KEY }), deps({ store: async () => fakeStore({ refuse: 'XX000' }).store }).deps)).status).toBe(500);
  });

  it('saves nothing, and calls nobody, without SECRETS_MASTER_KEY', async () => {
    const { deps: d, tested, saved } = deps({ master: () => null });
    const res = await saveKeyRoute(post({ workspace: W, key: KEY }), d);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: NOT_AVAILABLE });
    expect(tested).toEqual([]);
    expect(saved).toEqual([]);
  });

  it('refuses a signed-out caller and a malformed body', async () => {
    expect((await saveKeyRoute(post({ workspace: W, key: KEY }), deps({ store: async () => null }).deps)).status).toBe(401);
    for (const body of ['not json', [], { workspace: W }, { key: KEY }, { workspace: W, key: 'short' }, { workspace: W, key: 'has a space in it' }, { workspace: '', key: KEY }]) {
      const { deps: d, tested } = deps();
      expect((await saveKeyRoute(post(body), d)).status, JSON.stringify(body)).toBe(400);
      expect(tested).toEqual([]);
    }
  });
});

describe('DELETE /api/jev/key', () => {
  it('removes the key, and answers no key', async () => {
    const { deps: d, removed } = deps();
    const res = await removeKeyRoute(post({ workspace: W }, 'DELETE'), d);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ key: { stored: false, lastFour: null, setAt: null } });
    expect(removed).toEqual([W]);
  });

  it('refuses a non-owner, a signed-out caller and a malformed body', async () => {
    expect((await removeKeyRoute(post({ workspace: W }, 'DELETE'), { store: async () => fakeStore({ refuse: '42501' }).store })).status).toBe(403);
    expect((await removeKeyRoute(post({ workspace: W }, 'DELETE'), { store: async () => null })).status).toBe(401);
    expect((await removeKeyRoute(post({}, 'DELETE'), deps().deps)).status).toBe(400);
  });
});

describe('the test call', () => {
  it('asks a Noul about a fixed text, nothing of the workspace\'s', async () => {
    const bodies: unknown[] = [];
    const fetch = (async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)));
      return Response.json({ model: 'jev-1.13.0', answer: 0.4, confidence: 0.7 });
    }) as unknown as typeof globalThis.fetch;
    expect(await keyCheck(KEY, fetch)).toMatchObject({ kind: 'answered' });
    expect(bodies).toEqual([{ model: 'jev-1.13.0', state: expect.any(String), question: KEY_CHECK }]);
  });

  it('says why in plain words', () => {
    expect(testRefusal({ kind: 'failed', reason: 'status', status: 401, message: 'Invalid API key', ms: 1 })).toBe('TypeSafe refused this key: Invalid API key');
    expect(testRefusal({ kind: 'failed', reason: 'timeout', status: null, message: '', ms: 1 })).toContain('did not answer');
  });
});
