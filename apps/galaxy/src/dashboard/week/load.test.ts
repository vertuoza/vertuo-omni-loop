import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ACME, contribution, fakeGalaxyDb, PEOPLE, twoWorkspaces, VERTUOZA, type FakeUser } from '../../data/galaxy.fake';
import { settle, type PartInput } from '../part';
import { seasonBounds } from '../season';
import { loadWeek } from './load';

// The week's read (PRD 328), on the in-memory fake database (src/data/galaxy.fake.ts), as one
// signed-in person under row-level security: your pull requests merged into main over the last seven
// Brussels days, from `contributions`, in the workspace shown only.
//
// The fake's rows, around Saturday 26 September 2026: ADA merged #101 on Tuesday 22, #102 and #103
// on Thursday 24, and #95 on the last evening of August; she opened two PRDs. BOTH merged #104 in
// Vertuoza on Friday 25, and #55 in Acme that same day. WILE merged #56 in Acme on Wednesday 23.

const NOW = new Date('2026-09-26T10:00:00Z');
const WEEK = ['2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26'];

function world(arrange: (w: ReturnType<typeof fakeGalaxyDb>) => void = () => {}) {
  const w = fakeGalaxyDb(twoWorkspaces(), Object.values(PEOPLE));
  arrange(w);
  return w;
}

const galaxyUntouched = vi.fn(async () => { throw new Error('the week read the galaxy'); });

function inputOf(w: ReturnType<typeof fakeGalaxyDb>, person: FakeUser, workspace: string, login: string | null): PartInput {
  return {
    db: w.client(person) as unknown as SupabaseClient, workspace, userId: person.id, login, team: null,
    now: NOW, season: seasonBounds(NOW), galaxy: galaxyUntouched,
  };
}

const counts = (value: unknown) => (value as { days: Array<{ count: number }> }).days.map((d) => d.count);

beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { vi.restoreAllMocks(); });

