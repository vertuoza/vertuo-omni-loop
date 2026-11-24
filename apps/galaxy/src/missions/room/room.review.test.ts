import { ProductPrdIdSchema } from 'omni-loop/kit/lib/ids.ts';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { RoomTab } from './RoomTab';
import { ledgerOf, nowLines, type RoomView } from './room';
import { reviewLinesOf, waitingOf, type PlanDecisionRow } from './review';
import { roomRepository, type RoomDb } from './room.repository';
import { roomService } from './room.service';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined }) }));

// The plan and tech rows of the Operation room (PRD omni-loop-26 s5, the `fleet-room` screen): per product PRD the mission's PM
// wrote, the PM's plan approval (its plan version) and the Architect's tech review (what it settled), and the Architect's open
// points under Waiting on you.

const M1 = '11111111-1111-4111-8111-111111111111';
const M2 = '22222222-2222-4222-8222-222222222222';
const A = 'a'.repeat(64);
const B = 'b'.repeat(64);
const P31 = ProductPrdIdSchema.parse('omni-loop-31');
const P32 = ProductPrdIdSchema.parse('omni-loop-32');
const decision = (over: Partial<PlanDecisionRow>): PlanDecisionRow => ({
  mission: M1, prd: P31, kind: 'plan', outcome: 'approved', plan: A, settled: [], why: [], at: '2026-11-24T09:00:00Z', ...over,
});

describe('reviewLinesOf', () => {
  it('shows a plan row signed by the PM with its plan version, and a tech row signed by the Architect with what it settled', () => {
    const [line] = reviewLinesOf([
      decision({}),
      decision({ kind: 'tech', at: '2026-11-24T10:00:00Z', settled: ['tests the store through its fake', 'keeps the migration additive'] }),
    ]);
    expect(line).toMatchObject({ prd: 'omni-loop-31', mission: M1, open: [] });
    expect(line?.plan).toEqual({ by: 'PM · agent', time: '2026-11-24 09:00 UTC', words: 'Approved the plan · version aaaaaaa', state: 'Approved' });
    expect(line?.tech).toEqual({ by: 'Architect · agent', time: '2026-11-24 10:00 UTC', words: 'Approved version aaaaaaa · settled: tests the store through its fake; keeps the migration additive', state: 'Approved' });
  });

  it('says the Architect settled nothing, and that it has not reviewed a plan yet', () => {
    expect(reviewLinesOf([decision({}), decision({ kind: 'tech' })])[0]?.tech.words).toBe('Approved version aaaaaaa · nothing to settle');
    expect(reviewLinesOf([decision({})])[0]?.tech).toEqual({ by: 'Architect · agent', time: null, words: 'Not reviewed yet', state: 'Waiting' });
  });

  it('reads the newest decision of each kind, so a newer plan version shows beside the review of the older one', () => {
    const [line] = reviewLinesOf([decision({}), decision({ kind: 'tech', at: '2026-11-24T10:00:00Z' }), decision({ plan: B, at: '2026-11-24T11:00:00Z' })]);
    expect(line?.plan.words).toBe('Approved the plan · version bbbbbbb');
    expect(line?.tech.words).toBe('Approved version aaaaaaa · nothing to settle');
  });

  it('keeps the Architect\'s open points while its newest review is escalated, and drops them once a newer one approved', () => {
    const escalated = decision({ kind: 'tech', outcome: 'escalated', at: '2026-11-24T10:00:00Z', settled: ['names the store port'], why: ['which queue holds the retries', 'whether the cache is per workspace'] });
    const [open] = reviewLinesOf([decision({}), escalated]);
    expect(open?.tech).toMatchObject({ words: 'Left 2 points to you · settled: names the store port', state: 'Sent to you' });
    expect(open?.open).toEqual(['which queue holds the retries', 'whether the cache is per workspace']);
    expect(reviewLinesOf([decision({}), escalated, decision({ kind: 'tech', at: '2026-11-24T12:00:00Z' })])[0]?.open).toEqual([]);
  });

  it('reads a review that left no record as one point left to a person, never as approved', () => {
    const [line] = reviewLinesOf([decision({}), decision({ kind: 'tech', outcome: 'escalated', plan: null, why: ['no record of the tech review'] })]);
    expect(line?.tech).toMatchObject({ words: 'Left 1 point to you', state: 'Sent to you' });
    expect(line?.open).toEqual(['no record of the tech review']);
  });

  it('says the PM sent its plan approval to a person', () => {
    expect(reviewLinesOf([decision({ outcome: 'escalated', plan: null, why: ['no record of the plan approval'] })])[0]?.plan).toMatchObject({ words: 'Sent the plan to you: no record of the plan approval', state: 'Sent to you' });
  });

  it('gives one line per PRD and mission, in the order each was first decided, and keeps only the mission the filter names', () => {
    const rows = [decision({}), decision({ prd: P32, at: '2026-11-24T09:30:00Z' }), decision({ mission: M2, at: '2026-11-24T08:00:00Z' })];
    expect(reviewLinesOf(rows).map((l) => [l.mission, l.prd])).toEqual([[M2, 'omni-loop-31'], [M1, 'omni-loop-31'], [M1, 'omni-loop-32']]);
    expect(reviewLinesOf(rows, M2).map((l) => l.mission)).toEqual([M2]);
  });
});

