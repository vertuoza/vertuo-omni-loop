import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadBoard, supabaseReads, type BoardReads, type BoardRequest } from './load';
import type { Activity, Member } from './tally';

// The board's loader on fake reads (PRD 572): the Paul case (a member with no player row and no
// points, who merged seven PRs and answered nine questions, is a People row with 7, 9 and 0 points),
// the scopes, and each read failing alone, leaving only its parts unreadable.

/** Saturday 26 September 2026, noon in Brussels. */
const NOW = new Date('2026-09-26T10:00:00Z');

const member = (userId: string, login: string | null, fleet: string | null, name: string | null): Member =>
  ({ userId, name, login, avatarUrl: null, fleet });
const ROSTER: Member[] = [
  member('u-ada', 'ada-gh', 'octo', 'ADA'),
  member('u-paul', 'paetienne', 'octo', 'Paul Etienne'),
  member('u-bob', 'bob-gh', 'beaver', 'BOB'),
];
const merged = (login: string, n: number, repo = 'vertuo-ai-domain'): Activity =>
  ({ kind: 'pr-merged', repo, number: n, login, at: '2026-09-25T08:00:00Z' });
const ACTIVITY: Activity[] = [
  ...Array.from({ length: 7 }, (_, i) => merged('paetienne', 100 + i)),
  merged('bob-gh', 1, 'vertuo-core'),
  merged('stranger', 2, 'vertuo-core'),
  { kind: 'prd-opened', repo: 'vertuo-omni-loop', number: 12, login: 'ada-gh', at: '2026-09-24T08:00:00Z' },
];
const GALAXY = {
  heroes: [{ name: 'ada-gh', points: 120 }, { name: 'bob-gh', points: 300 }],
  teams: [
    { name: 'beaver', label: 'BEAVER', color: '#8a5a2b', points: 300, rank: 1 },
    { name: 'octo', label: 'OCTO', color: '#3355ff', points: 120, rank: 2 },
  ],
};

const reads = (fail: Partial<Record<keyof BoardReads, boolean>> = {}): BoardReads & { calls: Record<string, unknown[]> } => {
  const calls: Record<string, unknown[]> = {};
  const read = <T>(name: keyof BoardReads, value: T) => async (...args: unknown[]) => {
    calls[name] = args;
    if (fail[name]) throw new Error(`${name} is down`);
    return value;
  };
  return {
    calls,
    roster: read('roster', ROSTER),
    activity: read('activity', ACTIVITY),
    answered: read('answered', [{ user_id: 'u-paul', answered: 9 }, { user_id: 'u-bob', answered: 2 }]),
    galaxy: read('galaxy', GALAXY),
  };
};
const WORKSPACE: BoardRequest = { scope: { kind: 'workspace' }, people: { kind: 'workspace' }, viewerId: 'u-ada', period: '7d', now: NOW };

beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { vi.restoreAllMocks(); });

describe('loadBoard', () => {
  it('lists Paul, with no player row and no points, with his 7 PRs, 9 answers and 0 points', async () => {
    const board = await loadBoard(reads(), WORKSPACE);
    if (board.people === 'unreadable') throw new Error('people unreadable');
    expect(board.people.find((p) => p.userId === 'u-paul')).toMatchObject({ prs: 7, answered: 9, points: 0, name: 'Paul Etienne' });
    expect(board.people.map((p) => p.userId)).toEqual(['u-paul', 'u-bob', 'u-ada']);
  });

  it('reads the period\'s window: its first Brussels midnight to the one after today', async () => {
    const r = reads();
    await loadBoard(r, WORKSPACE);
    expect((r.calls.activity as Date[]).map((d) => d.toISOString())).toEqual(['2026-09-19T22:00:00.000Z', '2026-09-26T22:00:00.000Z']);
    expect(r.calls.answered).toEqual(r.calls.activity);
  });

  it('the workspace: a non-member\'s merge counts in the tiles and repositories, with no row', async () => {
    const board = await loadBoard(reads(), WORKSPACE);
    expect(board.tiles).toEqual({ prs: 9, prds: { drafted: 1, inProgress: 0, shipped: 0 }, repositories: 3, answered: 11 });
    expect(board.repositories).toEqual([
      { repo: 'vertuo-ai-domain', prs: 7, prdEvents: 0 },
      { repo: 'vertuo-core', prs: 2, prdEvents: 0 },
      { repo: 'vertuo-omni-loop', prs: 0, prdEvents: 1 },
    ]);
    expect((board.people as unknown[]).length).toBe(3);
  });

  it('a fleet: its members\' activity and questions, and its members\' rows', async () => {
    const board = await loadBoard(reads(), { ...WORKSPACE, scope: { kind: 'fleet', fleet: 'octo' }, people: { kind: 'fleet', fleet: 'octo' } });
    expect(board.tiles).toEqual({ prs: 7, prds: { drafted: 1, inProgress: 0, shipped: 0 }, repositories: 2, answered: 9 });
    expect((board.people as { userId: string }[]).map((p) => p.userId)).toEqual(['u-paul', 'u-ada']);
  });

  it('you: your activity and questions, and the People table of the scope asked for', async () => {
    const board = await loadBoard(reads(), {
      ...WORKSPACE, viewerId: 'u-paul', scope: { kind: 'you', userId: 'u-paul', login: 'PaEtienne' }, people: { kind: 'fleet', fleet: 'octo' },
    });
    expect(board.tiles).toMatchObject({ prs: 7, answered: 9, repositories: 1 });
    expect((board.merges as { count: number }[]).map((d) => d.count)).toEqual([0, 0, 0, 0, 0, 7, 0]);
    expect((board.people as { userId: string; you: boolean }[]).filter((p) => p.you).map((p) => p.userId)).toEqual(['u-paul']);
  });

  it('the season\'s fleet ranking, the viewer\'s fleet marked', async () => {
    const board = await loadBoard(reads(), WORKSPACE);
    expect(board.fleets).toEqual([
      { rank: 1, name: 'beaver', label: 'BEAVER', points: 300, yours: false },
      { rank: 2, name: 'octo', label: 'OCTO', points: 120, yours: true },
    ]);
  });
});

