import { describe, expect, it } from 'vitest';
import { ADA, BEN, DAN, fakeApiKeysDb, NORTHWIND, SOUTHWIND } from './api-keys.fake';
import { apiKeysService, FAILED, GONE, NAME_RULE, nameTaken, ONLY_OWNERS, REPOS_RULE, TOO_MANY } from './api-keys.service';
import type { ApiKeysRepository } from './api-keys.repository';
import { makeApiKey } from './secret';

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
