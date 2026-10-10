import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { present } from '../ask/test/test-item';
import { loadScores, readScores, submitScore } from './scores';
import { ACME, fakeGalaxyDb, PEOPLE, score, twoWorkspaces, VERTUOZA, type FakeUser } from './galaxy.fake';

/** The world of two workspaces, and a client acting as `person`. */
function world(person: FakeUser | null, arrange: (w: ReturnType<typeof fakeGalaxyDb>) => void = () => {}) {
  const w = fakeGalaxyDb(twoWorkspaces(), Object.values(PEOPLE));
  arrange(w);
  return { w, db: w.client(person) as unknown as SupabaseClient };
}

const HERO = { v: 1, body: 'girl', skin: 1, hair: 0, suit: 0, cape: 1 };
const extra = (w: ReturnType<typeof fakeGalaxyDb>, n: number) => {
  for (let i = 0; i < n; i++) {
    const user_id = `00000000-0000-4000-8000-00000000f0${String(i).padStart(2, '0')}`;
    w.tables.workspace_members.push({ workspace_id: VERTUOZA, user_id, role: 'member', joined_at: '2026-09-26T08:00:00Z' });
    w.tables.players.push({ workspace_id: VERTUOZA, user_id, display_name: `P${i}`, team: 'beaver', team_since: null, hero: HERO, github_id: 100 + i, github_login: `p${i}-gh` });
    w.tables.arcade_scores.push(score(VERTUOZA, user_id, 500 + i * 100, '2026-09-26T09:00:00Z'));
  }
};

afterEach(() => { vi.restoreAllMocks(); });

describe('a game\'s crew table', () => {
  it('is the workspace\'s top five at the game, best first, with each player\'s arcade name, hero and fleet', async () => {
    const { db } = world(PEOPLE.ada, (w) => { extra(w, 6); });
    const board = await loadScores(db, VERTUOZA, 'invaders', PEOPLE.ada.id);
    expect(board.top.map((l) => [l.name, l.best])).toEqual([['ADA', 1240], ['P5', 1000], ['P4', 900], ['P3', 800], ['P2', 700]]);
    expect(board.top[0]).toEqual({ id: PEOPLE.ada.id, name: 'ADA', hero: HERO, team: 'pirates', best: 1240 });
    expect(board.mine).toBe(1240);
  });

  it('puts a time game\'s lowest first, the earlier of two equal times first, and a score game\'s highest first', async () => {
    const { db } = world(PEOPLE.ada, (w) => {
      for (const [who, best, at] of [['ada', 1200, '2026-09-26T09:00:00Z'], ['both', 1023, '2026-09-26T09:05:00Z'], ['bea', 1023, '2026-09-26T09:01:00Z']] as const) {
        w.tables.arcade_scores.push(score(VERTUOZA, PEOPLE[who].id, best, at, 'kart'));
      }
      for (let i = 0; i < 4; i++) w.tables.arcade_scores.push(score(VERTUOZA, `00000000-0000-4000-8000-00000000e0${i}`, 2000 + i, '2026-09-26T09:10:00Z', 'kart'));
    });
    const board = await loadScores(db, VERTUOZA, 'kart', PEOPLE.ada.id);
    expect(board.top.map((l) => l.best)).toEqual([1023, 1023, 1200, 2000, 2001]);
    expect(board.top.slice(0, 2).map((l) => l.id)).toEqual([PEOPLE.bea.id, PEOPLE.both.id]);
    expect(board.mine).toBe(1200);
    expect((await loadScores(db, VERTUOZA, 'invaders', null)).top[0]?.best).toBe(1240);
  });

  it('puts the earlier of two equal scores first', async () => {
    const { db } = world(PEOPLE.ada, (w) => {
      present(w.tables.arcade_scores.find((s) => s.user_id === PEOPLE.both.id && s.workspace_id === VERTUOZA), 'both\'s score').best = 1240;
      present(w.tables.arcade_scores.find((s) => s.user_id === PEOPLE.ada.id), 'ada\'s score').at = '2026-09-26T09:00:00Z';
    });
    expect((await loadScores(db, VERTUOZA, 'invaders', PEOPLE.ada.id)).top.map((l) => l.name)).toEqual(['BOTH', 'ADA']);
  });

  it('holds only the workspace\'s scores at that game, read with a filter on each', async () => {
    const { db, w } = world(PEOPLE.both, (x) => { x.tables.arcade_scores.push(score(ACME, PEOPLE.both.id, 60, '2026-09-26T09:00:00Z', 'maze')); });
    const board = await loadScores(db, ACME, 'invaders', PEOPLE.both.id);
    expect(board).toEqual({ top: [expect.objectContaining({ name: 'WILE', best: 9210 })], mine: null });
    for (const call of w.calls) expect(call).toMatchObject({ kind: 'from', table: 'arcade_scores', eq: { workspace_id: ACME, game: 'invaders' } });
  });

  it('gives the player\'s own best even when it is out of the top five, and none before their first game', async () => {
    const { db } = world(PEOPLE.both, (w) => { extra(w, 6); });
    const board = await loadScores(db, VERTUOZA, 'invaders', PEOPLE.both.id);
    expect(board.top.some((l) => l.id === PEOPLE.both.id)).toBe(false);
    expect(board.mine).toBe(385);
    expect((await loadScores(world(PEOPLE.wile).db, ACME, 'maze', PEOPLE.wile.id)).mine).toBeNull();
  });

  it('says so when it cannot be read', async () => {
    const { db } = world(PEOPLE.ada, (w) => { w.state.failOn = 'arcade_scores'; });
    await expect(loadScores(db, VERTUOZA, 'invaders', PEOPLE.ada.id)).rejects.toThrow(/could not read the high scores/);
  });
});

