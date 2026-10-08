import { describe, expect, it } from 'vitest';
import type { Db } from '../dossier/page/source';
import { conceptCards, conceptListState, readConcepts, type ConceptRow } from './list';
import { CONCEPT_1269, conceptRow, listed } from './list.fixture';

// The Concepts list (PRD 1272, s2): one card per concept dossier of the workspace, newest first, read
// from dossier_list() and each concept's latest concept.md. Nothing here reaches Supabase: the reads go
// through a stubbed client.

describe('conceptCards', () => {
  it('shows concept #1269 with its title, kind, scale, areas with a PRD and the date it was recorded', () => {
    const [card] = conceptCards([conceptRow('c-1269', 1269, '2026-10-06T09:00:00Z')], new Map([['c-1269', CONCEPT_1269]]));
    expect(card).toEqual({
      id: 'c-1269', href: '/concepts/c-1269', number: 1269, title: 'Products replace plan repositories, with phase 0 approved on the server',
      kind: 'platform', scale: 'vast', areas: { withPrd: 0, total: 6 }, recordedAt: '2026-10-06T09:00:00Z', recorded: '6 Oct 2026',
    });
  });

  it('counts the areas whose PRD cell is filled', () => {
    const one = CONCEPT_1269.replace(/^(\| server-approval \|.*\| )\|$/m, '$1#1300 |');
    expect(one).not.toBe(CONCEPT_1269);
    const [card] = conceptCards([conceptRow('c-1269', 1269, '2026-10-06T09:00:00Z')], new Map([['c-1269', one]]));
    expect(card?.areas).toEqual({ withPrd: 1, total: 6 });
  });

  it('lists the newest first', () => {
    const rows = [conceptRow('old', 746, '2026-09-01T09:00:00Z'), conceptRow('new', 1269, '2026-10-06T09:00:00Z')];
    expect(conceptCards(rows, new Map()).map((c) => c.id)).toEqual(['new', 'old']);
  });

  it('keeps a concept whose concept.md is missing or does not parse, its kind, scale and areas unknown', () => {
    const rows = [conceptRow('a', 1, '2026-10-06T09:00:00Z'), conceptRow('b', 2, '2026-10-05T09:00:00Z')];
    const cards = conceptCards(rows, new Map([['b', 'not a concept']]));
    expect(cards.map((c) => [c.id, c.kind, c.scale, c.areas])).toEqual([['a', null, null, null], ['b', null, null, null]]);
  });
});

describe('readConcepts', () => {
  /** A client whose dossier_list() returns `rows` and whose versions hold `contents`, by version id. */
  function stub(rows: unknown[], contents: Record<string, string>) {
    const calls: string[] = [];
    const db = {
      rpc: (fn: string, args: unknown) => {
        calls.push(`rpc ${fn} ${JSON.stringify(args)}`);
        return Promise.resolve({ data: rows, error: null });
      },
      from: (table: string) => ({
        select: () => ({
          eq: (_column: string, id: string) => ({
            maybeSingle: () => {
              calls.push(`from ${table} ${id}`);
              return Promise.resolve({ data: id in contents ? { content: contents[id] } : null, error: null });
            },
          }),
        }),
      }),
    };
    return { db: db as unknown as Db, calls };
  }

  it('keeps only the concept rows of dossier_list(), each with its latest concept.md read once', async () => {
    const rows: ConceptRow[] = [conceptRow('c-1269', 1269, '2026-10-06T09:00:00Z', 'v-1269')];
    const { db, calls } = stub([listed('p-7', 'prd'), ...rows, listed('b-9', 'bug'), listed('v-3', 'visual')], { 'v-1269': CONCEPT_1269 });
    const cards = await readConcepts(db);
    expect(cards.map((c) => [c.id, c.areas])).toEqual([['c-1269', { withPrd: 0, total: 6 }]]);
    expect(calls).toEqual(['rpc dossier_list {"p_dossier":null}', 'from dossier_versions v-1269']);
  });

  it('reads no version of a concept that has no concept.md yet', async () => {
    const { db, calls } = stub([conceptRow('c-1', 1, '2026-10-06T09:00:00Z', null)], {});
    expect((await readConcepts(db)).map((c) => c.kind)).toEqual([null]);
    expect(calls).toEqual(['rpc dossier_list {"p_dossier":null}']);
  });

  it('lists none when the workspace has no concept', async () => {
    const { db } = stub([listed('p-7', 'prd')], {});
    expect(await readConcepts(db)).toEqual([]);
  });

  it('rejects when the list cannot be read', async () => {
    const db = { rpc: () => Promise.resolve({ data: null, error: { message: 'down' } }), from: () => { throw new Error('unused'); } } as unknown as Db;
    await expect(readConcepts(db)).rejects.toThrow(/history/);
  });
});

describe('conceptListState', () => {
  const db = {} as Db;
  const cards = conceptCards([conceptRow('c-1269', 1269, '2026-10-06T09:00:00Z')], new Map());
  const reads = () => Promise.resolve(cards);

  it('lists none in the demo, which holds no concept, without asking for a session', async () => {
    const session = () => Promise.reject(new Error('the demo asks for no session'));
    expect(await conceptListState('demo', session, reads)).toEqual({ kind: 'listed', cards: [] });
  });

  it('is closed when this deployment keeps no dossier', async () => {
    expect(await conceptListState('closed', () => Promise.resolve(null), reads)).toEqual({ kind: 'closed' });
  });

  it('asks a signed-out person to sign in, reading nothing', async () => {
    const never = () => Promise.reject(new Error('read while signed out'));
    expect(await conceptListState('supabase', () => Promise.resolve({ db, user: null }), never)).toEqual({ kind: 'signed-out' });
  });

  it('lists the cards read as the signed-in person', async () => {
    expect(await conceptListState('supabase', () => Promise.resolve({ db, user: { id: 'u-1' } }), reads)).toEqual({ kind: 'listed', cards });
  });

  it('says the database did not answer when the read fails', async () => {
    const fails = () => Promise.reject(new Error('down'));
    expect(await conceptListState('supabase', () => Promise.resolve({ db, user: { id: 'u-1' } }), fails)).toEqual({ kind: 'down' });
  });
});
