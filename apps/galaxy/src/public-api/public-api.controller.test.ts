import { describe, expect, it } from 'vitest';
import { fakePublicApi, NORTHWIND, SECRETS, SOUTHWIND, type FakePublicApi } from './fixtures/public-api.fake';
import { DEAD_KEY, FAILED, listBugFixes, listPrds, NO_DATABASE, NO_KEY, type PublicApiDeps } from './public-api.controller';
import { PublicApiErrorSchema } from './public-api.contract';
import { publicApiService } from './public-api.service';
import type { PublicApiRepository } from './public-api.repository';

// GET /api/v1/prds and /api/v1/bug-fixes (PRD 2022 s2) through the real service on rows in memory: the key
// checked first, each dead key 401 in the one error shape; the query next, a bad `limit` or `cursor` 422
// naming it; the lists in the contract's shape, never cached; a failure 500 that never carries the
// database's words.

const ORIGIN = 'https://omni.example';

function deps(api: FakePublicApi | null, logs: string[] = []): PublicApiDeps {
  return { service: api ? publicApiService(api.repository) : null, log: (line) => logs.push(line) };
}

function get(path: string, authorization: string | null = `Bearer ${SECRETS.all}`): Request {
  return new Request(`${ORIGIN}${path}`, { headers: authorization === null ? {} : { authorization } });
}

async function errorOf(response: Response) {
  return PublicApiErrorSchema.parse(await response.json()).error;
}

describe('the key', () => {
  for (const [what, authorization] of [
    ['no header', null],
    ['an empty bearer', 'Bearer '],
    ['another scheme', `Basic ${SECRETS.all}`],
    ['a wrong prefix', `Bearer omb_${'x'.repeat(43)}`],
    ['two words', `Bearer ${SECRETS.all} ${SECRETS.all}`],
  ] as const) {
    it(`answers 401 to ${what}, reading nothing`, async () => {
      const api = fakePublicApi();
      api.prd(NORTHWIND, 'northwind/backend', 1);
      const response = await listPrds(get('/api/v1/prds', authorization), deps(api));
      expect(response.status).toBe(401);
      expect((await errorOf(response)).code).toBe('unauthorized');
      expect(api.calls.filter((call) => call !== 'keyOf')).toEqual([]);
    });
  }

  it('says how to send the key when none came', async () => {
    expect(await errorOf(await listPrds(get('/api/v1/prds', null), deps(fakePublicApi())))).toEqual({ code: 'unauthorized', message: NO_KEY });
  });

  for (const [what, secret] of [['an unknown key', SECRETS.unknown], ['a revoked key', SECRETS.revoked], ['a key whose maker left', SECRETS.orphaned]] as const) {
    it(`answers 401 to ${what}, on both lists, saying no more than that it is dead`, async () => {
      const api = fakePublicApi();
      api.prd(NORTHWIND, 'northwind/backend', 1);
      api.bug(NORTHWIND, 'northwind/backend', 2);
      for (const route of [listPrds, listBugFixes]) {
        const response = await route(get('/api/v1/prds', `Bearer ${secret}`), deps(api));
        expect(response.status).toBe(401);
        expect(await errorOf(response)).toEqual({ code: 'unauthorized', message: DEAD_KEY });
      }
      expect(api.calls).toEqual(['keyOf', 'keyOf']);
    });
  }

  it('takes the scheme in any case', async () => {
    expect((await listPrds(get('/api/v1/prds', `bearer ${SECRETS.all}`), deps(fakePublicApi()))).status).toBe(200);
  });
});

