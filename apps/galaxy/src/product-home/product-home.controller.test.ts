import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import type { MemberSession } from '../data/member-session';
import { productArchiveHandlers, productHomeViewOf, type ProductHomeDeps } from './product-home.controller';
import { demoProductHome } from './ProductHome';
import type { ArchiveOutcome, ProductHome, ProductHomeService } from './product-home.service';

// /app/products/<id>'s controller (PRD 1364 s9): the session first (signed out, no read runs), then the
// workspace, then the product home read as the person; a product the workspace does not hold is not found,
// and a failed read is the unreadable notice.

const SIGNED_IN = { kind: 'signed-in', db: {}, user: { id: 'u-1' }, env: { url: 'u', key: 'k' } } as unknown as MemberSession;
const HOME: ProductHome = {
  product: { id: 'p-1', name: 'Mobile' },
  ledger: { lanes: { 'on-you': [], 'on-review': [], 'on-agent': [] }, summary: { building: 0, waitingOnPerson: 0, drifted: 0 } },
  prds: [],
  ideas: [],
  roadmaps: [],
  bugs: [],
  visuals: [],
  questions: [],
  repositories: [],
  tethers: [],
  flights: [],
  owner: false,
  archived: null,
};

function deps(over: Partial<ProductHomeDeps> = {}) {
  const reads: string[] = [];
  const d: ProductHomeDeps = {
    workspace: () => { reads.push('workspace'); return Promise.resolve({ id: 'ws-1' }); },
    home: (_s, workspace, product) => { reads.push(`home ${workspace} ${product}`); return Promise.resolve(HOME); },
    ...over,
  };
  return { reads, d };
}

describe('the product home\'s controller', () => {
  it('reads nothing for a signed-out person or a deployment with no database', async () => {
    for (const kind of ['sign-in', 'closed'] as const) {
      const { reads, d } = deps();
      expect(await productHomeViewOf({ kind }, 'p-1', d)).toEqual({ kind });
      expect(reads).toEqual([]);
    }
  });

  it('draws the demo\'s product in the demo, and no other', async () => {
    const { reads, d } = deps();
    expect(await productHomeViewOf({ kind: 'demo' }, 'demo-product-1', d)).toEqual({ kind: 'home', home: demoProductHome('demo-product-1'), demo: true });
    expect(await productHomeViewOf({ kind: 'demo' }, 'p-x', d)).toEqual({ kind: 'not-found' });
    expect(reads).toEqual([]);
  });

  it('reads the person\'s workspace, then the product home in it', async () => {
    const { reads, d } = deps();
    expect(await productHomeViewOf(SIGNED_IN, 'p-1', d)).toEqual({ kind: 'home', home: HOME });
    expect(reads).toEqual(['workspace', 'home ws-1 p-1']);
  });

  it('says so for an account in no workspace, and for a product the workspace does not hold', async () => {
    expect(await productHomeViewOf(SIGNED_IN, 'p-1', deps({ workspace: () => Promise.resolve(null) }).d)).toEqual({ kind: 'no-workspace' });
    expect(await productHomeViewOf(SIGNED_IN, 'p-x', deps({ home: () => Promise.resolve(null) }).d)).toEqual({ kind: 'not-found' });
  });

  it('draws the unreadable notice when a read fails, and logs it', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { d } = deps({ home: () => Promise.reject(new Error('down')) });
    expect(await productHomeViewOf(SIGNED_IN, 'p-1', d)).toEqual({ kind: 'unreadable' });
    expect(log).toHaveBeenCalledWith('product home: p-1 could not be read (down)');
    log.mockRestore();
  });
});

describe('the routes that archive and restore a product (PRD 2232 s1)', () => {
  const PRODUCT = '22222222-2222-4222-8222-222222222232';
  const request = (path: 'archive' | 'restore') => new Request(`https://omni.test/app/products/${PRODUCT}/${path}`, { method: 'POST' });
  const answer = async (response: Response) => ({ status: response.status, body: (await response.json()) as unknown, cache: response.headers.get('cache-control') });

  function handlers(outcome: ArchiveOutcome | Error | null) {
    const calls: string[] = [];
    const logs: string[] = [];
    const run = (verb: string) => (product: string) => {
      calls.push(`${verb} ${product}`);
      return outcome instanceof Error ? Promise.reject(outcome) : Promise.resolve(outcome as ArchiveOutcome);
    };
    const service = { archive: run('archive'), restore: run('restore') } as unknown as ProductHomeService;
    const h = productArchiveHandlers({ signedIn: () => Promise.resolve(outcome === null ? null : service), log: (line) => { logs.push(line); } });
    return { ...h, calls, logs };
  }

  it('archives and restores as the signed-in person, answering the product as it was left, never cached', async () => {
    const archived = { id: PRODUCT, name: 'Mobile', archivedAt: '2026-10-20T09:00:00Z' };
    const h = handlers({ ok: true, value: archived });
    expect(await answer(await h.archive(request('archive'), PRODUCT))).toEqual({ status: 200, body: archived, cache: 'no-store' });
    expect(await answer(await h.restore(request('restore'), PRODUCT))).toEqual({ status: 200, body: archived, cache: 'no-store' });
    expect(h.calls).toEqual([`archive ${PRODUCT}`, `restore ${PRODUCT}`]);
  });

  it('refuses a signed-out person with 401, and a malformed product id with 404, running no service', async () => {
    const out = handlers(null);
    expect(await answer(await out.archive(request('archive'), PRODUCT))).toMatchObject({ status: 401, body: { error: 'Sign in first to change this product.' } });
    const h = handlers({ ok: true, value: { id: 'x', name: 'x', archivedAt: null } });
    expect(await answer(await h.restore(request('restore'), 'not-an-id'))).toMatchObject({ status: 404, body: { error: 'No such product.' } });
    expect(h.calls).toEqual([]);
  });

  it('answers a refusal by its kind in the database\'s words, and a failure in plain words, logged', async () => {
    const owner = handlers({ ok: false, kind: 'not-owner', error: 'Only an owner of the workspace archives Mobile.' });
    expect(await answer(await owner.archive(request('archive'), PRODUCT))).toMatchObject({ status: 403, body: { error: 'Only an owner of the workspace archives Mobile.' } });
    const missing = handlers({ ok: false, kind: 'missing', error: 'Product: no such product.' });
    expect(await answer(await missing.restore(request('restore'), PRODUCT))).toMatchObject({ status: 404, body: { error: 'Product: no such product.' } });
    const failed = handlers({ ok: false, kind: 'database', error: 'connection reset' });
    expect(await answer(await failed.archive(request('archive'), PRODUCT))).toMatchObject({ status: 500, body: { error: 'Couldn’t change this product. Try again in a moment.' } });
    expect(failed.logs).toEqual([`product archive: connection reset (${PRODUCT})`]);
    const thrown = handlers(new Error('down'));
    expect(await answer(await thrown.restore(request('restore'), PRODUCT))).toMatchObject({ status: 500 });
    expect(thrown.logs).toEqual([`product archive: down (${PRODUCT})`]);
  });
});
