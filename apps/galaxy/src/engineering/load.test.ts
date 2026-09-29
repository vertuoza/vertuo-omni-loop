import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const given = vi.hoisted(() => ({
  workspace: (async () => ({ id: 'ws-1', slug: 'vertuoza', name: 'Vertuoza', theme: {} })) as () => Promise<unknown>,
}));
vi.mock('../data/workspace', () => ({ memberWorkspace: () => given.workspace() }));

import type { SupabaseClient } from '@supabase/supabase-js';
import { UNREADABLE } from '../dashboard/part';
import { loadEngineering, loadEngineeringBoard, loadEngineeringRepository, loadEngineeringRepositoryBoard, supabaseEngineeringReads, type EngineeringReads } from './load';

// /app/engineering's read (PRD 612 s3), on fakes: no test calls Supabase.

const NOW = new Date('2026-09-26T10:00:00Z');
const REQUEST = { period: '7d', sort: 'merged', now: NOW } as const;

const HERO = { v: 1, body: 'girl', skin: 1, hair: 0, suit: 0, cape: 1 };

const PR = {
  repo: 'acme/widgets', number: 7, author: 'ada', authorIsBot: false, openedAt: '2026-09-24T08:00:00Z', mergedAt: '2026-09-24T10:00:00Z',
  closedAt: '2026-09-24T10:00:00Z', mergedBy: 'bob', commits: 2, additions: 3, deletions: 1, omniSigned: false,
};

function reads(over: Partial<EngineeringReads> = {}): EngineeringReads & { asked: unknown[] } {
  const asked: unknown[] = [];
  return {
    asked,
    tracked: async () => { asked.push('tracked'); return ['acme/widgets']; },
    pullRequests: async (from, repos) => { asked.push(['prs', from.toISOString(), repos]); return [PR]; },
    reviews: async (from, to, repos) => { asked.push(['reviews', from.toISOString(), to.toISOString(), repos]); return []; },
    faces: async (logins) => { asked.push(['faces', logins]); return [{ login: 'Ada', hero: HERO, color: '#e0457b' }]; },
    ...over,
  };
}

beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { vi.restoreAllMocks(); });

describe('loadEngineering', () => {
  it('reads the tracked repositories, then their pull requests and reviews for the period', async () => {
    const r = reads();
    const board = await loadEngineering(r, REQUEST);
    expect(board !== UNREADABLE && board.kind === 'board' && board.tiles.merged).toBe(1);
    expect(r.asked).toEqual([
      'tracked',
      ['prs', '2026-09-19T22:00:00.000Z', ['acme/widgets']],
      ['reviews', '2026-09-19T22:00:00.000Z', '2026-09-26T22:00:00.000Z', ['acme/widgets']],
      ['faces', ['ada', 'bob']],
    ]);
  });

  it('gives each person shown their face: a player\'s hero, anyone else\'s GitHub picture', async () => {
    const board = await loadEngineering(reads(), REQUEST);
    if (board === UNREADABLE || board.kind !== 'board') throw new Error('no board');
    expect(board.people.opened[0]).toEqual({ login: 'ada', count: 1, face: { kind: 'hero', hero: HERO, color: '#e0457b' } });
    expect(board.people.merged[0]).toEqual({ login: 'bob', count: 1, face: { kind: 'github', src: 'https://github.com/bob.png?size=56' } });
  });

  it('when the faces cannot be read: the board still, every face the GitHub picture, the error logged', async () => {
    const board = await loadEngineering(reads({ faces: async () => { throw new Error('players down'); } }), REQUEST);
    if (board === UNREADABLE || board.kind !== 'board') throw new Error('no board');
    expect(board.tiles.merged).toBe(1);
    expect(board.people.opened[0].face).toEqual({ kind: 'github', src: 'https://github.com/ada.png?size=56' });
    expect(board.people.merged[0].face).toEqual({ kind: 'github', src: 'https://github.com/bob.png?size=56' });
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('players down'));
  });

  it('with nobody to show: no faces read', async () => {
    const r = reads({ pullRequests: async () => [] });
    await loadEngineering(r, REQUEST);
    expect(r.asked.some((a) => Array.isArray(a) && a[0] === 'faces')).toBe(false);
  });

  it('with no tracked repository: the empty state, and nothing else read', async () => {
    const r = reads({ tracked: async () => [] });
    expect(await loadEngineering(r, REQUEST)).toMatchObject({ kind: 'empty' });
    expect(r.asked).toEqual([]);
  });

  it.each(['tracked', 'pullRequests', 'reviews'] as const)('when %s cannot be read: could not load, its error logged', async (which) => {
    const board = await loadEngineering(reads({ [which]: async () => { throw new Error('boom'); } }), REQUEST);
    expect(board).toBe(UNREADABLE);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('boom'));
  });
});

