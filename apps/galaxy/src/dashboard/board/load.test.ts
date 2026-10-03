import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeStageStore } from '../../stages/store.fake';
import { loadBoard, supabaseReads, type BoardReads, type BoardRequest } from './load';
import type { Activity, Member, PrdNow } from './tally';
import { sure } from '../../arcade/sure';

// The board's loader on fake reads (PRD 572): the Paul case (a member with no player row and no
// points, who merged seven PRs and answered nine questions, is a People row with 7, 9 and 0 points),
// the scopes, and each read failing alone, leaving only its parts unreadable. PRD 587: the PRDs tile
// and People's PRDs count the PRDs now, read through the stage store, not the period's events.

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
/** Ada opened three PRDs (one shipped, one building, one an idea), Paul one at inbox, Bob one shipped;
 * a sixth, at retro, has no known opener. */
const PRDS: PrdNow[] = [
  { stage: 'shipped', login: 'ada-gh', userId: null },
  { stage: 'building', login: 'ada-gh', userId: 'u-ada' },
  { stage: 'idea', login: null, userId: 'u-ada' },
  { stage: 'inbox', login: 'paetienne', userId: null },
  { stage: 'shipped', login: 'bob-gh', userId: null },
  { stage: 'retro', login: null, userId: null },
];
const tallyOf = (over: Partial<Record<string, number>>) =>
  ({ idea: 0, prd: 0, inbox: 0, building: 0, outbox: 0, shipped: 0, retro: 0, ...over });
const GALAXY = {
  heroes: [{ name: 'ada-gh', points: 120 }, { name: 'bob-gh', points: 300 }],
  teams: [
    { name: 'beaver', label: 'BEAVER', color: '#8a5a2b', points: 300, rank: 1 },
    { name: 'octo', label: 'OCTO', color: '#3355ff', points: 120, rank: 2 },
  ],
};

