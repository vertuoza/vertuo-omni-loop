import { parsePrd } from 'omni-loop/kit/lib/ids.ts';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { roleOf } from 'omni-loop/kit/lib/virtual-fleet/roles.ts';
import { RoomTab } from './RoomTab';
import { cleanUpLine, filterOf, ledgerOf, nowLines, roomHref, type EventRow, type HeroLine, type RoomView } from './room';
import { roomRepository, type RoomDb } from './room.repository';
import { roomService } from './room.service';
import { qaJobOf } from './qa';
import { limitWaitRepository } from '../limit-wait.repository';
import { limitWaitsOf, type WaitFacts } from '../limit-wait';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined }) }));

// The Operation room (PRD 2842 s8, PRD 2873 s3, the `fleet-room` screen): now lines, the clean-up line, the filtered ledger.

const M1 = '11111111-1111-4111-8111-111111111111';
const M2 = '22222222-2222-4222-8222-222222222222';
const JOB = '33333333-3333-4333-8333-333333333333';
const hero = (role: HeroLine['role'], skills: string[]): HeroLine => ({ id: `${role}-id`, name: role, role, skills });
const event = (over: Partial<EventRow>): EventRow => ({
  id: crypto.randomUUID(), mission: M1, at: '2026-11-14T09:12:00Z', role: 'engineer', actor: 'agent', kind: 'dispatched', prd: parsePrd(2803), job: JOB, link: null, sentence: 'Sent PRD 2803.', ...over,
});
// A PM whose skills need a person (since PRD 2871 the Reviewer's review runs alone, and since PRD 2896 the PM's writing skills on a
// mission's runner): `mission` is the seat a person still holds.
const HEROES = [hero('engineer', [...roleOf('engineer').skills]), hero('pm', ['mission'])];

describe('nowLines', () => {
  it('reads what a working hero does, Idle when it is not, and that a person does what no agent can', () => {
    const lines = nowLines(HEROES, [event({})]);
    expect(lines.map((l) => l.words)).toEqual(['Engineer · agent: building PRD 2803', 'A person does this today']);
    expect(nowLines(HEROES, [event({}), event({ kind: 'job-ended', at: '2026-11-14T10:00:00Z' })])[0]?.words).toBe('Idle');
  });

  it('reads an idle hero with a skill that runs alone as Idle, and one with none as `A person does this today`', () => {
    const lines = nowLines([hero('designer', [...roleOf('designer').skills]), hero('pm', ['mission']), hero('reviewer', ['tech-review'])], []);
    expect(lines.map((l) => [l.heading, l.words, l.state])).toEqual([
      ['Designer · agent', 'Idle', 'idle'],
      ['PM · agent', 'A person does this today', 'person'],
      ['Reviewer · agent', 'A person does this today', 'person'],
    ]);
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
    const view: RoomView = { fleet: 'night', color: null, now: [], cleanUp: 'Nothing to clean up', stopped: [], missions: [], ledger, filter: { role: 'reviewer', mission: null }, empty: false };
    const out = renderToStaticMarkup(createElement(RoomTab, { view, keep: {} }));
    expect(out).toContain('Reviewer · agent');
    expect(out).toContain('Changes asked: 2 findings, round 1/2.');
    expect(out).toContain('href="https://github.com/o/r/pull/2817#pullrequestreview-1">Review</a>');
    expect(out).toContain('>Changes</span>');
  });
});

describe('the mission branch rows (PRD 2896 s8)', () => {
  const at = (hour: string) => `2026-11-14T${hour}:00Z`;
  const row = (kind: string, sentence: string, hour: string) => event({ role: 'supervisor', kind, sentence, at: at(hour), job: null, link: 'https://github.com/o/r/pull/9' });

  it('shows a join, a drop, a drop asked and a landing as one row each, with their own state words', () => {
    const rows = ledgerOf(
      [
        row('prd-joined', 'PRD 2803 joined mission/40-pay: #9 squash-merged.', '08'),
        row('drop-asked', 'pierrederval asked to drop PRD 2803.', '09'),
        row('prd-dropped', 'PRD 2803 was dropped from mission/40-pay.', '10'),
        row('prd-merged', 'PRD 2804 landed on the default branch with #12: shipped.', '11'),
        row('prd-merged', 'PRD 2805 is merged: delivered.', '12'),
      ],
      { role: null, mission: null },
    );
    expect(rows.map((r) => r.state)).toEqual(['Merged', 'Landed', 'Dropped', 'Drop asked', 'Joined']);
    expect(rows.every((r) => r.by === 'Supervisor · agent')).toBe(true);
  });
});

