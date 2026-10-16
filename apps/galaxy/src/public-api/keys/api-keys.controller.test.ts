import { describe, expect, it } from 'vitest';
import { deleteApiKey as revokeRoute, postApiKey as makeRoute, type ApiKeysDeps } from './api-keys.controller';
import { ADA, BEN, DAN, fakeApiKeysDb, NORTHWIND, SOUTHWIND } from './api-keys.fake';
import type { ApiKeysRepository } from './api-keys.repository';
import { apiKeysService, ONLY_OWNERS } from './api-keys.service';
import { makeApiKey } from './secret';

// Settings › API keys' make and revoke routes (PRD 2022 s1), with the real service on the database in
// memory: an owner, a member, another workspace's owner, and nobody signed in.

const URL_ = 'https://omni.test/api/api-keys';
const request = (method: 'POST' | 'DELETE', body: unknown) =>
  new Request(URL_, { method, body: typeof body === 'string' ? body : JSON.stringify(body), headers: { 'content-type': 'application/json' } });

function depsFor(person: string | null, db = fakeApiKeysDb(), repository?: ApiKeysRepository) {
  const logged: string[] = [];
  const deps: ApiKeysDeps = {
    service: () => Promise.resolve(person === null ? null : apiKeysService(repository ?? db.as(person), () => makeApiKey())),
    log: (line) => { logged.push(line); },
  };
  return { deps, logged, db };
}

async function made(db = fakeApiKeysDb()) {
  const res = await makeRoute(request('POST', { workspace: NORTHWIND, name: 'QA dashboard', repos: ['northwind/backend'] }), depsFor(ADA, db).deps);
  return { db, res, body: await res.json() as { secret: string; key: { id: string; name: string; lastFour: string } } };
}

describe('POST /api/api-keys', () => {
  it('lets an owner make a key: 201 with the secret, this once, and the key as listed, never cached', async () => {
    const { res, body } = await made();
    expect(res.status).toBe(201);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(body.secret).toMatch(/^oma_[A-Za-z0-9_-]{43}$/);
    expect(body.key).toMatchObject({ name: 'QA dashboard', repos: ['northwind/backend'], lastFour: body.secret.slice(-4) });
    expect(JSON.stringify(body.key)).not.toContain(body.secret);
  });

  it('refuses a member and another workspace’s owner with 403, and makes nothing', async () => {
    const db = fakeApiKeysDb();
    for (const person of [BEN, DAN]) {
      const res = await makeRoute(request('POST', { workspace: NORTHWIND, name: 'Mine', repos: [] }), depsFor(person, db).deps);
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: ONLY_OWNERS });
    }
    expect(db.keys).toEqual([]);
  });

  it('refuses anyone signed out with 401, before reading the body', async () => {
    const res = await makeRoute(request('POST', 'not json'), depsFor(null).deps);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Sign in first.' });
  });

  it('answers 503 on a deployment with no database', async () => {
    const res = await makeRoute(request('POST', {}), { service: null, log: () => undefined });
    expect(res.status).toBe(503);
  });

  it('refuses a body that is no JSON object with 400, and a field the contract refuses with 422 naming it', async () => {
    const { deps } = depsFor(ADA);
    for (const body of ['not json', '[]', 'null', '"x"']) expect((await makeRoute(request('POST', body), deps)).status).toBe(400);
    const cases: [unknown, string][] = [
      [{ workspace: 'nope', name: 'x', repos: [] }, 'workspace'],
      [{ workspace: NORTHWIND, name: '', repos: [] }, 'name'],
      [{ workspace: NORTHWIND, name: 'n'.repeat(41), repos: [] }, 'name'],
      [{ workspace: NORTHWIND, name: 'two\nlines', repos: [] }, 'name'],
      [{ workspace: NORTHWIND, name: 'x', repos: ['not a repo'] }, 'repos'],
      [{ workspace: NORTHWIND, name: 'x' }, 'repos'],
    ];
    for (const [body, field] of cases) {
      const res = await makeRoute(request('POST', body), deps);
      expect(res.status, JSON.stringify(body)).toBe(422);
      expect((await res.json() as { error: string }).error.startsWith(`${field}: `)).toBe(true);
    }
  });

  it('answers a refused repository and a taken name with 422, the workspace’s 21st key with 429', async () => {
    const db = fakeApiKeysDb();
    const { deps } = depsFor(ADA, db);
    expect((await makeRoute(request('POST', { workspace: NORTHWIND, name: 'x', repos: ['southwind/backend'] }), deps)).status).toBe(422);
    for (let i = 1; i <= 20; i++) await makeRoute(request('POST', { workspace: NORTHWIND, name: `Key ${i}`, repos: [] }), deps);
    expect((await makeRoute(request('POST', { workspace: NORTHWIND, name: 'key 1', repos: [] }), deps)).status).toBe(422);
    expect((await makeRoute(request('POST', { workspace: NORTHWIND, name: 'One more', repos: [] }), deps)).status).toBe(429);
  });

  it('answers 500 when the database fails, logging why but never the secret', async () => {
    const db = fakeApiKeysDb();
    const failing: ApiKeysRepository = { ...db.as(ADA), list: () => Promise.reject(new Error('Supabase: could not read the API keys (timeout)')) };
    const { deps, logged } = depsFor(ADA, db, failing);
    const res = await makeRoute(request('POST', { workspace: NORTHWIND, name: 'x', repos: [] }), deps);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'The API keys could not answer. Try again.' });
    expect(logged).toEqual(['api-keys: Supabase: could not read the API keys (timeout)']);
  });
});

describe('DELETE /api/api-keys', () => {
  it('lets an owner revoke a key: 200 with the key revoked, and no secret', async () => {
    const { db, body } = await made();
    const res = await revokeRoute(request('DELETE', { workspace: NORTHWIND, key: body.key.id }), depsFor(ADA, db).deps);
    expect(res.status).toBe(200);
    const revoked = await res.json() as { key: { id: string; revokedAt: string | null } };
    expect(revoked.key.id).toBe(body.key.id);
    expect(revoked.key.revokedAt).not.toBeNull();
    expect(JSON.stringify(revoked)).not.toContain(body.secret);
  });

  it('refuses a member with 403, another workspace with 404, anyone signed out with 401', async () => {
    const { db, body } = await made();
    expect((await revokeRoute(request('DELETE', { workspace: NORTHWIND, key: body.key.id }), depsFor(BEN, db).deps)).status).toBe(403);
    expect((await revokeRoute(request('DELETE', { workspace: SOUTHWIND, key: body.key.id }), depsFor(DAN, db).deps)).status).toBe(404);
    expect((await revokeRoute(request('DELETE', { workspace: NORTHWIND, key: body.key.id }), depsFor(null, db).deps)).status).toBe(401);
    expect(db.keys[0]?.key.revokedAt).toBeNull();
  });

  it('refuses a body without the workspace and the key', async () => {
    const { deps } = depsFor(ADA);
    expect((await revokeRoute(request('DELETE', 'nope'), deps)).status).toBe(400);
    expect((await revokeRoute(request('DELETE', { workspace: NORTHWIND }), deps)).status).toBe(422);
    expect((await revokeRoute(request('DELETE', { workspace: NORTHWIND, key: 'not-an-id' }), deps)).status).toBe(422);
  });
});
