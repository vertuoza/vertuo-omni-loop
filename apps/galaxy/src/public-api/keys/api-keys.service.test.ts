import { createVerify, generateKeyPairSync } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { openSecret } from '../../jev/secret-box';
import { appJwt } from '../../signup/github-app';
import { ADA, BEN, DAN, fakeApiKeysDb, NORTHWIND, SOUTHWIND } from './api-keys.fake';
import {
  apiKeysService, FAILED, GITHUB_REFUSED, GITHUB_UNAVAILABLE, GONE, NAME_RULE, nameTaken, NOT_AVAILABLE, ONLY_OWNERS, ONLY_OWNERS_APP, REPOS_RULE, TOO_MANY,
  type GithubAppDeps,
} from './api-keys.service';
import type { ApiKeysRepository } from './api-keys.repository';
import type { AppChecked } from './github-app';
import { makeApiKey } from './secret';

vi.mock('server-only', () => ({}));

// The API keys' rules (PRD 2022 s1), on the database in memory: the secret is drawn here and answered
// once, the database gets its hash and last four only, and each refusal reads in its words.

const setup = (person = ADA) => {
  const db = fakeApiKeysDb();
  const drawn: string[] = [];
  const draw = async () => {
    const made = await makeApiKey();
    drawn.push(made.secret);
    return made;
  };
  return { db, drawn, service: apiKeysService(db.as(person), draw), as: (other: string) => apiKeysService(db.as(other), draw) };
};

describe('making a key', () => {
  it('answers the secret it drew, once, with the key as listed; the database keeps its hash and last four', async () => {
    const { db, drawn, service } = setup();
    const made = await service.make({ workspace: NORTHWIND, name: 'QA dashboard', repos: ['northwind/backend'] });
    expect(made.ok).toBe(true);
    if (!made.ok) return;
    expect(made.value.secret).toBe(drawn[0]);
    expect(made.value.key).toMatchObject({ name: 'QA dashboard', repos: ['northwind/backend'], lastFour: drawn[0]?.slice(-4), lastUsedAt: null, revokedAt: null });
    expect(JSON.stringify(made.value.key)).not.toContain(made.value.secret);
    expect(db.keys[0]?.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(db.keys)).not.toContain(made.value.secret);
  });

  it('makes a key for every repository with an empty allow-list', async () => {
    const made = await setup().service.make({ workspace: NORTHWIND, name: 'Weekly digest', repos: [] });
    expect(made.ok && made.value.key.repos).toEqual([]);
  });

  it('refuses a member, and another workspace’s owner, in the owners’ words', async () => {
    const { as } = setup();
    for (const person of [BEN, DAN]) {
      expect(await as(person).make({ workspace: NORTHWIND, name: 'Mine', repos: [] })).toEqual({ ok: false, kind: 'forbidden', error: ONLY_OWNERS });
    }
  });

  it('refuses a name the workspace’s live keys already hold, naming it', async () => {
    const { service } = setup();
    await service.make({ workspace: NORTHWIND, name: 'QA dashboard', repos: [] });
    expect(await service.make({ workspace: NORTHWIND, name: 'qa DASHBOARD', repos: [] }))
      .toEqual({ ok: false, kind: 'invalid', error: nameTaken('qa DASHBOARD') });
  });

  it('refuses a repository the workspace does not track', async () => {
    expect(await setup().service.make({ workspace: NORTHWIND, name: 'Stray', repos: ['southwind/backend'] }))
      .toEqual({ ok: false, kind: 'invalid', error: REPOS_RULE });
  });

  it('refuses the workspace’s 21st live key', async () => {
    const { service } = setup();
    for (let i = 1; i <= 20; i++) await service.make({ workspace: NORTHWIND, name: `Key ${i}`, repos: [] });
    expect(await service.make({ workspace: NORTHWIND, name: 'One too many', repos: [] })).toEqual({ ok: false, kind: 'limit', error: TOO_MANY });
  });

  it('reads any other refusal as a failure, keeping the database’s words for the log only', async () => {
    const repository: ApiKeysRepository = {
      ...fakeApiKeysDb().as(ADA),
      make: () => Promise.resolve({ ok: false, code: '23505', hint: null, message: 'duplicate key value violates unique constraint' }),
    };
    const made = await apiKeysService(repository, () => makeApiKey()).make({ workspace: NORTHWIND, name: 'x', repos: [] });
    expect(made).toEqual({ ok: false, kind: 'database', error: FAILED, cause: '23505: duplicate key value violates unique constraint' });
    const badHash: ApiKeysRepository = {
      ...fakeApiKeysDb().as(ADA),
      make: () => Promise.resolve({ ok: false, code: '22023', hint: 'hash', message: 'Hash: the key’s SHA-256.' }),
    };
    expect(await apiKeysService(badHash, () => makeApiKey()).make({ workspace: NORTHWIND, name: 'x', repos: [] }))
      .toMatchObject({ ok: false, kind: 'database', error: FAILED });
  });

  it('reads a name the database refuses for its shape in the name’s rule', async () => {
    const repository: ApiKeysRepository = {
      ...fakeApiKeysDb().as(ADA),
      make: () => Promise.resolve({ ok: false, code: '22023', hint: 'name', message: 'Name: 1 to 40 characters, on one line.' }),
    };
    expect(await apiKeysService(repository, () => makeApiKey()).make({ workspace: NORTHWIND, name: 'x', repos: [] }))
      .toEqual({ ok: false, kind: 'invalid', error: NAME_RULE });
  });
});

