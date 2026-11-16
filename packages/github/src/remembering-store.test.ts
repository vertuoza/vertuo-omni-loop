import { describe, expect, it } from 'vitest';
import { etagMemory, memoryGithubStore, rememberingGithubStore, type GithubStore } from './index.ts';

const T0 = Date.parse('2026-11-16T09:00:00Z');
const DAY = 24 * 3_600_000;
const URL_A = 'https://api.github.com/repos/acme/widgets/issues/7';
const URL_B = 'https://api.github.com/repos/acme/widgets/issues/8';

/** The shared store, every call it took counted by name. */
function countedShared() {
  const inner = memoryGithubStore();
  const calls: Record<keyof GithubStore, number> = { etag: 0, saveEtag: 0, touchEtag: 0, budget: 0, saveBudget: 0, pause: 0 };
  const shared: GithubStore = {
    etag: (...args) => { calls.etag += 1; return inner.etag(...args); },
    saveEtag: (...args) => { calls.saveEtag += 1; return inner.saveEtag(...args); },
    touchEtag: (...args) => { calls.touchEtag += 1; return inner.touchEtag(...args); },
    budget: (...args) => { calls.budget += 1; return inner.budget(...args); },
    saveBudget: (...args) => { calls.saveBudget += 1; return inner.saveBudget(...args); },
    pause: (...args) => { calls.pause += 1; return inner.pause(...args); },
  };
  return { shared, inner, calls };
}

describe('rememberingGithubStore (#2953)', () => {
  it('reads a stored ETag from the shared store once, then from memory', async () => {
    const { shared, inner, calls } = countedShared();
    await inner.saveEtag(42, URL_A, { etag: '"a"', body: '{}', at: T0 });
    const store = rememberingGithubStore(shared);
    expect(await store.etag(42, URL_A)).toEqual({ etag: '"a"', body: '{}', contentType: null, readAt: T0 });
    expect(await store.etag(42, URL_A)).toEqual({ etag: '"a"', body: '{}', contentType: null, readAt: T0 });
    expect(calls.etag).toBe(1);
  });

  it('remembers a URL with no stored ETag, and keeps installations apart', async () => {
    const { shared, calls } = countedShared();
    const store = rememberingGithubStore(shared);
    expect(await store.etag(42, URL_A)).toBeNull();
    expect(await store.etag(42, URL_A)).toBeNull();
    expect(await store.etag(43, URL_A)).toBeNull();
    expect(calls.etag).toBe(2);
  });

  it('remembers nothing when the shared store fails, so the next read asks it again', async () => {
    const { shared, calls } = countedShared();
    let down = true;
    const store = rememberingGithubStore({ ...shared, etag: (...args) => (down ? Promise.reject(new Error('down')) : shared.etag(...args)) });
    await expect(store.etag(42, URL_A)).rejects.toThrow('down');
    down = false;
    await store.etag(42, URL_A);
    expect(calls.etag).toBe(1);
  });

  it('writes a new body, and a body it does not know yet', async () => {
    const { shared, inner, calls } = countedShared();
    const store = rememberingGithubStore(shared);
    await store.saveEtag(42, URL_A, { etag: '"a"', body: '{"n":1}', contentType: 'application/json', at: T0 });
    await store.saveEtag(42, URL_A, { etag: '"b"', body: '{"n":2}', contentType: 'application/json', at: T0 + 1000 });
    await store.saveEtag(42, URL_A, { etag: '"c"', body: '{"n":2}', contentType: 'text/plain', at: T0 + 2000 });
    expect(calls.saveEtag).toBe(3);
    expect(await inner.etag(42, URL_A)).toMatchObject({ etag: '"c"', contentType: 'text/plain' });
  });

  it('keeps a repeated body\'s new ETag in memory only, and writes it once a day so the prune keeps the row', async () => {
    const { shared, inner, calls } = countedShared();
    const store = rememberingGithubStore(shared);
    await store.saveEtag(42, URL_A, { etag: '"a"', body: '{}', at: T0 });
    await store.saveEtag(42, URL_A, { etag: '"b"', body: '{}', at: T0 + DAY - 1 });
    expect(calls.saveEtag).toBe(1);
    expect(await store.etag(42, URL_A)).toEqual({ etag: '"b"', body: '{}', contentType: null, readAt: T0 });
    expect(await inner.etag(42, URL_A)).toMatchObject({ etag: '"a"' });
    await store.saveEtag(42, URL_A, { etag: '"c"', body: '{}', at: T0 + DAY });
    expect(calls.saveEtag).toBe(2);
    expect(await inner.etag(42, URL_A)).toEqual({ etag: '"c"', body: '{}', contentType: null, readAt: T0 + DAY });
    expect(await store.etag(42, URL_A)).toMatchObject({ readAt: T0 + DAY });
  });

  it('marks an ETag read in the shared store and in memory', async () => {
    const { shared, inner, calls } = countedShared();
    const store = rememberingGithubStore(shared);
    await store.saveEtag(42, URL_A, { etag: '"a"', body: '{}', at: T0 });
    await store.touchEtag(42, URL_A, T0 + DAY);
    expect(calls.touchEtag).toBe(1);
    expect(await inner.etag(42, URL_A)).toMatchObject({ readAt: T0 + DAY });
    expect(await store.etag(42, URL_A)).toMatchObject({ readAt: T0 + DAY });
    await store.touchEtag(42, URL_B, T0);
    expect(await store.etag(42, URL_B)).toBeNull();
  });

  it('hands out copies: a caller that changes what it read changes nothing remembered', async () => {
    const { shared } = countedShared();
    const store = rememberingGithubStore(shared);
    await store.saveEtag(42, URL_A, { etag: '"a"', body: '{}', at: T0 });
    const read = await store.etag(42, URL_A);
    if (read) read.readAt = 0;
    expect(await store.etag(42, URL_A)).toMatchObject({ readAt: T0 });
  });

  it('sends the budget and the pause through to the shared store, every time', async () => {
    const { shared, calls } = countedShared();
    const store = rememberingGithubStore(shared);
    await store.saveBudget(42, 'core', { limit: 5000, remaining: 4000, resetAt: T0 + 3_600_000, at: T0 });
    await store.pause(42, 'core', T0 + 60_000, T0);
    expect(await store.budget(42, 'core')).toMatchObject({ remaining: 4000, pausedUntil: T0 + 60_000 });
    expect(await store.budget(42, 'core')).toMatchObject({ remaining: 4000 });
    expect(calls).toMatchObject({ saveBudget: 1, pause: 1, budget: 2 });
  });
});

