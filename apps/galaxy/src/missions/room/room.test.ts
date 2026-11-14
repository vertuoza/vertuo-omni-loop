import { parsePrd } from 'omni-loop/kit/lib/ids.ts';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { RoomTab } from './RoomTab';
import { cleanUpLine, filterOf, ledgerOf, nowLines, roomHref, type EventRow, type HeroLine, type RoomView } from './room';
import { roomRepository, type RoomDb } from './room.repository';
import { roomService } from './room.service';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined }) }));

// The Operation room (PRD 2842 s8, the `fleet-room` screen): now lines, the clean-up line, the filtered ledger.

const M1 = '11111111-1111-4111-8111-111111111111';
const M2 = '22222222-2222-4222-8222-222222222222';
const JOB = '33333333-3333-4333-8333-333333333333';
const hero = (role: HeroLine['role'], skills: string[]): HeroLine => ({ id: `${role}-id`, name: role, role, skills });
const event = (over: Partial<EventRow>): EventRow => ({
  id: crypto.randomUUID(), mission: M1, at: '2026-11-14T09:12:00Z', role: 'engineer', actor: 'agent', kind: 'dispatched', prd: parsePrd(2803), job: JOB, link: null, sentence: 'Sent PRD 2803.', ...over,
});
// A PM runs no skill alone (since PRD 2871 the Reviewer's review does): the seat a person still holds.
const HEROES = [hero('engineer', ['yolo']), hero('pm', ['plan'])];

describe('nowLines', () => {
  it('reads what a working hero does, Idle when it is not, and that a person does what no agent can', () => {
    const lines = nowLines(HEROES, [event({})]);
    expect(lines.map((l) => l.words)).toEqual(['Engineer · agent: building PRD 2803', 'A person does this today']);
    expect(nowLines(HEROES, [event({}), event({ kind: 'job-ended', at: '2026-11-14T10:00:00Z' })])[0]?.words).toBe('Idle');
  });
});

describe('cleanUpLine', () => {
  it('says nothing is kept, or what is', () => {
    expect(cleanUpLine([])).toBe('Nothing to clean up');
    expect(cleanUpLine([{ bytes: 3 * 1024 * 1024, keepUntil: '2026-11-20T00:00:00Z' }, { bytes: 1024 * 1024, keepUntil: '2026-11-18T00:00:00Z' }])).toBe('2 saves kept · 4.0 MB · until 2026-11-18');
  });
});

describe('the ledger', () => {
  const events = [event({ at: '2026-11-14T08:00:00Z', role: 'supervisor', kind: 'started', actor: 'pierrederval', prd: null, job: null }), event({}), event({ mission: M2, kind: 'prd-merged', at: '2026-11-14T11:00:00Z' })];

  it('lists the events newest first, each signed and with its state word', () => {
    const rows = ledgerOf(events, { role: null, mission: null });
    expect(rows.map((r) => r.state)).toEqual(['Merged', 'Sent', 'Started']);
    expect(rows.map((r) => r.by)).toEqual(['Engineer · agent', 'Engineer · agent', 'pierrederval']);
  });

  it('filters by role and by mission, ignoring what the address names wrongly', () => {
    expect(ledgerOf(events, filterOf({ role: 'supervisor' }, [M1, M2]))).toHaveLength(1);
    expect(ledgerOf(events, filterOf({ mission: M2 }, [M1, M2]))).toHaveLength(1);
    expect(filterOf({ role: 'nobody', mission: 'x' }, [M1])).toEqual({ role: null, mission: null });
  });

  it('keeps the rest of the address when a filter changes', () => {
    expect(roomHref('/app/fleet', { fleet: 'a', role: 'qa' }, { role: null })).toBe('/app/fleet?fleet=a');
  });
});