describe('revoking a key', () => {
  it('answers the key revoked, and the list no longer shows it', async () => {
    const { service } = setup();
    const made = await service.make({ workspace: NORTHWIND, name: 'QA dashboard', repos: [] });
    if (!made.ok) throw new Error('not made');
    const revoked = await service.revoke({ workspace: NORTHWIND, key: made.value.key.id });
    expect(revoked.ok && revoked.value.key.revokedAt).toBeTruthy();
    expect((await service.page(NORTHWIND)).keys).toEqual([]);
  });

  it('refuses a member, and a key the workspace does not hold', async () => {
    const { service, as } = setup();
    const made = await service.make({ workspace: NORTHWIND, name: 'QA dashboard', repos: [] });
    if (!made.ok) throw new Error('not made');
    expect(await as(BEN).revoke({ workspace: NORTHWIND, key: made.value.key.id })).toEqual({ ok: false, kind: 'forbidden', error: ONLY_OWNERS });
    expect(await as(DAN).revoke({ workspace: SOUTHWIND, key: made.value.key.id })).toEqual({ ok: false, kind: 'missing', error: GONE });
  });
});

describe('the page’s read', () => {
  it('gives an owner the keys, newest first, and the repositories to pick from', async () => {
    const { service } = setup();
    await service.make({ workspace: NORTHWIND, name: 'First', repos: [] });
    await service.make({ workspace: NORTHWIND, name: 'Second', repos: [] });
    const read = await service.page(NORTHWIND);
    expect(read.owner).toBe(true);
    expect(read.keys.map((k) => k.name)).toEqual(['Second', 'First']);
    expect(read.tracked).toEqual(['northwind/backend', 'northwind/web']);
  });

  it('gives a member the keys, and no repositories to pick from', async () => {
    const { service, as } = setup();
    await service.make({ workspace: NORTHWIND, name: 'First', repos: [] });
    expect(await as(BEN).page(NORTHWIND)).toMatchObject({ owner: false, tracked: [], keys: [{ name: 'First' }] });
  });
});

// An API key's GitHub App (PRD 2433 s4): the pair is checked with GitHub before anything is stored, the
// private key is sealed under the master key, and who reads what of the app follows the database's rules.

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
const MASTER = Buffer.alloc(32, 7);
const GOOD: AppChecked = { ok: true, slug: 'acme-bugs', botId: 777 };
const ATTACH = (key: string) => ({ key, appId: 123456, privateKey: PEM });

function withApps(checked: AppChecked = GOOD, master: Buffer | null = MASTER) {
  const db = fakeApiKeysDb();
  const asked: { appId: string; privateKey: string }[] = [];
  const github: GithubAppDeps = {
    master: () => master,
    check: (creds) => {
      asked.push(creds);
      return Promise.resolve(checked);
    },
  };
  const as = (person: string) => apiKeysService(db.as(person), () => makeApiKey(), github);
  const service = as(ADA);
  const keyId = async () => {
    const made = await service.make({ workspace: NORTHWIND, name: 'QA dashboard', repos: [] });
    if (!made.ok) throw new Error('not made');
    return made.value.key.id;
  };
  return { db, asked, as, service, keyId };
}

