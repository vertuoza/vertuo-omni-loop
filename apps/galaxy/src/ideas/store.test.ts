import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { Board, IdeaRow, LANES } from './model';
import { readBoard, type IdeasDb } from './store';

// The board's read (PRD 1246, s1): ideas_board(), parsed where it comes in. What the function lets
// through is the database's to prove (supabase/checks/ideas.sql); this pins that the store asks for the
// board by owner/name as a GET, parses what comes back, and that the migration answers the very keys
// the schema reads.

const answer = {
  repo: 'acme/widgets',
  public: true,
  member: false,
  ideas: [{ id: '00000000-0000-4000-8000-000000000001', title: 'A', pitch: 'B', lane: 'next', prd: null, created_at: '2026-10-01T09:00:00+00:00', votes: 0, voted: false, archived: false }],
};

const db = (data: unknown, error: { message: string } | null = null) => {
  const rpc = vi.fn<IdeasDb['rpc']>(async () => ({ data, error }));
  return { rpc };
};

describe('readBoard', () => {
  it('asks ideas_board() for owner/name, read-only, and answers the board', async () => {
    const at = db(answer);
    expect((await readBoard(at, 'acme/widgets'))?.ideas[0]?.lane).toBe('next');
    expect(at.rpc).toHaveBeenCalledWith('ideas_board', { p_full_name: 'acme/widgets' }, { get: true });
  });

  it('answers null for a private or missing board', async () => {
    expect(await readBoard(db(null), 'acme/secret')).toBeNull();
  });

  it('throws on a refusal and on an answer that does not parse, naming the read', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(readBoard(db(null, { message: 'permission denied' }), 'acme/widgets')).rejects.toThrow('ideas/store: ideas_board: permission denied');
    await expect(readBoard(db({ ...answer, voters: ['someone'] }), 'acme/widgets')).rejects.toThrow('ideas/store: ideas_board');
    log.mockRestore();
  });
});

describe('the migration', () => {
  const read = (path: string) => readFileSync(fileURLToPath(new URL(`../../../../${path}`, import.meta.url)), 'utf8');
  const migration = read('supabase/migrations/20261115090000_ideas.sql');
  const board = /create function public\.ideas_board[\s\S]*?\n\$\$;/.exec(migration)?.[0] ?? '';

  it('answers every key the schema reads, and no other', () => {
    for (const key of [...Object.keys(Board.shape), ...Object.keys(IdeaRow.shape)]) expect(board).toContain(`'${key}'`);
    expect([...board.matchAll(/'([a-z_]+)', /g)].map(([, key]) => key).sort()).toEqual([...Object.keys(Board.shape), ...Object.keys(IdeaRow.shape)].sort());
  });

  it('stores exactly the lanes the page shows, later by default, and the spec\'s bounds', () => {
    expect(migration).toContain(`lane         text not null default 'later' check (lane in (${LANES.map((l) => `'${l}'`).join(', ')}))`);
    expect(migration).toContain('char_length(btrim(title)) between 1 and 120');
    expect(migration).toContain('char_length(btrim(pitch)) between 1 and 600');
  });

  it('is proved by supabase/checks/ideas.sql', () => {
    expect(read('supabase/checks/ideas.sql')).toContain("select 'ideas checks passed' as result;");
  });
});