describe('the committee rows (PRD 2896 s9, s10)', () => {
  it('shows the committee\'s decision as Decided, and what it sent to a person as Sent to you, signed by the PM', () => {
    const at = (hour: string) => `2026-11-16T${hour}:00Z`;
    const rows = ledgerOf(
      [
        event({ role: 'pm', kind: 'decided', sentence: 'The committee answered s3-01-keep-the-cap of PRD 7 with option A: every member who sat answered yes.', at: at('08'), job: 'j-1', link: null }),
        event({ role: 'pm', kind: 'escalated', sentence: 's3-02-other of PRD 7 goes to a person: the Reviewer answered unsure: No test.', at: at('09'), job: 'j-2', link: null }),
      ],
      { role: null, mission: null },
    );
    expect(rows.map((r) => [r.state, r.by])).toEqual([
      ['Sent to you', 'PM · agent'],
      ['Decided', 'PM · agent'],
    ]);
  });
});

describe('roomService', () => {
  it('reads the heroes, missions, events and saves as one view', async () => {
    const repository = {
      heroes: () => Promise.resolve(HEROES),
      missions: () => Promise.resolve([{ id: M1, title: 'Pay online' }]),
      events: () => Promise.resolve([event({})]),
      kept: () => Promise.resolve([]),
      tokens: () => Promise.resolve(new Map([[JOB, null]])),
      qaJobs: () => Promise.resolve([]),
      waits: () => Promise.resolve({ queued: [], limited: [], waitingOn: new Map() }),
      repairs: () => Promise.resolve({ rows: [], events: [], statuses: new Map() }),
    };
    const view = await roomService(repository).view('w', 'night', null, { role: 'engineer' }, new Date());
    expect(view).toMatchObject({ empty: false, cleanUp: 'Nothing to clean up', stopped: [], filter: { role: 'engineer', mission: null } });
    expect(view.ledger).toHaveLength(1);
  });

  it('adds each job\'s tokens to the rows that end it, and `tokens unknown` when it has none (AC-8)', async () => {
    const repository = {
      heroes: () => Promise.resolve(HEROES), missions: () => Promise.resolve([{ id: M1, title: 'Pay online' }]),
      events: () => Promise.resolve([event({ kind: 'job-ended', sentence: 'Ended.' }), event({ kind: 'dispatched', sentence: 'Sent.' })]),
      kept: () => Promise.resolve([]), tokens: () => Promise.resolve(new Map()), qaJobs: () => Promise.resolve([]),
      waits: () => Promise.resolve({ queued: [], limited: [], waitingOn: new Map() }), repairs: () => Promise.resolve({ rows: [], events: [], statuses: new Map() }),
    };
    const view = await roomService(repository).view('w', 'night', null, {}, new Date());
    expect(view.ledger.map((r) => r.sentence).toSorted()).toEqual(['Ended. · tokens unknown', 'Sent.']);
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
    fleet: 'night', color: '#4fb0ff', now: nowLines(HEROES, []), cleanUp: 'Nothing to clean up', stopped: [], missions: [{ id: M1, title: 'Pay online' }],
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

describe('the waiting now lines (PRD 2949 s5, the `fleet-room` screen)', () => {
  const LIMITED = '44444444-4444-4444-8444-444444444444';
  const QUEUED = '55555555-5555-4555-8555-555555555555';
  const key = `mission:${M1}:prd:2803:run:1`;
  const now = new Date('2026-11-16T02:00:00Z');
  const limitFacts = (guessed: boolean): WaitFacts => ({
    queued: [{ id: QUEUED, mission: M1, key, resumes: LIMITED, queuedAt: '2026-11-16T01:59:00Z' }],
    limited: [{ id: LIMITED, limitedUntil: '2026-11-16T09:00:00Z', account: 'claude-1', guessed }],
    waitingOn: new Map([[M1, 'PRD 2803: waiting for a provider limit until 09:00 UTC']]),
  });
  const ended = [event({}), event({ kind: 'job-ended', at: '2026-11-14T10:00:00Z' })];
  const viewOf = (lines: RoomView['now']): RoomView => ({ fleet: 'night', color: null, now: lines, cleanUp: 'x', stopped: [], missions: [], ledger: [], filter: { role: null, mission: null }, empty: false });

  it('says the provider limit, the account that ran out, its linked job, and that no tokens are spent', () => {
    const lines = nowLines(HEROES, ended, limitWaitsOf(limitFacts(false), now));
    expect(lines[0]).toMatchObject({ state: 'waiting', words: 'Provider limit reached until 09:00 · waiting until 09:00' });
    const out = renderToStaticMarkup(createElement(RoomTab, { view: viewOf(lines), keep: {} }));
    expect(out).toContain('Provider limit reached until 09:00 · waiting until 09:00.');
    expect(out).toContain(`claude-1 ran out · <a href="/app/runners#job-${LIMITED}">job 44444444</a> · tokens spent waiting 0 · next try 09:00`);
    expect(out).toContain('Waiting until 09:00');
  });

  it('adds (guessed) when the runner guessed the reset', () => {
    expect(nowLines(HEROES, ended, limitWaitsOf(limitFacts(true), now))[0]?.words).toBe('Provider limit reached until 09:00 · waiting until 09:00 (guessed)');
  });

  it('reads a limit already lifted as no wait', () => {
    expect(limitWaitsOf(limitFacts(false), new Date('2026-11-16T09:00:01Z'))).toEqual([]);
  });

  it('says every runner is busy when the supervisor wrote that the PRD waits for room, linking its queued job', () => {
    const facts: WaitFacts = { queued: [{ id: QUEUED, mission: M1, key, resumes: null, queuedAt: '2026-11-16T01:59:00Z' }], limited: [], waitingOn: new Map([[M1, "PRD 2803: waiting for room on the fleet's runners"]]) };
    const lines = nowLines(HEROES, ended, limitWaitsOf(facts, now));
    expect(lines[0]?.words).toBe('All runners are busy · waiting for room');
    const out = renderToStaticMarkup(createElement(RoomTab, { view: viewOf(lines), keep: {} }));
    expect(out).toContain(`<a href="/app/runners#job-${QUEUED}">job 55555555</a> queued · tokens spent waiting 0`);
    expect(out).toContain('Waiting for room');
  });
});

describe('roomRepository waits', () => {
  it("reads the queued jobs, the jobs they resume and the missions' words", async () => {
    const answers: Record<string, unknown[]> = {
      missions: [{ id: M1, waiting_on: null }],
      runner_jobs: [{ id: JOB, mission_id: M1, mission_key: null, resumes: null, queued_at: '2026-11-16T01:00:00Z' }],
    };
    const db = { from: (table: string) => { const self: Record<string, unknown> = { then: (done: (v: unknown) => void) => { done({ data: answers[table], error: null }); } }; for (const n of ['select', 'in', 'eq']) self[n] = () => self; return self; } } as unknown as RoomDb;
    expect(await limitWaitRepository(db).facts([M1])).toMatchObject({ queued: [{ id: JOB, mission: M1 }], limited: [] });
    expect(await limitWaitRepository(db).facts([])).toMatchObject({ queued: [] });
  });
});

describe('the QA rows and now line (PRD 3001, AC-9)', () => {
  const QA = hero('qa', [...roleOf('qa').skills]);
  const checked = event({ role: 'qa', kind: 'checked', sentence: '2 bugs found · Round 1 of 2 · #12 #13', link: 'https://github.com/o/r/pull/2817#issuecomment-5', tokens: { input: 39000, output: 1000, cacheRead: 500, cacheWrite: 500 } });

  it('AC-9: reads a verdict row as QA · agent · 2 bugs found · Round 1 of 2 · #12 #13 · 41k tokens, with its state and its comment', () => {
    const [row] = ledgerOf([checked], { role: null, mission: null });
    expect(row).toMatchObject({ by: 'QA · agent', sentence: '2 bugs found · Round 1 of 2 · #12 #13 · 41k tokens', state: 'Bugs', linkLabel: 'QA comment' });
    expect(ledgerOf([event({ role: 'qa', kind: 'checked', sentence: 'pass · Round 2 of 2', tokens: null })], { role: null, mission: null })[0]).toMatchObject({ sentence: 'pass · Round 2 of 2 · tokens unknown', state: 'Passed' });
  });

  it('reads the Engineer\'s fix rows with their tokens', () => {
    const rows = ledgerOf([event({ kind: 'job-ended', sentence: 'fixed #12 · PR #15', tokens: { input: 1200, output: 300, cacheRead: 0, cacheWrite: 0 } }), event({ kind: 'job-ended', at: '2026-11-14T09:13:00Z', sentence: 'not fixed #13: it is not a bug', tokens: null })], { role: null, mission: null });
    expect(rows.map((r) => r.sentence)).toEqual(['not fixed #13: it is not a bug · tokens unknown', 'fixed #12 · PR #15 · 1.5k tokens']);
  });

  it('says what QA checks, what it waits for, and Idle', () => {
    const job = { mission: M1, prd: parsePrd(2803), round: 1 as const, previewWait: false };
    expect(nowLines([QA], [checked, event({})], [], [], [job])[0]).toMatchObject({ words: 'Checking PR 2817 · round 1 of 2', state: 'checking' });
    expect(nowLines([QA], [], [], [], [{ ...job, round: 2 }])[0]?.words).toBe('Checking PRD 2803 · round 2 of 2');
    expect(nowLines([QA], [], [], [], [{ ...job, previewWait: true }])[0]?.words).toBe('Waiting for the preview');
    expect(nowLines([QA], [])[0]?.words).toBe('Idle');
  });

  it('reads a running QA job from its key and the end of its log', () => {
    const key = `mission:${M1}:prd:2803:run:1:qa:2`;
    expect(qaJobOf({ mission: M1, key, logTail: 'a\nWaiting for the preview\n' })).toMatchObject({ round: 2, previewWait: true });
    expect(qaJobOf({ mission: M1, key, logTail: 'Waiting for the preview\nChecking AC-1' })?.previewWait).toBe(false);
    expect(qaJobOf({ mission: M1, key: `mission:${M1}:prd:2803:run:1:review:1`, logTail: '' })).toBeNull();
    expect(qaJobOf({ mission: M1, key: null, logTail: '' })).toBeNull();
  });

  it('reads tokens and QA jobs from the database', async () => {
    const answers: Record<string, unknown[]> = { runner_jobs: [{ id: JOB, tokens: { input: 1, output: 2, cacheRead: 0, cacheWrite: 0 }, mission_id: M1, mission_key: `mission:${M1}:prd:2803:run:1:qa:1`, log_tail: null }, { id: M2, tokens: { input: -1 }, mission_id: M1, mission_key: null, log_tail: 'x' }] };
    const db = { from: (table: string) => { const self: Record<string, unknown> = { then: (done: (v: unknown) => void) => { done({ data: answers[table], error: null }); } }; for (const n of ['select', 'in', 'eq', 'like']) self[n] = () => self; return self; } } as unknown as RoomDb;
    const repository = roomRepository(db);
    expect(await repository.tokens([JOB, M2])).toEqual(new Map([[JOB, { input: 1, output: 2, cacheRead: 0, cacheWrite: 0 }], [M2, null]]));
    expect(await repository.tokens([])).toEqual(new Map());
    expect(await repository.qaJobs([M1])).toEqual([{ mission: M1, prd: 2803, round: 1, previewWait: false }]);
    expect(await repository.qaJobs([])).toEqual([]);
  });
});

describe('a budget stop in the ledger (PRD 3040, `fleet-room` 2.A)', () => {
  it('reads Supervisor · agent, the stop\'s sentence and Paused, then the person\'s answer under their login', () => {
    const stop = event({ id: 'stop', at: '2026-11-18T01:00:00Z', role: 'supervisor', actor: 'agent', kind: 'budget-stop', prd: null, job: null, sentence: 'Paused: this fleet\'s daily cap reached (2M)' });
    const answer = event({ id: 'answer', at: '2026-11-18T02:00:00Z', role: 'supervisor', actor: 'ada', kind: 'budget-answer', prd: null, job: null, sentence: 'ada chose Resume tomorrow.' });
    const rows = ledgerOf([stop, answer], { role: null, mission: null });
    expect(rows.map((r) => [r.by, r.sentence, r.state])).toEqual([
      ['ada', 'ada chose Resume tomorrow.', 'Answered'],
      ['Supervisor · agent', 'Paused: this fleet\'s daily cap reached (2M)', 'Paused'],
    ]);
  });
});