describe('attaching a GitHub App', () => {
  it('checks the pair with GitHub, seals the private key under the master key and answers the slug', async () => {
    const { db, asked, service, keyId } = withApps();
    const key = await keyId();
    expect(await service.attachGithubApp(ATTACH(key))).toEqual({ ok: true, value: { slug: 'acme-bugs' } });
    expect(asked).toEqual([{ appId: '123456', privateKey: PEM }]);
    const stored = db.apps.get(key);
    expect(stored).toMatchObject({ appId: 123456, slug: 'acme-bugs', botId: 777, lastTokenAt: null });
    expect(JSON.stringify([...db.apps.values()])).not.toContain('PRIVATE KEY');
    const opened = openSecret({ ciphertext: stored?.ciphertext ?? '', iv: stored?.iv ?? '' }, MASTER);
    expect(opened).toBe(PEM.trim());
    const jwt = appJwt({ appId: '123456', privateKey: opened }, Date.parse('2026-10-22T10:00:00Z'));
    const [head, body, sig] = jwt.split('.');
    expect(createVerify('RSA-SHA256').update(`${head}.${body}`).verify(publicKey, Buffer.from(sig ?? '', 'base64url'))).toBe(true);
  });

  it('replaces the App a key holds with the new pair, its last token starting again', async () => {
    const { db, service, keyId } = withApps();
    const key = await keyId();
    await service.attachGithubApp(ATTACH(key));
    const first = db.apps.get(key);
    if (first) first.lastTokenAt = '2026-10-22T09:00:00.000Z';
    expect(await service.attachGithubApp({ ...ATTACH(key), appId: 654321 })).toEqual({ ok: true, value: { slug: 'acme-bugs' } });
    expect(db.apps.size).toBe(1);
    expect(db.apps.get(key)).toMatchObject({ appId: 654321, lastTokenAt: null });
    expect(db.apps.get(key)?.ciphertext).not.toBe(first?.ciphertext);
  });

  it('refuses a pair GitHub refuses, in its words, and stores nothing', async () => {
    const { db, service, keyId } = withApps({ ok: false, reason: 'refused', detail: 'GitHub answered 401 to GET /app' });
    expect(await service.attachGithubApp(ATTACH(await keyId()))).toEqual({ ok: false, kind: 'invalid', error: GITHUB_REFUSED });
    expect(GITHUB_REFUSED).toBe('GitHub refused this App ID and private key.');
    expect(db.apps.size).toBe(0);
  });

  it('asks the owner to try again when GitHub could not answer, keeping why for the log, and stores nothing', async () => {
    const { db, service, keyId } = withApps({ ok: false, reason: 'unavailable', detail: 'GitHub answered 502 to GET /app' });
    expect(await service.attachGithubApp(ATTACH(await keyId())))
      .toEqual({ ok: false, kind: 'github', error: GITHUB_UNAVAILABLE, cause: 'GitHub answered 502 to GET /app' });
    expect(db.apps.size).toBe(0);
  });

  it('is not available without a master key, or without the means to check, and never asks GitHub', async () => {
    const { db, asked, service, keyId } = withApps(GOOD, null);
    const key = await keyId();
    expect(await service.attachGithubApp(ATTACH(key))).toEqual({ ok: false, kind: 'unavailable', error: NOT_AVAILABLE });
    expect(NOT_AVAILABLE).toBe("Attaching a GitHub App isn't available on this deployment.");
    const bare = apiKeysService(db.as(ADA), () => makeApiKey());
    expect(await bare.attachGithubApp(ATTACH(key))).toEqual({ ok: false, kind: 'unavailable', error: NOT_AVAILABLE });
    expect(asked).toEqual([]);
    expect(db.apps.size).toBe(0);
  });

  it('refuses a member, and another workspace’s owner, in the owners’ words, and stores nothing', async () => {
    const { db, as, keyId } = withApps();
    const key = await keyId();
    for (const person of [BEN, DAN]) {
      expect(await as(person).attachGithubApp(ATTACH(key))).toEqual({ ok: false, kind: 'forbidden', error: ONLY_OWNERS_APP });
    }
    expect(db.apps.size).toBe(0);
  });

  it('answers a key nobody holds as it answers a stranger, and a revoked key as gone', async () => {
    const { service, keyId } = withApps();
    const ghost = '00000000-0000-4000-8000-00000000ffff';
    expect(await service.attachGithubApp(ATTACH(ghost))).toEqual({ ok: false, kind: 'forbidden', error: ONLY_OWNERS_APP });
    const key = await keyId();
    await service.revoke({ workspace: NORTHWIND, key });
    expect(await service.attachGithubApp(ATTACH(key))).toEqual({ ok: false, kind: 'missing', error: GONE });
  });

  it('reads any other refusal as a failure, keeping the database’s words for the log only', async () => {
    const { db } = withApps();
    const repository: ApiKeysRepository = {
      ...db.as(ADA),
      attachGithubApp: () => Promise.resolve({ ok: false, code: '22023', hint: 'slug', message: 'Slug: the GitHub App’s slug.' }),
    };
    const service = apiKeysService(repository, () => makeApiKey(), { master: () => MASTER, check: () => Promise.resolve(GOOD) });
    expect(await service.attachGithubApp(ATTACH('k'))).toEqual({ ok: false, kind: 'database', error: FAILED, cause: '22023: Slug: the GitHub App’s slug.' });
  });
});

