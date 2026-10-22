import { describe, expect, it } from 'vitest';
import { ADA, BEN, fakeApiKeysDb, NORTHWIND } from '../keys/api-keys.fake';
import { apiKeysService } from '../keys/api-keys.service';
import { makeApiKey } from '../keys/secret';
import { loadApiKeysPage } from './load';

// Settings › API keys' read (PRD 2022 s1), on the keys' service over the database in memory.

const db = fakeApiKeysDb();
const as = (person: string) => apiKeysService(db.as(person), () => makeApiKey());
await as(ADA).make({ workspace: NORTHWIND, name: 'QA dashboard', repos: ['northwind/backend'] });

describe('Settings › API keys’ read', () => {
  it('gives an owner the keys and the repositories to pick from', async () => {
    const view = await loadApiKeysPage({ workspace: () => Promise.resolve({ id: NORTHWIND }), page: (ws) => as(ADA).page(ws) });
    expect(view).toMatchObject({ kind: 'keys', source: { kind: 'database', workspace: NORTHWIND }, owner: true, tracked: ['northwind/backend', 'northwind/web'] });
    expect(view.kind === 'keys' && view.keys.map((k) => k.name)).toEqual(['QA dashboard']);
  });

  it('gives a member the keys, without the repositories', async () => {
    const view = await loadApiKeysPage({ workspace: () => Promise.resolve({ id: NORTHWIND }), page: (ws) => as(BEN).page(ws) });
    expect(view).toMatchObject({ kind: 'keys', owner: false, tracked: [] });
  });

  it('says so when the person is in no workspace', async () => {
    expect(await loadApiKeysPage({ workspace: () => Promise.resolve(null), page: () => Promise.reject(new Error('unread')) })).toEqual({ kind: 'no-workspace' });
  });

  it('reads as unreadable when a read fails', async () => {
    expect(await loadApiKeysPage({ workspace: () => Promise.resolve({ id: NORTHWIND }), page: (ws) => as('stranger').page(ws) })).toEqual({ kind: 'unreadable' });
    expect(await loadApiKeysPage({ workspace: () => Promise.reject(new Error('down')), page: (ws) => as(ADA).page(ws) })).toEqual({ kind: 'unreadable' });
  });
});
