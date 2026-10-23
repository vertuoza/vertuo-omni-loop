import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { deleteGithubApp, postGithubApp, type ApiKeysDeps } from './api-keys.controller';
import { ADA, BEN, DAN, fakeApiKeysDb, NORTHWIND } from './api-keys.fake';
import type { ApiKeysRepository } from './api-keys.repository';
import { apiKeysService, GITHUB_REFUSED, GITHUB_UNAVAILABLE, GONE, NOT_AVAILABLE, ONLY_OWNERS_APP, type GithubAppDeps } from './api-keys.service';
import type { AppChecked } from './github-app';
import { makeApiKey } from './secret';

vi.mock('server-only', () => ({}));

// Settings › API keys' GitHub App routes (PRD 2433 s4), with the real service on the database in memory and
// GitHub stubbed: POST and DELETE /api/api-keys/<id>/github-app, as an owner, a member, another workspace's
// owner and nobody signed in. Nothing they answer or log carries the private key.

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
const MASTER = Buffer.alloc(32, 9);
const GOOD: AppChecked = { ok: true, slug: 'acme-bugs', botId: 777 };
const BODY = { appId: '123456', privateKey: PEM };

const request = (method: 'POST' | 'DELETE', body?: unknown) =>
  new Request('https://omni.test/api/api-keys/k/github-app', {
    method, body: body === undefined ? null : typeof body === 'string' ? body : JSON.stringify(body), headers: { 'content-type': 'application/json' },
  });

function depsFor(person: string | null, options: { db?: ReturnType<typeof fakeApiKeysDb>; checked?: AppChecked; master?: Buffer | null; repository?: ApiKeysRepository } = {}) {
  const { db = fakeApiKeysDb(), checked = GOOD, master = MASTER, repository } = options;
  const logged: string[] = [];
  const github: GithubAppDeps = { master: () => master, check: () => Promise.resolve(checked) };
  const deps: ApiKeysDeps = {
    service: () => Promise.resolve(person === null ? null : apiKeysService(repository ?? db.as(person), () => makeApiKey(), github)),
    log: (line) => { logged.push(line); },
  };
  return { deps, logged, db };
}

async function keyOf(db: ReturnType<typeof fakeApiKeysDb>): Promise<string> {
  const made = await apiKeysService(db.as(ADA), () => makeApiKey()).make({ workspace: NORTHWIND, name: 'QA dashboard', repos: [] });
  if (!made.ok) throw new Error('not made');
  return made.value.key.id;
}