describe('removing a GitHub App', () => {
  it('lets an owner remove it, answering whether the key held one', async () => {
    const { db, service, keyId } = withApps();
    const key = await keyId();
    await service.attachGithubApp(ATTACH(key));
    expect(await service.removeGithubApp({ key })).toEqual({ ok: true, value: { removed: true } });
    expect(db.apps.size).toBe(0);
    expect(await service.removeGithubApp({ key })).toEqual({ ok: true, value: { removed: false } });
  });

  it('refuses a member and another workspace’s owner, and keeps the App', async () => {
    const { db, as, service, keyId } = withApps();
    const key = await keyId();
    await service.attachGithubApp(ATTACH(key));
    for (const person of [BEN, DAN]) {
      expect(await as(person).removeGithubApp({ key })).toEqual({ ok: false, kind: 'forbidden', error: ONLY_OWNERS_APP });
    }
    expect(db.apps.size).toBe(1);
  });

  it('is done with the key: revoking it deletes the App, sealed private key included', async () => {
    const { db, service, keyId } = withApps();
    const key = await keyId();
    await service.attachGithubApp(ATTACH(key));
    await service.revoke({ workspace: NORTHWIND, key });
    expect(db.apps.size).toBe(0);
  });
});

describe('what each person reads of a key’s GitHub App', () => {
  it('gives a member the slug alone, never the last token, even once one was minted', async () => {
    const { db, as, service, keyId } = withApps();
    const key = await keyId();
    await service.attachGithubApp(ATTACH(key));
    const stored = db.apps.get(key);
    if (stored) stored.lastTokenAt = '2026-10-22T09:00:00.000Z';
    const read = await as(BEN).page(NORTHWIND);
    expect(read.keys[0]?.githubApp).toEqual({ slug: 'acme-bugs' });
    expect(JSON.stringify(read)).not.toMatch(/lastTokenAt|ciphertext|PRIVATE KEY/);
  });

  it('gives an owner the slug and the last token: none until the App first mints', async () => {
    const { db, service, keyId } = withApps();
    const key = await keyId();
    await service.attachGithubApp(ATTACH(key));
    expect((await service.page(NORTHWIND)).keys[0]?.githubApp).toEqual({ slug: 'acme-bugs', lastTokenAt: null });
    const stored = db.apps.get(key);
    if (stored) stored.lastTokenAt = '2026-10-22T09:00:00.000Z';
    expect((await service.page(NORTHWIND)).keys[0]?.githubApp).toEqual({ slug: 'acme-bugs', lastTokenAt: '2026-10-22T09:00:00.000Z' });
    expect(JSON.stringify(await service.page(NORTHWIND))).not.toMatch(/ciphertext|PRIVATE KEY/);
  });

  it('reads null for a key that holds none, and reads nothing of another workspace', async () => {
    const { service, as, keyId } = withApps();
    await keyId();
    expect((await service.page(NORTHWIND)).keys[0]?.githubApp).toBeNull();
    await expect(as(DAN).page(NORTHWIND)).rejects.toThrow();
  });
});
