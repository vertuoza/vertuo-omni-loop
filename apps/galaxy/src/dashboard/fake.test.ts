import { describe, expect, it } from 'vitest';
import { ACME, contribution, fakeGalaxyDb, PEOPLE, twoWorkspaces, VERTUOZA } from '../data/galaxy.fake';

// The fake database the dashboard's loaders are tested on (src/data/galaxy.fake.ts), for the reads
// the dashboard adds (PRD 328): the `contributions` table the game workflow fills, read under the
// row-level security of its migration (a member reads their workspace's rows, nobody writes one),
// and the range, list and pattern filters a loader sends to read a week, a season or a prefix.

const world = () => fakeGalaxyDb(twoWorkspaces(), Object.values(PEOPLE));
type Rows = Array<Record<string, unknown>>;
const numbers = (rows: unknown) => (rows as Rows).map((r) => `${r.repo}#${r.number}`);

describe('the fake\'s contributions', () => {
  it('holds each workspace\'s rows, as the game workflow writes them: a kind, a repository, a number, a lower-cased login and when', async () => {
    const { data, error } = await world().client(PEOPLE.ada).from('contributions').select('*').eq('workspace_id', VERTUOZA);
    expect(error).toBeNull();
    expect((data as Rows).length).toBeGreaterThan(0);
    for (const row of data as Rows) {
      expect(row).toMatchObject({ workspace_id: VERTUOZA, kind: expect.stringMatching(/^(pr-merged|prd-opened)$/) });
      expect(row.login).toBe(String(row.login).toLowerCase());
      expect(Number.isNaN(Date.parse(String(row.at)))).toBe(false);
    }
  });

  it('shows a member their workspace\'s rows only: another workspace\'s, and anyone signed out, read none', async () => {
    const w = world();
    const mine = await w.client(PEOPLE.ada).from('contributions').select('workspace_id');
    expect(new Set((mine.data as Rows).map((r) => r.workspace_id))).toEqual(new Set([VERTUOZA]));
    const theirs = await w.client(PEOPLE.ada).from('contributions').select('*').eq('workspace_id', ACME);
    expect(theirs.data).toEqual([]);
    const nobody = await w.client(null).from('contributions').select('*');
    expect(nobody.data).toEqual([]);
  });

  it('keeps a person of two workspaces\' rows apart: the workspace filter decides', async () => {
    const w = world();
    const both = w.client(PEOPLE.both);
    const vertuoza = await both.from('contributions').select('*').eq('workspace_id', VERTUOZA).eq('login', 'both-gh');
    const acme = await both.from('contributions').select('*').eq('workspace_id', ACME).eq('login', 'both-gh');
    expect((vertuoza.data as Rows).length).toBeGreaterThan(0);
    expect((acme.data as Rows).length).toBeGreaterThan(0);
    expect(new Set([...(vertuoza.data as Rows), ...(acme.data as Rows)].map((r) => r.workspace_id))).toEqual(new Set([VERTUOZA, ACME]));
  });

  it('lets no signed-in person write a row', async () => {
    const w = world();
    const before = w.tables.contributions.length;
    const insert = await w.client(PEOPLE.ada).from('contributions')
      .insert(contribution(VERTUOZA, 'pr-merged', 'vertuo-core', 999, 'ada-gh', '2026-09-26T08:00:00Z'));
    expect(insert.error?.code).toBe('42501');
    expect(w.tables.contributions).toHaveLength(before);
  });

  it('can be seeded and failed like every other table', async () => {
    const w = fakeGalaxyDb({ ...twoWorkspaces(), contributions: [] }, Object.values(PEOPLE));
    w.tables.contributions.push(contribution(VERTUOZA, 'prd-opened', 'vertuo-core', 7, 'ada-gh', '2026-09-03T08:00:00Z'));
    const read = await w.client(PEOPLE.ada).from('contributions').select('number').eq('workspace_id', VERTUOZA);
    expect(read.data).toEqual([{ number: 7 }]);
    w.state.failOn = 'contributions';
    const failed = await w.client(PEOPLE.ada).from('contributions').select('*');
    expect(failed.error?.message).toMatch(/contributions/);
  });
});