describe('loadBoard, one read failing', () => {
  it('the roster: only People, and the rest counts', async () => {
    const board = await loadBoard(reads({ roster: true }), WORKSPACE);
    expect(board.people).toBe('unreadable');
    expect(board.tiles.prs).toBe(9);
    expect(board.fleets).not.toBe('unreadable');
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('roster is down'));
  });

  it('the roster, for a fleet: everything the fleet filters, not the fleet ranking', async () => {
    const board = await loadBoard(reads({ roster: true }), { ...WORKSPACE, scope: { kind: 'fleet', fleet: 'octo' }, people: { kind: 'fleet', fleet: 'octo' } });
    expect(board.tiles).toEqual({ prs: 'unreadable', prds: 'unreadable', repositories: 'unreadable', answered: 'unreadable' });
    expect([board.merges, board.prdEvents, board.repositories, board.people]).toEqual(['unreadable', 'unreadable', 'unreadable', 'unreadable']);
    expect(board.fleets).not.toBe('unreadable');
  });

  it('the contributions: three tiles, both charts, the repositories and People\'s PRs and PRDs', async () => {
    const board = await loadBoard(reads({ activity: true }), WORKSPACE);
    expect(board.tiles).toEqual({ prs: 'unreadable', prds: 'unreadable', repositories: 'unreadable', answered: 11 });
    expect([board.merges, board.prdEvents, board.repositories]).toEqual(['unreadable', 'unreadable', 'unreadable']);
    expect((board.people as unknown[])[0]).toMatchObject({ prs: 'unreadable', prds: 'unreadable' });
  });

  it('the answered counts: the Questions tile and People\'s questions', async () => {
    const board = await loadBoard(reads({ answered: true }), WORKSPACE);
    expect(board.tiles.answered).toBe('unreadable');
    expect(board.tiles.prs).toBe(9);
    expect((board.people as { answered: unknown }[]).every((p) => p.answered === 'unreadable')).toBe(true);
  });

  it('the galaxy: People\'s points and the fleet ranking', async () => {
    const board = await loadBoard(reads({ galaxy: true }), WORKSPACE);
    expect(board.fleets).toBe('unreadable');
    expect((board.people as { points: unknown }[]).every((p) => p.points === 'unreadable')).toBe(true);
    expect(board.tiles.prs).toBe(9);
  });
});

describe('supabaseReads', () => {
  const galaxy = async () => { throw new Error('unused'); };

  it('reads the roster through workspace_roster, logins in lower case', async () => {
    const rpc = vi.fn(async () => ({ data: [{ user_id: 'u', name: null, github_login: 'PaEtienne', avatar_url: null, fleet: null }], error: null }));
    const r = supabaseReads({ rpc } as never, 'w-1', galaxy as never);
    expect(await r.roster()).toEqual([{ userId: 'u', name: null, login: 'paetienne', avatarUrl: null, fleet: null }]);
    expect(rpc).toHaveBeenCalledWith('workspace_roster', { workspace: 'w-1' });
  });

  it('reads the answered counts through answered_counts, for the window', async () => {
    const rpc = vi.fn(async () => ({ data: [{ user_id: 'u', answered: '3' }], error: null }));
    const r = supabaseReads({ rpc } as never, 'w-1', galaxy as never);
    expect(await r.answered(new Date('2026-09-19T22:00:00Z'), new Date('2026-09-26T22:00:00Z'))).toEqual([{ user_id: 'u', answered: 3 }]);
    expect(rpc).toHaveBeenCalledWith('answered_counts', { workspace: 'w-1', from_at: '2026-09-19T22:00:00.000Z', to_at: '2026-09-26T22:00:00.000Z' });
  });

  it('throws when a function fails', async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { message: 'boom' } }));
    const r = supabaseReads({ rpc } as never, 'w-1', galaxy as never);
    await expect(r.roster()).rejects.toThrow(/members.*boom/);
    await expect(r.answered(new Date(), new Date())).rejects.toThrow(/answered.*boom/);
  });

  it('reads the workspace\'s contributions in [from, to), page by page', async () => {
    const pages = [Array.from({ length: 1000 }, (_, i) => ({ kind: 'pr-merged', repo: 'r', number: i, login: 'a', at: 'x' })), [{ kind: 'pr-merged', repo: 'r', number: 1000, login: 'a', at: 'x' }]];
    const filters: unknown[][] = [];
    const query = (): Record<string, unknown> => {
      const q: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'gte', 'lt', 'order']) q[m] = (...args: unknown[]) => { filters.push([m, ...args]); return q; };
      q.range = async () => ({ data: pages.shift(), error: null });
      return q;
    };
    const r = supabaseReads({ from: () => query() } as never, 'w-1', galaxy as never);
    const rows = await r.activity(new Date('2026-09-19T22:00:00Z'), new Date('2026-09-26T22:00:00Z'));
    expect(rows).toHaveLength(1001);
    expect(filters).toContainEqual(['eq', 'workspace_id', 'w-1']);
    expect(filters).toContainEqual(['gte', 'at', '2026-09-19T22:00:00.000Z']);
    expect(filters).toContainEqual(['lt', 'at', '2026-09-26T22:00:00.000Z']);
  });
});