describe('POST /api/api-keys/<id>/github-app', () => {
  it('lets an owner attach an App: 200 with the key\'s slug, never cached, and the App stored sealed', async () => {
    const { deps, db } = depsFor(ADA);
    const key = await keyOf(db);
    const res = await postGithubApp(request('POST', BODY), key, deps);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ slug: 'acme-bugs' });
    expect(text).not.toContain('PRIVATE KEY');
    expect(db.apps.get(key)).toMatchObject({ appId: 123456, slug: 'acme-bugs', botId: 777 });
    expect(JSON.stringify([...db.apps.values()])).not.toContain('PRIVATE KEY');
  });

  it('reads an App ID sent as a number, and replaces the App a key holds', async () => {
    const { deps, db } = depsFor(ADA);
    const key = await keyOf(db);
    expect((await postGithubApp(request('POST', BODY), key, deps)).status).toBe(200);
    expect((await postGithubApp(request('POST', { ...BODY, appId: 654321 }), key, deps)).status).toBe(200);
    expect(db.apps.size).toBe(1);
    expect(db.apps.get(key)?.appId).toBe(654321);
  });

  it('refuses a pair GitHub refuses with 422 in its words, storing nothing', async () => {
    const { deps, db } = depsFor(ADA, { checked: { ok: false, reason: 'refused', detail: 'GitHub answered 401 to GET /app' } });
    const res = await postGithubApp(request('POST', BODY), await keyOf(db), deps);
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: GITHUB_REFUSED });
    expect(db.apps.size).toBe(0);
  });

  it('answers 502 when GitHub could not be asked, logging why, and stores nothing', async () => {
    const { deps, db, logged } = depsFor(ADA, { checked: { ok: false, reason: 'unavailable', detail: 'GitHub answered 502 to GET /app' } });
    const res = await postGithubApp(request('POST', BODY), await keyOf(db), deps);
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: GITHUB_UNAVAILABLE });
    expect(logged).toEqual(['api-keys: GitHub answered 502 to GET /app']);
    expect(db.apps.size).toBe(0);
  });

  it('answers 503 on a deployment with no master key, in its words', async () => {
    const { deps, db } = depsFor(ADA, { master: null });
    const res = await postGithubApp(request('POST', BODY), await keyOf(db), deps);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: NOT_AVAILABLE });
    expect(db.apps.size).toBe(0);
  });

  it('refuses a member and another workspace\'s owner with 403, a revoked key with 404', async () => {
    const db = fakeApiKeysDb();
    const key = await keyOf(db);
    for (const person of [BEN, DAN]) {
      const res = await postGithubApp(request('POST', BODY), key, depsFor(person, { db }).deps);
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: ONLY_OWNERS_APP });
    }
    expect(db.apps.size).toBe(0);
    await apiKeysService(db.as(ADA), () => makeApiKey()).revoke({ workspace: NORTHWIND, key });
    const gone = await postGithubApp(request('POST', BODY), key, depsFor(ADA, { db }).deps);
    expect(gone.status).toBe(404);
    expect(await gone.json()).toEqual({ error: GONE });
  });

  it('refuses anyone signed out with 401, before reading the body, and a deployment with no database with 503', async () => {
    const res = await postGithubApp(request('POST', 'not json'), '00000000-0000-4000-8000-000000000001', depsFor(null).deps);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Sign in first.' });
    expect((await postGithubApp(request('POST', {}), '00000000-0000-4000-8000-000000000001', { service: null, log: () => undefined })).status).toBe(503);
  });

  it('refuses a key id that is no id with 400, a body that is no JSON object with 400, and a field it refuses with 422 naming it', async () => {
    const { deps } = depsFor(ADA);
    const key = '00000000-0000-4000-8000-000000000001';
    expect((await postGithubApp(request('POST', BODY), 'not-an-id', deps)).status).toBe(400);
    for (const body of ['not json', '[]', 'null', '"x"']) expect((await postGithubApp(request('POST', body), key, deps)).status).toBe(400);
    const cases: [unknown, string][] = [
      [{ privateKey: PEM }, 'appId'],
      [{ appId: 'abc', privateKey: PEM }, 'appId'],
      [{ appId: 0, privateKey: PEM }, 'appId'],
      [{ appId: -4, privateKey: PEM }, 'appId'],
      [{ appId: 1.5, privateKey: PEM }, 'appId'],
      [{ appId: '12 34', privateKey: PEM }, 'appId'],
      [{ appId: '123456' }, 'privateKey'],
      [{ appId: '123456', privateKey: '   ' }, 'privateKey'],
      [{ appId: '123456', privateKey: 'x'.repeat(20_000) }, 'privateKey'],
    ];
    for (const [body, field] of cases) {
      const res = await postGithubApp(request('POST', body), key, deps);
      expect(res.status, JSON.stringify(body).slice(0, 80)).toBe(422);
      const error = ((await res.json()) as { error: string }).error;
      expect(error.startsWith(`${field}: `), error).toBe(true);
      expect(error).not.toContain('PRIVATE KEY');
    }
  });

  it('answers 500 when the database fails, logging why but never the private key', async () => {
    const db = fakeApiKeysDb();
    const key = await keyOf(db);
    const failing: ApiKeysRepository = { ...db.as(ADA), attachGithubApp: () => Promise.resolve({ ok: false, code: '57014', hint: null, message: 'canceling statement due to statement timeout' }) };
    const { deps, logged } = depsFor(ADA, { db, repository: failing });
    const res = await postGithubApp(request('POST', BODY), key, deps);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'The API keys could not be saved. Try again.' });
    expect(logged).toEqual(['api-keys: 57014: canceling statement due to statement timeout']);
    expect(logged.join('\n')).not.toContain('PRIVATE KEY');
  });

  it('logs nothing of the private key when the repository throws', async () => {
    const db = fakeApiKeysDb();
    const key = await keyOf(db);
    const throwing: ApiKeysRepository = { ...db.as(ADA), attachGithubApp: () => Promise.reject(new Error('Supabase: the answer does not parse: [0].keyId invalid_type')) };
    const { deps, logged } = depsFor(ADA, { db, repository: throwing });
    expect((await postGithubApp(request('POST', BODY), key, deps)).status).toBe(500);
    expect(logged).toEqual(['api-keys: Supabase: the answer does not parse: [0].keyId invalid_type']);
  });
});

describe('DELETE /api/api-keys/<id>/github-app', () => {
  it('lets an owner remove the App: 200 {removed: true}, then {removed: false} for a key that holds none', async () => {
    const { deps, db } = depsFor(ADA);
    const key = await keyOf(db);
    await postGithubApp(request('POST', BODY), key, deps);
    const res = await deleteGithubApp(key, deps);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({ removed: true });
    expect(db.apps.size).toBe(0);
    expect(await (await deleteGithubApp(key, deps)).json()).toEqual({ removed: false });
  });

  it('refuses a member and another workspace\'s owner with 403, keeping the App', async () => {
    const { deps, db } = depsFor(ADA);
    const key = await keyOf(db);
    await postGithubApp(request('POST', BODY), key, deps);
    for (const person of [BEN, DAN]) {
      const res = await deleteGithubApp(key, depsFor(person, { db }).deps);
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: ONLY_OWNERS_APP });
    }
    expect(db.apps.size).toBe(1);
  });

  it('refuses anyone signed out with 401, a key id that is no id with 400, and a deployment with no database with 503', async () => {
    expect((await deleteGithubApp('00000000-0000-4000-8000-000000000001', depsFor(null).deps)).status).toBe(401);
    expect((await deleteGithubApp('not-an-id', depsFor(ADA).deps)).status).toBe(400);
    expect((await deleteGithubApp('00000000-0000-4000-8000-000000000001', { service: null, log: () => undefined })).status).toBe(503);
  });
});