describe('every game\'s crew table, as the page reads it', () => {
  it('reads each game of the registry', async () => {
    const { db } = world(PEOPLE.ada);
    const scores = await readScores(db, VERTUOZA, PEOPLE.ada.id);
    expect(Object.keys(scores)).toEqual(['invaders', 'platformer', 'kart']);
    expect(scores.invaders).toEqual({ top: [expect.objectContaining({ name: 'ADA', best: 1240 }), expect.objectContaining({ name: 'BOTH', best: 385 })], mine: 1240 });
  });

  it('marks a table out of reach as unreadable, and says why in the log', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { db } = world(PEOPLE.ada, (w) => { w.state.failOn = 'arcade_scores'; });
    expect(await readScores(db, VERTUOZA, PEOPLE.ada.id)).toEqual({ invaders: 'unreadable', platformer: 'unreadable', kart: 'unreadable' });
    expect(console.error).toHaveBeenCalled();
  });
});

describe('the fake database keeps the better in the game\'s direction', () => {
  it('keeps the lower time for kart and the higher score for invaders', async () => {
    const { db } = world(PEOPLE.ada, (w) => {
      const xp = present(w.tables.player_xp.find((x) => x.github_login === 'ada-gh' && x.workspace_id === VERTUOZA), 'ada\'s xp');
      xp.unlocked = ['invaders', 'kart'];
    });
    expect(await submitScore(db, VERTUOZA, 'kart', 1200)).toBe(1200);
    expect(await submitScore(db, VERTUOZA, 'kart', 1500)).toBe(1200);
    expect(await submitScore(db, VERTUOZA, 'kart', 900)).toBe(900);
    expect(await submitScore(db, VERTUOZA, 'invaders', 300)).toBe(1240);
    expect(await submitScore(db, VERTUOZA, 'invaders', 2000)).toBe(2000);
  });
});

describe('sending a score', () => {
  it('goes through submit_score() in the workspace played, and resolves with the best as stored', async () => {
    const { db, w } = world(PEOPLE.ada);
    expect(await submitScore(db, VERTUOZA, 'invaders', 300)).toBe(1240);
    expect(await submitScore(db, VERTUOZA, 'invaders', 2000)).toBe(2000);
    expect(w.calls.filter((c) => c.kind === 'rpc')).toEqual([
      { kind: 'rpc', fn: 'submit_score', args: { workspace: VERTUOZA, game: 'invaders', score: 300 } },
      { kind: 'rpc', fn: 'submit_score', args: { workspace: VERTUOZA, game: 'invaders', score: 2000 } },
    ]);
  });

  it('fails, saying why, when the database refuses it', async () => {
    const bea = { ...PEOPLE.bea };
    const { db } = world(bea, (w) => { w.tables.workspace_members.push({ workspace_id: VERTUOZA, user_id: bea.id, role: 'member', joined_at: '2026-09-26T08:00:00Z' }); });
    await expect(submitScore(db, VERTUOZA, 'invaders', 100)).rejects.toThrow(/Saving your score: Only a player/);
    await expect(submitScore(world(PEOPLE.ada).db, VERTUOZA, 'maze', 100)).rejects.toThrow(/not unlocked/);
  });

  it('refuses before any call for a person in no workspace', async () => {
    const { db, w } = world(PEOPLE.eve);
    await expect(submitScore(db, null, 'invaders', 100)).rejects.toThrow(/no workspace/);
    expect(w.calls).toEqual([]);
  });
});
