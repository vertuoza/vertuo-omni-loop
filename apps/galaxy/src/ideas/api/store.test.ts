// The ideas API's storage (PRD 1246, s2), against a stubbed Supabase client that answers only the
// calls the port makes: the caller's listing of the repository, the insert, and ideas_board().
import { describe, expect, it } from 'vitest';
import { ideasPort, IdeasRefusal, type IdeasDb } from './store';

const ACME = '00000000-0000-4000-8000-000000000ace';
const IDEA_ID = '00000000-0000-4000-8000-0000000000a1';
const ROW = { repo: 'acme/widgets', title: 'Improve the HUD', pitch: 'More facts.', lane: 'now' as const };

type Answer = { data: unknown; error: { message: string; code?: string } | null };

/** A client whose listing, insert and rpc answer as given, keeping what each was asked. */
function stubDb({ listing = { data: [{ workspace_id: ACME }], error: null }, insert = { data: { id: IDEA_ID }, error: null }, board = { data: null, error: null } }: {
  listing?: Answer; insert?: Answer; board?: Answer;
} = {}) {
  const asked: unknown[] = [];
  const chain = (result: Answer, log: unknown[]) => {
    const link = {
      select: (...a: unknown[]) => { log.push(['select', ...a]); return link; },
      eq: (...a: unknown[]) => { log.push(['eq', ...a]); return link; },
      order: (...a: unknown[]) => { log.push(['order', ...a]); return link; },
      limit: (...a: unknown[]) => { log.push(['limit', ...a]); return Promise.resolve(result); },
      insert: (...a: unknown[]) => { log.push(['insert', ...a]); return link; },
      single: () => Promise.resolve(result),
    };
    return link;
  };
  const db = {
    from: (table: string) => { asked.push(['from', table]); return chain(table === 'ideas' ? insert : listing, asked); },
    rpc: (fn: string, args: unknown) => { asked.push(['rpc', fn, args]); return Promise.resolve(board); },
  };
  // The stub answers only the calls the port makes, so it is not a whole Supabase client.
  return { asked, db: db as unknown as IdeasDb };
}

describe('ideasPort.add', () => {
  it('files the idea in the caller\'s workspace that lists the repository, and answers its id', async () => {
    const { asked, db } = stubDb();
    expect(await ideasPort(db).add(ROW)).toEqual({ id: IDEA_ID });
    expect(asked).toEqual([
      ['from', 'repositories'], ['select', 'workspace_id'], ['eq', 'full_name', 'acme/widgets'], ['order', 'added_at'], ['limit', 1],
      ['from', 'ideas'], ['insert', { workspace_id: ACME, ...ROW }], ['select', 'id'],
    ]);
  });

  it('refuses with 403 when no workspace of the caller lists the repository, inserting nothing', async () => {
    const { asked, db } = stubDb({ listing: { data: [], error: null } });
    await expect(ideasPort(db).add(ROW)).rejects.toEqual(new IdeasRefusal(403, 'No workspace of yours lists acme/widgets.'));
    expect(asked).not.toContainEqual(['from', 'ideas']);
  });

  it('turns the database\'s refusal of the insert into a 403 or a 400, and any other failure into an error', async () => {
    const refused = stubDb({ insert: { data: null, error: { message: 'rls', code: '42501' } } });
    await expect(ideasPort(refused.db).add(ROW)).rejects.toMatchObject({ name: 'IdeasRefusal', status: 403 });
    const broken = stubDb({ insert: { data: null, error: { message: 'check', code: '23514' } } });
    await expect(ideasPort(broken.db).add(ROW)).rejects.toMatchObject({ name: 'IdeasRefusal', status: 400 });
    const down = stubDb({ insert: { data: null, error: { message: 'connection reset', code: '08006' } } });
    await expect(ideasPort(down.db).add(ROW)).rejects.toThrow('ideas/api/store: ideas: connection reset');
    const unread = stubDb({ listing: { data: null, error: { message: 'timeout' } } });
    await expect(ideasPort(unread.db).add(ROW)).rejects.toThrow('ideas/api/store: repositories: timeout');
  });
});

describe('ideasPort.board', () => {
  it('reads ideas_board() as the caller', async () => {
    const board = { repo: 'acme/widgets', public: false, member: true, ideas: [] };
    const { asked, db } = stubDb({ board: { data: board, error: null } });
    expect(await ideasPort(db).board('acme/widgets')).toEqual(board);
    expect(asked).toEqual([['rpc', 'ideas_board', { p_full_name: 'acme/widgets' }]]);
  });
});