describe('the week, read', () => {
  it('counts your merges on each of the seven days, today last', async () => {
    const w = world();
    const week = await loadWeek(inputOf(w, PEOPLE.ada, VERTUOZA, 'ada-gh'));
    expect(week).toEqual({
      kind: 'week',
      days: [
        { date: WEEK[0], count: 0 }, { date: WEEK[1], count: 0 }, { date: WEEK[2], count: 1 }, { date: WEEK[3], count: 0 },
        { date: WEEK[4], count: 2 }, { date: WEEK[5], count: 0 }, { date: WEEK[6], count: 0 },
      ],
    });
  });

  it('reads only the workspace shown, merged pull requests only, yours only, from the week\'s start', async () => {
    const w = world();
    await loadWeek(inputOf(w, PEOPLE.ada, VERTUOZA, 'ada-gh'));
    const reads = w.calls.filter((c) => c.kind === 'from');
    expect(reads).toHaveLength(1);
    const [read] = reads as [Extract<(typeof w.calls)[number], { kind: 'from' }>];
    expect(read).toMatchObject({ table: 'contributions', op: 'select', eq: { workspace_id: VERTUOZA, kind: 'pr-merged' } });
    expect(read.filters).toContainEqual({ column: 'login', op: 'ilike', value: 'ada-gh' });
    const since = read.filters?.find((f) => f.column === 'at' && f.op === 'gte')?.value as string;
    // No later than the first day's midnight in Brussels, and no more than a day before it.
    expect(Date.parse(since)).toBeLessThanOrEqual(Date.parse('2026-09-19T22:00:00Z'));
    expect(Date.parse(since)).toBeGreaterThanOrEqual(Date.parse('2026-09-18T22:00:00Z'));
    expect(galaxyUntouched).not.toHaveBeenCalled();
  });

  it('never counts another workspace\'s rows: BOTH, in Acme, counts Acme\'s merge and not Vertuoza\'s', async () => {
    const w = world();
    // BOTH is a member of both workspaces, and may read both workspaces' rows: the read filters.
    const week = await loadWeek(inputOf(w, PEOPLE.both, ACME, 'both-gh'));
    expect(counts(week)).toEqual([0, 0, 0, 0, 0, 1, 0]);
    const inVertuoza = await loadWeek(inputOf(w, PEOPLE.both, VERTUOZA, 'both-gh'));
    expect(counts(inVertuoza)).toEqual([0, 0, 0, 0, 0, 1, 0]);
  });

  it('never counts other people\'s rows: WILE\'s merge in Acme is WILE\'s alone', async () => {
    const w = world();
    expect(counts(await loadWeek(inputOf(w, PEOPLE.both, ACME, 'both-gh')))[3]).toBe(0);
    expect(counts(await loadWeek(inputOf(w, PEOPLE.wile, ACME, 'wile-gh')))).toEqual([0, 0, 0, 1, 0, 0, 0]);
  });

  it('never counts a PRD opened, nor a merge before the week', async () => {
    const w = world((w) => {
      w.tables.contributions.push(contribution(VERTUOZA, 'prd-opened', 'vertuo-core', 8, 'ada-gh', '2026-09-25T08:00:00Z'));
    });
    const week = await loadWeek(inputOf(w, PEOPLE.ada, VERTUOZA, 'ada-gh'));
    expect(counts(week)).toEqual([0, 0, 1, 0, 2, 0, 0]);
  });

  it('matches your login ignoring case: a row stored as Ada-GH is yours', async () => {
    const w = world((w) => {
      w.tables.contributions.push({ ...contribution(VERTUOZA, 'pr-merged', 'vertuo-core', 105, 'x', '2026-09-26T08:00:00Z'), login: 'Ada-GH' });
    });
    expect(counts(await loadWeek(inputOf(w, PEOPLE.ada, VERTUOZA, 'ada-gh')))).toEqual([0, 0, 1, 0, 2, 0, 1]);
  });

  it('counts a merge late on Sunday evening in summer on Monday, as Brussels reads it', async () => {
    const w = world((w) => {
      w.tables.contributions.push(contribution(VERTUOZA, 'pr-merged', 'vertuo-core', 106, 'ada-gh', '2026-09-20T22:30:00Z'));
    });
    expect(counts(await loadWeek(inputOf(w, PEOPLE.ada, VERTUOZA, 'ada-gh')))).toEqual([0, 1, 1, 0, 2, 0, 0]);
  });

  it('an empty week is seven zeros, not nothing', async () => {
    const w = world();
    const week = await loadWeek(inputOf(w, PEOPLE.bea, VERTUOZA, 'bea-gh'));
    // BEA is in no workspace yet: row-level security hands her nothing, and the week is empty.
    expect(week).toEqual({ kind: 'week', days: WEEK.map((date) => ({ date, count: 0 })) });
  });
});

describe('the week, when it cannot count', () => {
  it('with no GitHub login: it says to link one, and reads nothing', async () => {
    const w = world();
    expect(await loadWeek(inputOf(w, PEOPLE.ada, VERTUOZA, null))).toEqual({ kind: 'no-github' });
    expect(w.calls).toEqual([]);
  });

  it('when contributions cannot be read: it fails, and the dashboard reads it as unreadable, the error logged', async () => {
    const w = world((w) => { w.state.failOn = 'contributions'; });
    const input = inputOf(w, PEOPLE.ada, VERTUOZA, 'ada-gh');
    await expect(loadWeek(input)).rejects.toThrow(/contributions/);
    expect(await settle('the week of merges', () => loadWeek(input))).toBe('unreadable');
    expect(vi.mocked(console.error).mock.calls.map((c) => String(c[0])).some((e) => /the week of merges.*contributions/.test(e))).toBe(true);
  });

  it('when the database is out of reach: the same', async () => {
    const w = world((w) => { w.state.fail = { message: 'timeout' }; });
    await expect(loadWeek(inputOf(w, PEOPLE.ada, VERTUOZA, 'ada-gh'))).rejects.toThrow(/timeout/);
  });
});