const reads = (fail: Partial<Record<keyof BoardReads, boolean>> = {}): BoardReads & { calls: Record<string, unknown[]> } => {
  const calls: Record<string, unknown[]> = {};
  const read = <T>(name: keyof BoardReads, value: T) => (...args: unknown[]) => {
    calls[name] = args;
    if (fail[name]) return Promise.reject(new Error(`${name} is down`));
    return Promise.resolve(value);
  };
  return {
    calls,
    roster: read('roster', ROSTER),
    activity: read('activity', ACTIVITY),
    answered: read('answered', [{ user_id: 'u-paul', answered: 9 }, { user_id: 'u-bob', answered: 2 }]),
    galaxy: read('galaxy', GALAXY),
    prds: read('prds', PRDS),
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

  it('carries each fleet\'s mascot to its People rows, and each member\'s face', async () => {
    const galaxy = { ...GALAXY, teams: GALAXY.teams.map((t) => ({ ...t, mascot: t.name === 'beaver' ? 'beaver' : null })) };
    const board = await loadBoard({ ...reads(), galaxy: () => Promise.resolve(galaxy) }, WORKSPACE);
    if (board.people === 'unreadable') throw new Error('people unreadable');
    const bob = sure(board.people.find((p) => p.userId === 'u-bob'), 'the item found');
    expect(bob.fleet).toEqual({ name: 'beaver', label: 'BEAVER', color: '#8a5a2b', mascot: 'beaver' });
    expect(bob.face).toEqual({ kind: 'photo', url: 'https://github.com/bob-gh.png?size=48' });
    expect(sure(board.people.find((p) => p.userId === 'u-ada'), 'the item found').fleet).toMatchObject({ name: 'octo', mascot: null });
  });

  it('reads the period\'s window: its first Brussels midnight to the one after today', async () => {
    const r = reads();
    await loadBoard(r, WORKSPACE);
    expect((r.calls.activity as Date[]).map((d) => d.toISOString())).toEqual(['2026-09-19T22:00:00.000Z', '2026-09-26T22:00:00.000Z']);
    expect(r.calls.answered).toEqual(r.calls.activity);
  });

  it('the workspace: a non-member\'s merge counts in the tiles and repositories, with no row', async () => {
    const board = await loadBoard(reads(), WORKSPACE);
    expect(board.tiles).toEqual({ prs: 9, prds: tallyOf({ idea: 1, inbox: 1, building: 1, shipped: 2, retro: 1 }), repositories: 3, answered: 11 });
    expect(board.repositories).toEqual([
      { repo: 'vertuo-ai-domain', prs: 7, prdEvents: 0 },
      { repo: 'vertuo-core', prs: 2, prdEvents: 0 },
      { repo: 'vertuo-omni-loop', prs: 0, prdEvents: 1 },
    ]);
    expect((board.people as unknown[]).length).toBe(3);
  });

  it('a fleet: its members\' activity and questions, and its members\' rows', async () => {
    const board = await loadBoard(reads(), { ...WORKSPACE, scope: { kind: 'fleet', fleet: 'octo' }, people: { kind: 'fleet', fleet: 'octo' } });
    expect(board.tiles).toEqual({ prs: 7, prds: tallyOf({ idea: 1, inbox: 1, building: 1, shipped: 1 }), repositories: 2, answered: 9 });
    expect((board.people as { userId: string }[]).map((p) => p.userId)).toEqual(['u-paul', 'u-ada']);
  });

  it('you: your activity and questions, and the People table of the scope asked for', async () => {
    const board = await loadBoard(reads(), {
      ...WORKSPACE, viewerId: 'u-paul', scope: { kind: 'you', userId: 'u-paul', login: 'PaEtienne' }, people: { kind: 'fleet', fleet: 'octo' },
    });
    expect(board.tiles).toMatchObject({ prs: 7, answered: 9, repositories: 1, prds: tallyOf({ inbox: 1 }) });
    expect((board.merges as { count: number }[]).map((d) => d.count)).toEqual([0, 0, 0, 0, 0, 7, 0]);
    expect((board.people as { userId: string; you: boolean }[]).filter((p) => p.you).map((p) => p.userId)).toEqual(['u-paul']);
  });

  it('PRDs now: a shipped PRD counts as shipped, never open, whenever its events fell', async () => {
    const board = await loadBoard(reads(), { ...WORKSPACE, scope: { kind: 'you', userId: 'u-ada', login: 'ada-gh' } });
    expect(board.tiles.prds).toEqual(tallyOf({ idea: 1, building: 1, shipped: 1 }));
    const ada = (board.people as { userId: string; prds: unknown }[]).find((p) => p.userId === 'u-ada');
    expect(ada?.prds).toEqual({ open: 1, building: 1, shipped: 1 });
  });

  it('links each stage\'s count to /prd at that stage: Mine for you, All for a fleet and the workspace', async () => {
    const you = await loadBoard(reads(), { ...WORKSPACE, scope: { kind: 'you', userId: 'u-ada', login: 'ada-gh' } });
    expect(you.stageLinks.inbox).toBe('/prd?stage=inbox');
    expect((await loadBoard(reads(), WORKSPACE)).stageLinks.shipped).toBe('/prd?stage=shipped&who=all');
    const fleet = await loadBoard(reads(), { ...WORKSPACE, scope: { kind: 'fleet', fleet: 'octo' } });
    expect(Object.keys(fleet.stageLinks)).toEqual(['idea', 'prd', 'inbox', 'building', 'outbox', 'shipped', 'retro']);
    expect(fleet.stageLinks.retro).toBe('/prd?stage=retro&who=all');
  });

  it('the season\'s fleet ranking, the viewer\'s fleet marked, each with its colour and mascot (PRD 652)', async () => {
    const galaxy = { ...GALAXY, teams: GALAXY.teams.map((t) => ({ ...t, mascot: t.name === 'beaver' ? 'beaver' : null })) };
    const board = await loadBoard({ ...reads(), galaxy: () => Promise.resolve(galaxy) }, WORKSPACE);
    expect(board.fleets).toEqual([
      { rank: 1, name: 'beaver', label: 'BEAVER', points: 300, yours: false, color: '#8a5a2b', mascot: 'beaver' },
      { rank: 2, name: 'octo', label: 'OCTO', points: 120, yours: true, color: '#3355ff', mascot: null },
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

  it('the contributions: two tiles, both charts, the repositories and People\'s PRs; PRDs now still count', async () => {
    const board = await loadBoard(reads({ activity: true }), WORKSPACE);
    expect(board.tiles).toMatchObject({ prs: 'unreadable', repositories: 'unreadable', answered: 11 });
    expect(board.tiles.prds).toEqual(tallyOf({ idea: 1, inbox: 1, building: 1, shipped: 2, retro: 1 }));
    expect([board.merges, board.prdEvents, board.repositories]).toEqual(['unreadable', 'unreadable', 'unreadable']);
    expect(sure((board.people as { prs: unknown; prds: unknown }[])[0], 'item 0').prs).toBe('unreadable');
    expect(sure((board.people as { prs: unknown; prds: unknown }[])[0], 'item 0').prds).not.toBe('unreadable');
  });

  it('the PRDs now: only the PRDs tile and People\'s PRDs', async () => {
    const board = await loadBoard(reads({ prds: true }), WORKSPACE);
    expect(board.tiles).toEqual({ prs: 9, prds: 'unreadable', repositories: 3, answered: 11 });
    expect(board.prdEvents).not.toBe('unreadable');
    expect((board.people as { prs: unknown; prds: unknown }[]).every((p) => p.prds === 'unreadable' && p.prs !== 'unreadable')).toBe(true);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('prds is down'));
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
  const galaxy = () => Promise.reject(new Error('unused'));

  it('reads the roster through workspace_roster, logins in lower case', async () => {
    const rpc = vi.fn(() => Promise.resolve({ data: [
      { user_id: 'u', name: null, github_login: 'PaEtienne', avatar_url: null, fleet: null, hero: null },
      { user_id: 'v', name: 'ADA', github_login: 'ada', avatar_url: null, fleet: 'octo', hero: { v: 1 } },
    ], error: null }));
    const r = supabaseReads({ rpc } as never, 'w-1', galaxy);
    expect(await r.roster()).toEqual([
      { userId: 'u', name: null, login: 'paetienne', avatarUrl: null, fleet: null, hero: null },
      { userId: 'v', name: 'ADA', login: 'ada', avatarUrl: null, fleet: 'octo', hero: { v: 1 } },
    ]);
    expect(rpc).toHaveBeenCalledWith('workspace_roster', { workspace: 'w-1' });
  });

  it('reads the answered counts through answered_counts, for the window', async () => {
    const rpc = vi.fn(() => Promise.resolve({ data: [{ user_id: 'u', answered: '3' }], error: null }));
    const r = supabaseReads({ rpc } as never, 'w-1', galaxy);
    expect(await r.answered(new Date('2026-09-19T22:00:00Z'), new Date('2026-09-26T22:00:00Z'))).toEqual([{ user_id: 'u', answered: 3 }]);
    expect(rpc).toHaveBeenCalledWith('answered_counts', { workspace: 'w-1', from_at: '2026-09-19T22:00:00.000Z', to_at: '2026-09-26T22:00:00.000Z' });
  });

  it('throws when a function fails', async () => {
    const rpc = vi.fn(() => Promise.resolve({ data: null, error: { message: 'boom' } }));
    const r = supabaseReads({ rpc } as never, 'w-1', galaxy);
    await expect(r.roster()).rejects.toThrow(/members.*boom/);
    await expect(r.answered(new Date(), new Date())).rejects.toThrow(/answered.*boom/);
  });

  it('reads the workspace\'s contributions in [from, to), page by page', async () => {
    const pages = [Array.from({ length: 1000 }, (_, i) => ({ kind: 'pr-merged', repo: 'r', number: i, login: 'a', at: 'x' })), [{ kind: 'pr-merged', repo: 'r', number: 1000, login: 'a', at: 'x' }]];
    const filters: unknown[][] = [];
    const query = (): Record<string, unknown> => {
      const q: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'gte', 'lt', 'order']) q[m] = (...args: unknown[]) => { filters.push([m, ...args]); return q; };
      q.range = () => Promise.resolve({ data: pages.shift(), error: null });
      return q;
    };
    const r = supabaseReads({ from: () => query() } as never, 'w-1', galaxy);
    const rows = await r.activity(new Date('2026-09-19T22:00:00Z'), new Date('2026-09-26T22:00:00Z'));
    expect(rows).toHaveLength(1001);
    expect(filters).toContainEqual(['eq', 'workspace_id', 'w-1']);
    expect(filters).toContainEqual(['gte', 'at', '2026-09-19T22:00:00.000Z']);
    expect(filters).toContainEqual(['lt', 'at', '2026-09-26T22:00:00.000Z']);
  });

  it('reads PRDs now through the stage store, with who opened each from prd-opened rows and the dossiers', async () => {
    const store = fakeStageStore(() => '2026-09-29T10:00:00Z');
    await store.recordStages([
      { workspace_id: 'w-1', repository: 'Vertuoza/Vertuo-Omni-Loop', prd: 12, stage: 'inbox', reached_at: '2026-09-01T00:00:00Z' },
      { workspace_id: 'w-1', repository: 'vertuoza/vertuo-omni-loop', prd: 12, stage: 'shipped', reached_at: '2026-09-20T00:00:00Z' },
      { workspace_id: 'w-1', repository: 'vertuoza/vertuo-core', prd: 3, stage: 'prd', reached_at: '2026-09-02T00:00:00Z' },
      { workspace_id: 'w-2', repository: 'other/repo', prd: 1, stage: 'retro', reached_at: '2026-09-02T00:00:00Z' },
    ]);
    const filters: unknown[][] = [];
    const query = (): Record<string, unknown> => {
      const q: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'order']) q[m] = (...args: unknown[]) => { filters.push([m, ...args]); return q; };
      q.range = () => Promise.resolve({ data: [{ repo: 'vertuo-omni-loop', number: 12, login: 'Ada-GH' }], error: null });
      return q;
    };
    // dossier_list(p_workspace) lists that workspace's dossiers alone: the database scopes, not the board.
    // Each row with every column dossier_list() answers, as the read parses it.
    const listed = (row: { id: string; workspace_id: string; home_repo: string; prd: number | null; opened_by: string; answered: number }) => ({
      kind: 'prd', title: row.id, created_at: '2026-09-01T00:00:00Z', numbered_at: null, repos: [row.home_repo], latest: {}, asked: row.answered,
      last_activity: '2026-09-01T00:00:00Z', ...row,
    });
    const dossiers = [
      listed({ id: 'd1', workspace_id: 'w-1', home_repo: 'vertuoza/vertuo-core', prd: 3, opened_by: 'u-bob', answered: 0 }),
      listed({ id: 'd2', workspace_id: 'w-1', home_repo: 'vertuoza/vertuo-core', prd: null, opened_by: 'u-ada', answered: 2 }),
      listed({ id: 'd3', workspace_id: 'w-2', home_repo: 'other/repo', prd: null, opened_by: 'u-x', answered: 5 }),
    ];
    const rpc = vi.fn((_fn: string, args: { p_workspace?: string }) => Promise.resolve({
      data: dossiers.filter((d) => d.workspace_id === args.p_workspace),
      error: null,
    }));
    const r = supabaseReads({ from: () => query(), rpc } as never, 'w-1', galaxy, store);
    const prds = await r.prds();
    expect(prds).toHaveLength(3);
    expect(prds).toEqual(expect.arrayContaining([
      { stage: 'prd', login: null, userId: 'u-bob' },
      { stage: 'shipped', login: 'ada-gh', userId: null },
      { stage: 'idea', login: null, userId: 'u-ada' },
    ]));
    expect(filters).toContainEqual(['eq', 'workspace_id', 'w-1']);
    expect(filters).toContainEqual(['eq', 'kind', 'prd-opened']);
    expect(rpc).toHaveBeenCalledWith('dossier_list', { p_workspace: 'w-1' });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('PRDs now reject when the stage store refuses', async () => {
    const store = fakeStageStore();
    store.fail = 'boom';
    const query = (): Record<string, unknown> => {
      const q: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'order']) q[m] = () => q;
      q.range = () => Promise.resolve({ data: [], error: null });
      return q;
    };
    const r = supabaseReads({ from: () => query(), rpc: () => Promise.resolve({ data: [], error: null }) } as never, 'w-1', galaxy, store);
    await expect(r.prds()).rejects.toThrow(/boom/);
  });
});