describe('etagMemory (#2953)', () => {
  const etag = (body: string) => ({ etag: '"e"', body, contentType: null, readAt: T0 });

  it('forgets the least recently used key past its entries', () => {
    const memory = etagMemory({ entries: 2, bodyChars: 100 });
    memory.set('a', etag('1'));
    memory.set('b', null);
    expect(memory.get('a')).toEqual(etag('1'));
    memory.set('c', etag('3'));
    expect(memory.get('b')).toBeUndefined();
    expect(memory.get('a')).toEqual(etag('1'));
    expect(memory.get('c')).toEqual(etag('3'));
  });

  it('forgets the oldest bodies past its characters, and never keeps one larger than them all', () => {
    const memory = etagMemory({ entries: 10, bodyChars: 10 });
    memory.set('a', etag('xxxx'));
    memory.set('b', etag('yyyy'));
    memory.set('c', etag('zzzz'));
    expect(memory.get('a')).toBeUndefined();
    expect(memory.get('b')).toEqual(etag('yyyy'));
    memory.set('big', etag('x'.repeat(11)));
    expect(memory.get('big')).toBeUndefined();
    expect(memory.get('c')).toEqual(etag('zzzz'));
  });

  it('counts a replaced body once: a key set again frees what it held', () => {
    const memory = etagMemory({ entries: 10, bodyChars: 10 });
    memory.set('a', etag('xxxxxx'));
    memory.set('a', etag('xxxxxx'));
    memory.set('b', etag('yyyy'));
    expect(memory.get('a')).toEqual(etag('xxxxxx'));
    expect(memory.get('b')).toEqual(etag('yyyy'));
  });
});