describe('the fake\'s filters', () => {
  const seeded = () => fakeGalaxyDb({
    ...twoWorkspaces(),
    contributions: [
      contribution(VERTUOZA, 'pr-merged', 'vertuo-core', 1, 'ada-gh', '2026-08-31T23:59:59Z'),
      contribution(VERTUOZA, 'pr-merged', 'vertuo-core', 2, 'ada-gh', '2026-09-01T00:00:00Z'),
      contribution(VERTUOZA, 'pr-merged', 'vertuo-core', 3, 'ada-gh', '2026-09-15T12:00:00Z'),
      contribution(VERTUOZA, 'prd-opened', 'vertuo-core', 4, 'both-gh', '2026-09-30T23:59:59Z'),
      contribution(VERTUOZA, 'pr-merged', 'vertuo-core', 5, 'both-gh', '2026-10-01T00:00:00Z'),
    ],
  }, Object.values(PEOPLE));
  const read = () => seeded().client(PEOPLE.ada).from('contributions').select('*').eq('workspace_id', VERTUOZA);

  it('reads a range of instants: gte and lt, gt and lte', async () => {
    expect(numbers((await read().gte('at', '2026-09-01T00:00:00Z').lt('at', '2026-10-01T00:00:00Z')).data)).toEqual(['vertuo-core#2', 'vertuo-core#3', 'vertuo-core#4']);
    expect(numbers((await read().gt('at', '2026-09-01T00:00:00Z').lte('at', '2026-09-30T23:59:59Z')).data)).toEqual(['vertuo-core#3', 'vertuo-core#4']);
  });

  it('compares instants as instants, whatever their spelling', async () => {
    expect(numbers((await read().gte('at', '2026-09-01T02:00:00+02:00').lt('at', '2026-09-01T00:00:01.000Z')).data)).toEqual(['vertuo-core#2']);
  });

  it('reads a list, a difference and a pattern: in, neq, like and ilike', async () => {
    expect(numbers((await read().in('number', [1, 5])).data)).toEqual(['vertuo-core#1', 'vertuo-core#5']);
    expect(numbers((await read().neq('kind', 'pr-merged')).data)).toEqual(['vertuo-core#4']);
    expect(numbers((await read().like('login', 'both%')).data)).toEqual(['vertuo-core#4', 'vertuo-core#5']);
    expect(numbers((await read().like('login', 'BOTH%')).data)).toEqual([]);
    expect(numbers((await read().ilike('login', 'BOTH-G_')).data)).toEqual(['vertuo-core#4', 'vertuo-core#5']);
  });

  it('counts, with or without the rows: select(…, { count: \'exact\', head })', async () => {
    const counted = await seeded().client(PEOPLE.ada).from('contributions').select('*', { count: 'exact', head: true })
      .eq('workspace_id', VERTUOZA).eq('kind', 'pr-merged');
    expect(counted).toMatchObject({ data: null, count: 4, error: null });
    const both = await seeded().client(PEOPLE.ada).from('contributions').select('number', { count: 'exact' }).eq('login', 'both-gh');
    expect(both).toMatchObject({ data: [{ number: 4 }, { number: 5 }], count: 2 });
  });

  it('records each filter beside the eq ones, so a test can see a loader filtered by workspace and by time', async () => {
    const w = seeded();
    await w.client(PEOPLE.ada).from('contributions').select('*').eq('workspace_id', VERTUOZA).gte('at', '2026-09-01T00:00:00Z');
    expect(w.calls.at(-1)).toEqual({
      kind: 'from', table: 'contributions', op: 'select', eq: { workspace_id: VERTUOZA },
      filters: [{ column: 'at', op: 'gte', value: '2026-09-01T00:00:00Z' }],
    });
  });

  it('records a query with eq filters only exactly as before', async () => {
    const w = seeded();
    await w.client(PEOPLE.ada).from('players').select('*').eq('workspace_id', VERTUOZA);
    expect(w.calls.at(-1)).toEqual({ kind: 'from', table: 'players', op: 'select', eq: { workspace_id: VERTUOZA } });
  });
});