describe('the query', () => {
  for (const limit of ['0', '101', 'abc', '', '1.5', '-1']) {
    it(`answers 422 naming limit to limit=${limit}`, async () => {
      const response = await listPrds(get(`/api/v1/prds?limit=${limit}`), deps(fakePublicApi()));
      expect(response.status).toBe(422);
      const error = await errorOf(response);
      expect(error.code).toBe('invalid_request');
      expect(error.message).toMatch(/^limit: /);
    });
  }

  it('answers 422 naming cursor to a tampered cursor, on both lists', async () => {
    for (const route of [listPrds, listBugFixes]) {
      const response = await route(get('/api/v1/prds?cursor=WyJwcmRzIiwi'), deps(fakePublicApi()));
      expect(response.status).toBe(422);
      const error = await errorOf(response);
      expect(error.code).toBe('invalid_request');
      expect(error.message).toMatch(/^cursor: /);
    }
  });

  it('checks the key before the query', async () => {
    expect((await listPrds(get('/api/v1/prds?limit=0', null), deps(fakePublicApi()))).status).toBe(401);
  });

  it('pages 50 by default and 100 at most', async () => {
    const api = fakePublicApi();
    for (let n = 1; n <= 120; n += 1) api.prd(NORTHWIND, 'northwind/backend', n);
    const count = async (path: string) => ((await (await listPrds(get(path), deps(api))).json()) as { data: unknown[] }).data.length;
    expect(await count('/api/v1/prds')).toBe(50);
    expect(await count('/api/v1/prds?limit=100')).toBe(100);
    expect(await count('/api/v1/prds?limit=7')).toBe(7);
  });
});

describe('the lists', () => {
  it('answers the key’s PRDs, uncached, with their pages on this origin', async () => {
    const api = fakePublicApi();
    const mine = api.prd(NORTHWIND, 'northwind/backend', 42);
    api.prd(SOUTHWIND, 'southwind/backend', 1);
    const response = await listPrds(get('/api/v1/prds'), deps(api));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({
      data: [{
        id: mine.id, ref: '42', number: 42, title: mine.title, repo: 'northwind/backend', product: null, stage: null, created_at: mine.created_at,
        links: { page: `${ORIGIN}/prd/${mine.id}`, issue: 'https://github.com/northwind/backend/issues/42' },
      }],
      next_cursor: null,
    });
  });

  it('follows next_cursor through every bug fix of the allow-list, exactly once', async () => {
    const api = fakePublicApi();
    for (let n = 1; n <= 30; n += 1) api.bug(NORTHWIND, n % 3 === 0 ? 'northwind/web' : 'northwind/backend', n);
    const seen: number[] = [];
    let path = '/api/v1/bug-fixes?limit=4';
    for (let pages = 0; pages < 20; pages += 1) {
      const body = (await (await listBugFixes(get(path, `Bearer ${SECRETS.backend}`), deps(api))).json()) as { data: { number: number; repo: string }[]; next_cursor: string | null };
      seen.push(...body.data.map((b) => b.number));
      expect(body.data.every((b) => b.repo === 'northwind/backend')).toBe(true);
      if (body.next_cursor === null) break;
      path = `/api/v1/bug-fixes?limit=4&cursor=${encodeURIComponent(body.next_cursor)}`;
    }
    const backend = [...Array(30).keys()].map((i) => 30 - i).filter((n) => n % 3 !== 0);
    expect(seen).toEqual(backend);
  });
});

describe('a failure', () => {
  it('answers 500 without the database’s words, and logs them', async () => {
    const api = fakePublicApi();
    const broken: PublicApiRepository = { ...api.repository, dossiers: () => Promise.reject(new Error('dossiers: permission denied for table dossiers')) };
    const logs: string[] = [];
    const response = await listPrds(get('/api/v1/prds'), { service: publicApiService(broken), log: (line) => logs.push(line) });
    expect(response.status).toBe(500);
    expect(await errorOf(response)).toEqual({ code: 'internal', message: FAILED });
    expect(logs).toEqual(['public-api: dossiers: permission denied for table dossiers']);
  });

  it('answers 500 when this deployment has no database', async () => {
    const response = await listBugFixes(get('/api/v1/bug-fixes'), deps(null));
    expect(response.status).toBe(500);
    expect(await errorOf(response)).toEqual({ code: 'internal', message: NO_DATABASE });
  });
});