describe('loadEngineeringRepository (PRD 645 s2)', () => {
  const two = (over: Partial<EngineeringReads> = {}) => reads({ tracked: async () => ['acme/widgets', 'Acme/Gears'], ...over });

  it('reads the pull requests and reviews of that repository alone, found whatever its case, under its tracked spelling', async () => {
    const r = two({ pullRequests: async (from, repos) => { r.asked.push(['prs', from.toISOString(), repos]); return [{ ...PR, repo: 'Acme/Gears' }]; } });
    const got = await loadEngineeringRepository(r, 'acme/GEARS', REQUEST);
    expect(got.kind).toBe('repository');
    if (got.kind !== 'repository') return;
    expect(got.repo).toBe('Acme/Gears');
    expect(got.board !== UNREADABLE && got.board.kind === 'board' && got.board.tiles.merged).toBe(1);
    expect(r.asked.slice(0, 2)).toEqual([
      ['prs', '2026-09-19T22:00:00.000Z', ['Acme/Gears']],
      ['reviews', '2026-09-19T22:00:00.000Z', '2026-09-26T22:00:00.000Z', ['Acme/Gears']],
    ]);
  });

  it('for a repository the workspace does not track: not tracked, and nothing else read', async () => {
    const r = two();
    expect(await loadEngineeringRepository(r, 'acme/sprockets', REQUEST)).toEqual({ kind: 'not-tracked' });
    expect(r.asked).toEqual([]);
  });

  it('when the tracked repositories cannot be read: could not load, under the asked name', async () => {
    const got = await loadEngineeringRepository(two({ tracked: async () => { throw new Error('boom'); } }), 'acme/gears', REQUEST);
    expect(got).toEqual({ kind: 'repository', repo: 'acme/gears', board: UNREADABLE });
  });
});

describe('loadEngineeringBoard', () => {
  const db = () => ({ from: () => { throw new Error('no read expected'); } }) as unknown as SupabaseClient;

  it('for an account in no workspace: no-workspace', async () => {
    given.workspace = async () => null;
    expect(await loadEngineeringBoard(db(), { id: 'u-1' }, REQUEST)).toEqual({ kind: 'no-workspace' });
  });

  it('when the workspace cannot be read: the board says it could not load', async () => {
    given.workspace = async () => { throw new Error('down'); };
    expect(await loadEngineeringBoard(db(), { id: 'u-1' }, REQUEST)).toEqual({ kind: 'board', name: 'Engineering', board: UNREADABLE });
  });
});

describe('loadEngineeringRepositoryBoard (PRD 645 s2)', () => {
  it('for an account in no workspace: no-workspace', async () => {
    given.workspace = async () => null;
    const db = { from: () => { throw new Error('no read expected'); } } as unknown as SupabaseClient;
    expect(await loadEngineeringRepositoryBoard(db, { id: 'u-1' }, 'acme/gears', REQUEST)).toEqual({ kind: 'no-workspace' });
  });

  it('narrows the reads to that repository on Supabase, and heads the board with its tracked spelling', async () => {
    given.workspace = async () => ({ id: 'ws-1', slug: 'vertuoza', name: 'Vertuoza', theme: {} });
    const calls: unknown[][] = [];
    const answers: Record<string, unknown[][]> = {
      repositories: [[{ full_name: 'acme/widgets' }, { full_name: 'Acme/Gears' }]], pull_requests: [[]], pull_request_reviews: [[]], players: [[]],
    };
    const db = {
      from(table: string) {
        const call: unknown[] = [table];
        calls.push(call);
        const q: Record<string, unknown> = {};
        for (const m of ['select', 'eq', 'in', 'or', 'gte', 'lt', 'order', 'range']) q[m] = (...a: unknown[]) => { call.push([m, ...a]); return q; };
        q.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: answers[table].shift(), error: null }).then(ok);
        return q;
      },
    } as unknown as SupabaseClient;
    const got = await loadEngineeringRepositoryBoard(db, { id: 'u-1' }, 'acme/gears', REQUEST);
    expect(got).toMatchObject({ kind: 'board', name: 'Vertuoza', repo: 'Acme/Gears' });
    const of = (table: string) => calls.find((c) => c[0] === table)!;
    expect(of('pull_requests')).toContainEqual(['in', 'repo', ['Acme/Gears']]);
    expect(of('pull_request_reviews')).toContainEqual(['in', 'repo', ['Acme/Gears']]);
  });

  it('for a repository the workspace does not track: not tracked', async () => {
    given.workspace = async () => ({ id: 'ws-1', slug: 'vertuoza', name: 'Vertuoza', theme: {} });
    const db = { from: () => ({ select: () => ({ eq: () => ({ eq: async () => ({ data: [{ full_name: 'acme/widgets' }], error: null }) }) }) }) } as unknown as SupabaseClient;
    expect(await loadEngineeringRepositoryBoard(db, { id: 'u-1' }, 'acme/gears', REQUEST)).toEqual({ kind: 'not-tracked' });
  });
});