describe('the Reviewer rows (PRD 2871)', () => {
  const asked = event({ role: 'reviewer', kind: 'reviewed', at: '2026-11-14T06:40:00Z', link: 'https://github.com/o/r/pull/2817#pullrequestreview-1', sentence: 'Changes asked: 2 findings, round 1/2.' });
  const passed = event({ role: 'reviewer', kind: 'reviewed', at: '2026-11-14T07:40:00Z', link: 'https://github.com/o/r/pull/2817#pullrequestreview-2', sentence: 'Passed, round 2 of 2: marked ready.' });

  it('signs each verdict Reviewer · agent with its state word and a link to the review', () => {
    const rows = ledgerOf([asked, passed, event({})], { role: null, mission: null });
    expect(rows.map((r) => [r.by, r.state, r.linkLabel])).toEqual([['Engineer · agent', 'Sent', 'PRD 2803'], ['Reviewer · agent', 'Passed', 'Review'], ['Reviewer · agent', 'Changes', 'Review']]);
  });

  it('shows only those rows to the Reviewer filter, and draws the link and the word', () => {
    const ledger = ledgerOf([asked, event({})], filterOf({ role: 'reviewer' }, [M1]));
    expect(ledger).toHaveLength(1);
    const view: RoomView = { fleet: 'night', color: null, now: [], cleanUp: 'Nothing to clean up', missions: [], ledger, filter: { role: 'reviewer', mission: null }, empty: false };
    const out = renderToStaticMarkup(createElement(RoomTab, { view, keep: {} }));
    expect(out).toContain('Reviewer · agent');
    expect(out).toContain('Changes asked: 2 findings, round 1/2.');
    expect(out).toContain('href="https://github.com/o/r/pull/2817#pullrequestreview-1">Review</a>');
    expect(out).toContain('>Changes</span>');
  });
});

describe('roomService', () => {
  it('reads the heroes, missions, events and saves as one view', async () => {
    const repository = {
      heroes: () => Promise.resolve(HEROES),
      missions: () => Promise.resolve([{ id: M1, title: 'Pay online' }]),
      events: () => Promise.resolve([event({})]),
      kept: () => Promise.resolve([]),
    };
    const view = await roomService(repository).view('w', 'night', null, { role: 'engineer' }, new Date());
    expect(view).toMatchObject({ empty: false, cleanUp: 'Nothing to clean up', filter: { role: 'engineer', mission: null } });
    expect(view.ledger).toHaveLength(1);
  });
});

describe('roomRepository', () => {
  it('throws when a read fails', async () => {
    const query: Record<string, unknown> = {};
    const chain = new Proxy(query, { get: (_t, key) => (key === 'then' ? (done: (v: unknown) => void) => { done({ data: null, error: { message: 'down' } }); } : () => chain) });
    const db = { from: () => chain } as unknown as RoomDb;
    await expect(roomRepository(db).heroes('w', 'f')).rejects.toThrow('could not read the heroes');
  });
});

describe('RoomTab', () => {
  const view: RoomView = {
    fleet: 'night', color: '#4fb0ff', now: nowLines(HEROES, []), cleanUp: 'Nothing to clean up', missions: [{ id: M1, title: 'Pay online' }],
    ledger: ledgerOf([event({})], { role: null, mission: null }), filter: { role: null, mission: null }, empty: false,
  };

  it('draws the now lines, the clean-up line and the ledger, with no slide-in on load', () => {
    const out = renderToStaticMarkup(createElement(RoomTab, { view, keep: { fleet: 'night' } }));
    expect(out).toContain('Idle');
    expect(out).toContain('A person does this today');
    expect(out).toContain('Nothing to clean up');
    expect(out).toContain('Sent PRD 2803.');
    expect(out).not.toContain('room-new');
    expect(out).toContain('name="fleet"');
  });

  it('points an empty room to Missions', () => {
    expect(renderToStaticMarkup(createElement(RoomTab, { view: { ...view, ledger: [], empty: true }, keep: {} }))).toContain('Start one in Missions.');
  });
});
