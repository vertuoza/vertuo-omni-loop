import type { SupabaseClient, User } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sure } from '../../arcade/sure';

vi.mock('server-only', () => ({}));

// Home's reads, started at once (PRD 657 s4), with the database's readers stubbed: each part's promise
// stands alone, so Waiting for you arrives while the player row is still being read, and a read that
// fails leaves only its own part 'unreadable'.
const reads = vi.hoisted(() => ({
  me: vi.fn((..._args: unknown[]): Promise<unknown> => Promise.resolve({ display_name: 'ADA', github_login: 'Ada-GH', team: 'beaver', hero: null })),
  fleets: vi.fn((..._args: unknown[]) => Promise.resolve([{ name: 'beaver', label: 'BEAVER', color: '#d08a4a' }])),
  galaxy: vi.fn((..._args: unknown[]): Promise<unknown> => Promise.resolve({ heroes: [], teams: [] })),
  board: vi.fn((..._args: unknown[]): Promise<unknown> => Promise.resolve('the board')),
  supabaseReads: vi.fn((..._args: unknown[]) => 'the reads'),
}));
vi.mock('../../data/load-galaxy', () => ({ loadMe: reads.me, loadFleets: reads.fleets, loadGalaxy: reads.galaxy }));
vi.mock('../board/load', () => ({ loadBoard: reads.board, supabaseReads: reads.supabaseReads }));

const { homeParts } = await import('./home');

const DB = {} as SupabaseClient;
const USER = { id: 'u-ada', email: 'ada@vertuoza.com', user_metadata: {}, identities: [] } as unknown as User;
const NOW = new Date('2026-09-28T10:00:00Z');
const QUESTION = { kind: 'question', id: 'r1', sessionTitle: 's', question: 'q', askedAt: 0, sharedBy: null } as const;

/** A read that stays pending until `resolve` is called. */
function pending<T>() {
  let resolve!: (value: T) => void;
  const read = new Promise<T>((yes) => { resolve = yes; });
  return { read, resolve };
}

beforeEach(() => { for (const fn of Object.values(reads)) fn.mockClear(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('Home\'s parts, each on its own', () => {
  it('counts Waiting for you from the layout\'s questions, without waiting for the player row', async () => {
    const me = pending<unknown>();
    reads.me.mockReturnValueOnce(me.read);
    const parts = homeParts(DB, USER, 'w1', '7d', NOW, () => Promise.resolve([QUESTION]));
    expect(await parts.waiting).toEqual({ count: 1, href: expect.any(String) });
    me.resolve(null);
  });

  it('heads the hero block with the player\'s name, and draws the board for their fleet', async () => {
    const parts = homeParts(DB, USER, 'w1', '30d', NOW, () => Promise.resolve([]));
    const you = await parts.you;
    expect(you.name).toBe('ADA');
    expect(you.you).toMatchObject({ kind: 'player', fleet: { name: 'beaver' } });
    expect(await parts.board).toEqual({ board: 'the board', solo: false });
    const [, request] = reads.board.mock.calls[0] as [unknown, { scope: unknown; people: unknown; period: string }];
    expect(request).toMatchObject({ scope: { kind: 'you', userId: 'u-ada', login: 'ada-gh' }, people: { kind: 'fleet', fleet: 'beaver' }, period: '30d' });
    expect(reads.supabaseReads).toHaveBeenCalledWith(DB, 'w1', expect.any(Function));
  });

  it('reads the galaxy once for the hero block and the board', async () => {
    reads.board.mockImplementationOnce(async (r: unknown) => {
      await (sure(reads.supabaseReads.mock.calls[0], 'reads.supabaseReads.mock.calls[0]')[2] as () => Promise<unknown>)();
      return r;
    });
    const parts = homeParts(DB, USER, 'w1', '7d', NOW, () => Promise.resolve([]));
    await Promise.all([parts.you, parts.board]);
    expect(reads.galaxy).toHaveBeenCalledTimes(1);
  });

  it('with no player row: no team, the board of your own row and the line to Fleet', async () => {
    reads.me.mockResolvedValueOnce(null);
    const parts = homeParts(DB, USER, 'w1', '7d', NOW, () => Promise.resolve([]));
    expect((await parts.you).you).toEqual({ kind: 'no-player' });
    expect((await parts.board).solo).toBe(true);
  });

  it('a player row that cannot be read leaves the hero block unreadable, and the rest renders', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    reads.me.mockRejectedValueOnce(new Error('down'));
    const parts = homeParts(DB, USER, 'w1', '7d', NOW, () => Promise.resolve([QUESTION]));
    expect((await parts.you).you).toBe('unreadable');
    expect(await parts.board).toEqual({ board: 'the board', solo: true });
    expect((await parts.waiting)).toMatchObject({ count: 1 });
  });

  it('questions that cannot be read leave only Waiting for you unreadable', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const parts = homeParts(DB, USER, 'w1', '7d', NOW, () => Promise.reject(new Error('down')));
    expect(await parts.waiting).toBe('unreadable');
    expect((await parts.you).name).toBe('ADA');
  });
});