describe('supabaseEngineeringReads', () => {
  type Answer = { data: unknown[] | null; error: { message: string } | null };
  function fakeDb(answers: Record<string, Answer[]>) {
    const calls: unknown[][] = [];
    const db = {
      from(table: string) {
        const call: unknown[] = [table];
        calls.push(call);
        const q: Record<string, unknown> = {};
        for (const m of ['select', 'eq', 'in', 'or', 'gte', 'lt', 'order', 'range', 'limit']) q[m] = (...a: unknown[]) => { call.push([m, ...a]); return q; };
        q.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(answers[table].shift()).then(ok, ko);
        return q;
      },
    };
    return { calls, db: db as unknown as SupabaseClient };
  }

  it('reads only the workspace\'s tracked repositories', async () => {
    const { calls, db } = fakeDb({ repositories: [{ data: [{ full_name: 'acme/widgets' }], error: null }] });
    expect(await supabaseEngineeringReads(db, 'ws-1').tracked()).toEqual(['acme/widgets']);
    expect(calls[0]).toEqual(['repositories', ['select', 'full_name'], ['eq', 'workspace_id', 'ws-1'], ['eq', 'tracked', true]]);
  });

  it('reads the pull requests that can count, a thousand at a time, and names them as the board does', async () => {
    const row = {
      repo: 'acme/widgets', number: 7, author: 'ada', author_is_bot: false, opened_at: PR.openedAt, merged_at: PR.mergedAt,
      closed_at: PR.closedAt, merged_by: 'bob', commits: 2, additions: 3, deletions: 1, omni_signed: false,
    };
    const { calls, db } = fakeDb({ pull_requests: [{ data: Array(1000).fill(row), error: null }, { data: [row], error: null }] });
    const rows = await supabaseEngineeringReads(db, 'ws-1').pullRequests(new Date('2026-09-19T22:00:00Z'), ['acme/widgets']);
    expect(rows).toHaveLength(1001);
    expect(rows[0]).toEqual(PR);
    expect(calls[0]).toContainEqual(['in', 'repo', ['acme/widgets']]);
    expect(calls[0]).toContainEqual(['or', 'opened_at.gte."2026-09-19T22:00:00.000Z",merged_at.gte."2026-09-19T22:00:00.000Z",and(merged_at.is.null,closed_at.is.null)']);
    expect(calls[0]).toContainEqual(['range', 0, 999]);
    expect(calls[1]).toContainEqual(['range', 1000, 1999]);
  });

  it('reads the reviews first given in the window', async () => {
    const { calls, db } = fakeDb({ pull_request_reviews: [{ data: [{ repo: 'acme/widgets', number: 7, reviewer: 'carl', first_at: '2026-09-25T08:00:00Z' }], error: null }] });
    const rows = await supabaseEngineeringReads(db, 'ws-1').reviews(new Date('2026-09-19T22:00:00Z'), new Date('2026-09-26T22:00:00Z'), ['acme/widgets']);
    expect(rows).toEqual([{ repo: 'acme/widgets', number: 7, reviewer: 'carl', firstAt: '2026-09-25T08:00:00Z' }]);
    expect(calls[0]).toContainEqual(['gte', 'first_at', '2026-09-19T22:00:00.000Z']);
    expect(calls[0]).toContainEqual(['lt', 'first_at', '2026-09-26T22:00:00.000Z']);
  });

  it('reads the faces in one query: the workspace\'s players with one of the logins, lower-cased too, with their fleet\'s colour', async () => {
    const { calls, db } = fakeDb({ players: [{ data: [
      { github_login: 'Ada', hero: HERO, teams: { color: '#e0457b' } },
      { github_login: 'carl', hero: HERO, teams: null },
    ], error: null }] });
    const rows = await supabaseEngineeringReads(db, 'ws-1').faces(['Ada', 'bob']);
    expect(rows).toEqual([{ login: 'Ada', hero: HERO, color: '#e0457b' }, { login: 'carl', hero: HERO, color: null }]);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContainEqual(['select', 'github_login, hero, teams(color)']);
    expect(calls[0]).toContainEqual(['eq', 'workspace_id', 'ws-1']);
    expect(calls[0]).toContainEqual(['in', 'github_login', ['Ada', 'bob', 'ada']]);
  });

  it('rejects with what could not be read', async () => {
    const { db } = fakeDb({ repositories: [{ data: null, error: { message: 'denied' } }] });
    await expect(supabaseEngineeringReads(db, 'ws-1').tracked()).rejects.toThrow('could not read the tracked repositories (denied)');
  });
});