describe('waitingOf', () => {
  it('lists each open point under its PRD, signed by the Architect', () => {
    const lines = reviewLinesOf([decision({}), decision({ kind: 'tech', outcome: 'escalated', why: ['which queue holds the retries'] }), decision({ prd: P32 })]);
    expect(waitingOf(lines)).toEqual([{ id: `${M1}:omni-loop-31:0`, prd: 'omni-loop-31', by: 'Architect · agent', point: 'which queue holds the retries' }]);
  });
});

const EMPTY_VIEW: RoomView = {
  fleet: 'night', color: null, now: nowLines([], []), cleanUp: 'Nothing to clean up', bugs: [], stopped: [], missions: [{ id: M1, title: 'Pay online' }],
  ledger: ledgerOf([], { role: null, mission: null }), filter: { role: null, mission: null }, empty: false, reviews: [], waiting: [],
};

describe('RoomTab, the plan and tech rows', () => {
  it('draws Waiting on you with the Architect\'s open points, and each PRD\'s plan row and tech row', () => {
    const reviews = reviewLinesOf([decision({}), decision({ kind: 'tech', outcome: 'escalated', settled: ['names the store port'], why: ['which queue holds the retries'] })]);
    const out = renderToStaticMarkup(createElement(RoomTab, { view: { ...EMPTY_VIEW, reviews, waiting: waitingOf(reviews) }, keep: {} }));
    expect(out).toContain('Waiting on you');
    expect(out).toContain('which queue holds the retries');
    expect(out).toContain('Plans and reviews');
    expect(out).toContain('PRD omni-loop-31');
    expect(out).toContain('Approved the plan · version aaaaaaa');
    expect(out).toContain('Left 1 point to you · settled: names the store port');
    expect(out.indexOf('Waiting on you')).toBeLessThan(out.indexOf('Plans and reviews'));
  });

  it('draws neither when no PRD of the PM\'s was planned', () => {
    const out = renderToStaticMarkup(createElement(RoomTab, { view: EMPTY_VIEW, keep: {} }));
    expect(out).not.toContain('Waiting on you');
    expect(out).not.toContain('Plans and reviews');
  });
});

/** A database whose every read answers `answers[table]`, recording each call made on it. */
function recording(answers: Record<string, unknown[]>) {
  const calls: unknown[][] = [];
  const db = {
    from: (table: string) => {
      calls.push(['from', table]);
      const self: Record<string, unknown> = { then: (done: (v: unknown) => void) => { done({ data: answers[table], error: null }); } };
      for (const n of ['select', 'in', 'eq', 'order', 'limit', 'is', 'gt', 'like']) self[n] = (...args: unknown[]) => { calls.push([n, ...args]); return self; };
      return self;
    },
  } as unknown as RoomDb;
  return { db, calls };
}

describe('roomRepository decisions', () => {
  it('reads the plan and tech decisions of these missions, oldest first', async () => {
    const { db, calls } = recording({
      mission_decisions: [{ mission_id: M1, product_prd: 'omni-loop-31', kind: 'tech', outcome: 'escalated', plan: null, settled: [], why: ['no record of the tech review'], decided_at: '2026-11-24T10:00:00Z' }],
    });
    expect(await roomRepository(db).decisions([M1])).toEqual([decision({ kind: 'tech', outcome: 'escalated', plan: null, why: ['no record of the tech review'], at: '2026-11-24T10:00:00Z' })]);
    expect(calls).toContainEqual(['from', 'mission_decisions']);
    expect(calls).toContainEqual(['in', 'kind', ['plan', 'tech']]);
    expect(calls).toContainEqual(['order', 'decided_at', { ascending: true }]);
    expect(await roomRepository(db).decisions([])).toEqual([]);
  });

  it('throws when the read fails', async () => {
    const db = { from: () => { const self: Record<string, unknown> = { then: (done: (v: unknown) => void) => { done({ data: null, error: { message: 'down' } }); } }; for (const n of ['select', 'in', 'order']) self[n] = () => self; return self; } } as unknown as RoomDb;
    await expect(roomRepository(db).decisions([M1])).rejects.toThrow('could not read the plan and tech decisions');
  });
});

describe('roomService, the plan and tech rows', () => {
  it('adds the reviews and their open points to the view, filtered by the mission the address names', async () => {
    const repository = {
      heroes: () => Promise.resolve([]), missions: () => Promise.resolve([{ id: M1, title: 'Pay online' }, { id: M2, title: 'Ship it' }]),
      events: () => Promise.resolve([]), kept: () => Promise.resolve([]), tokens: () => Promise.resolve(new Map()), qaJobs: () => Promise.resolve([]),
      waits: () => Promise.resolve({ queued: [], limited: [], waitingOn: new Map() }), repairs: () => Promise.resolve({ rows: [], events: [], statuses: new Map() }),
      decisions: () => Promise.resolve([decision({}), decision({ kind: 'tech', outcome: 'escalated', why: ['which queue'] }), decision({ mission: M2 })]),
    };
    const all = await roomService(repository).view('w', 'night', null, {}, new Date());
    expect(all.reviews).toHaveLength(2);
    expect(all.waiting?.map((w) => w.point)).toEqual(['which queue']);
    const one = await roomService(repository).view('w', 'night', null, { mission: M2 }, new Date());
    expect(one.reviews?.map((l) => l.mission)).toEqual([M2]);
    expect(one.waiting).toEqual([]);
  });
});
