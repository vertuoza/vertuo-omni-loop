import { parsePrd } from 'omni-loop/kit/lib/ids.ts';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { RoomTab } from './room/RoomTab';
import { ledgerOf, nowLines, type EventRow, type HeroLine, type RoomView } from './room/room';
import { missionOf, type MissionRow } from './page/missions-tab';
import { MissionsTab } from './page/MissionsTab';
import { leftOf, repairLinesOf, type RepairEvent, type RepairFacts, type RepairRow } from './repair';
import { repairRepository, type RepairDb } from './repair.repository';
import { MOVES } from './missions.contract';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => undefined, refresh: () => undefined }) }));

// What a mission's repairs look like (PRD 2980 s6, AC-10): Repairing (2 of 3) · 7 left in this mission, the Stopped block, the
// Waits on Omni Loop line, and the four ledger rows.

const M = '11111111-1111-4111-8111-111111111111';
const JOB1 = '22222222-2222-4222-8222-222222222221';
const JOB2 = '22222222-2222-4222-8222-222222222222';
const FP = '3fa1c09e'.padEnd(64, '0');
const PR = (n: number) => `https://github.com/acme/shop/pull/${String(n)}`;
const row = (over: Partial<RepairRow>): RepairRow => ({
  mission: M, prd: parsePrd(2801), trigger: 'failure', fingerprint: FP, round: 1, number: 1, job: JOB1, fixPr: PR(2984), outcome: 'not fixed', startedAt: '2026-11-17T06:03:00Z', retro: { cause: 'The login test waits for a session the fixture never creates.', class: 'code', proposedFix: 'One session in the shared fixture' }, ...over,
});
const ev = (kind: string, at: string, over: Partial<RepairEvent> = {}): RepairEvent => ({ mission: M, kind, prd: parsePrd(2801), job: JOB1, link: null, at, ...over });
const facts = (rows: RepairRow[], events: RepairEvent[], status: 'running' | 'stopped' = 'running'): RepairFacts => ({ rows, events: events.toSorted((a, b) => b.at.localeCompare(a.at)), statuses: new Map([[M, status]]) });

describe('repairLinesOf', () => {
  it('reads a PRD with a repair at work as Repairing (2 of 3) with the mission count and its fix PR', () => {
    const rows = [row({ outcome: 'not fixed' }), row({ number: 2, job: JOB2, outcome: null, startedAt: '2026-11-17T07:00:00Z', fixPr: PR(2987) })];
    const lines = repairLinesOf(facts(rows, [ev('repair-started', '2026-11-17T06:03:00Z'), ev('repair-ended', '2026-11-17T06:30:00Z'), ev('repair-started', '2026-11-17T07:00:00Z', { job: JOB2 })]));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ kind: 'repairing', headline: 'Repairing (2 of 3) · 7 left in this mission', chip: 'Repairing', link: { label: 'PR 2987' }, fingerprint: '3fa1c09e' });
  });

  it('counts a repair about to start as the next one of its cause, and a lost one as none spent', () => {
    expect(leftOf([row({ outcome: 'not fixed' }), row({ number: 2, job: JOB2, outcome: 'lost' })])).toBe(8);
    const lines = repairLinesOf(facts([row({})], [ev('repair-started', '2026-11-17T06:03:00Z'), ev('repair-ended', '2026-11-17T06:30:00Z'), ev('repair-started', '2026-11-17T07:00:00Z', { job: JOB2 })]));
    expect(lines[0]?.headline).toBe('Repairing (2 of 3) · 8 left in this mission');
  });

  it('reads a PRD stopped after 3 repairs as the Stopped block: the cause, each repair tried, the fix, what is left, Resume', () => {
    const rows = [1, 2, 3].map((n) => row({ number: n, job: `22222222-2222-4222-8222-22222222222${String(n)}`, fixPr: PR(2983 + n), startedAt: `2026-11-17T0${String(5 + n)}:00:00Z` }));
    const lines = repairLinesOf(facts(rows, [ev('repair-started', '2026-11-17T08:00:00Z', { job: rows[2]?.job ?? null }), ev('repair-ended', '2026-11-17T09:12:00Z', { job: rows[2]?.job ?? null }), ev('stopped', '2026-11-17T09:14:00Z', { link: PR(2801) })], 'stopped'));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      kind: 'stopped',
      headline: 'PRD 2801 stopped',
      cause: 'The login test waits for a session the fixture never creates.',
      proposedFix: 'One session in the shared fixture',
      left: '6 of 9 left in this mission',
      resume: 'Resume: 3 more for this cause',
      byHand: PR(2801),
    });
    expect(lines[0]?.tried.map((t) => [t.fix?.label, t.words])).toEqual([['PR 2984', 'Not fixed'], ['PR 2985', 'Not fixed'], ['PR 2986', 'Not fixed']]);
  });

  it('reads a PRD whose bug was reported as waiting on the Omni Loop issue, linked', () => {
    const lines = repairLinesOf(facts([row({ outcome: 'stopped', fixPr: null })], [ev('repair-started', '2026-11-17T07:40:00Z'), ev('repair-ended', '2026-11-17T07:46:00Z'), ev('bug-reported', '2026-11-17T07:48:00Z', { link: 'https://github.com/vertuoza/vertuo-omni-loop/issues/3012' })]));
    expect(lines[0]).toMatchObject({ kind: 'waits', headline: 'Waits on Omni Loop bug #3012', chip: 'Waits on Omni Loop', link: { href: 'https://github.com/vertuoza/vertuo-omni-loop/issues/3012' } });
  });

  it('says nothing of a PRD that reached ready after its repair, or of one never repaired', () => {
    expect(repairLinesOf(facts([row({ outcome: 'fixed' })], [ev('repair-started', '2026-11-17T06:03:00Z'), ev('repair-ended', '2026-11-17T06:31:00Z'), ev('prd-ready', '2026-11-17T08:00:00Z')]))).toEqual([]);
    expect(repairLinesOf(facts([], []))).toEqual([]);
  });
});

const HERO: HeroLine = { id: 'e', name: 'e', role: 'engineer', skills: ['yolo'] };
const sent: EventRow = { id: 'a', mission: M, at: '2026-11-17T06:00:00Z', role: 'engineer', actor: 'agent', kind: 'dispatched', prd: parsePrd(2801), job: JOB1, link: null, sentence: 'Sent PRD 2801.' };
const stoppedFacts = (): RepairFacts => facts([1, 2, 3].map((n) => row({ number: n, job: `22222222-2222-4222-8222-22222222222${String(n)}`, fixPr: PR(2983 + n), startedAt: `2026-11-17T0${String(5 + n)}:00:00Z` })), [ev('repair-started', '2026-11-17T08:00:00Z', { job: '22222222-2222-4222-8222-222222222223' }), ev('repair-ended', '2026-11-17T09:12:00Z', { job: '22222222-2222-4222-8222-222222222223' }), ev('stopped', '2026-11-17T09:14:00Z')], 'stopped');
const viewOf = (over: Partial<RoomView>): RoomView => ({ fleet: 'f', color: null, now: [], cleanUp: 'x', stopped: [], missions: [], ledger: [], filter: { role: null, mission: null }, empty: false, ...over });

describe('the Operation room (AC-10)', () => {
  it('reads Repairing on the hero that sent the PRD, its cause and its fix linked', () => {
    const lines = repairLinesOf(facts([row({ outcome: null, fixPr: PR(2984) })], [ev('repair-started', '2026-11-17T06:03:00Z')]));
    const now = nowLines([HERO], [sent], [], lines);
    expect(now[0]).toMatchObject({ state: 'repairing', words: 'Repairing (1 of 3) · 8 left in this mission' });
    const out = renderToStaticMarkup(createElement(RoomTab, { view: viewOf({ now }), keep: {} }));
    expect(out).toContain('Repairing (1 of 3) · 8 left in this mission');
    expect(out).toContain('Cause 3fa1c09e.');
    expect(out).toContain(`<a href="${PR(2984)}">PR 2984</a>`);
  });

  it('AC-10: draws the Stopped block under the now lines, with Resume, the repairs tried and the proposed fix', () => {
    const stopped = repairLinesOf(stoppedFacts());
    const out = renderToStaticMarkup(createElement(RoomTab, { view: viewOf({ stopped }), keep: {} }));
    expect(out).toContain('PRD 2801 stopped');
    expect(out).toContain('Repairs tried');
    expect(out).toContain('PR 2986</a> · Not fixed');
    expect(out).toContain('One session in the shared fixture');
    expect(out).toContain('6 of 9 left in this mission');
    expect(out).toContain('>Resume</button>');
    expect(out).toContain('Resume: 3 more for this cause');
  });

  it('gives the four ledger rows their state words and links', () => {
    const e = (kind: string, sentence: string, link: string | null, role: EventRow['role'] = 'supervisor'): EventRow => ({ ...sent, id: kind + sentence, kind, role, link, sentence, at: '2026-11-17T07:00:00Z' });
    const rows = ledgerOf([
      e('repair-started', 'Sent /omni:repair (repair 1).', null),
      e('retro', "PRD 2801's retro [3fa1c09e] reads code: x", PR(2984), 'engineer'),
      e('repair-ended', "PRD 2801's repair [3fa1c09e] ended fixed.", PR(2984)),
      e('repair-ended', "PRD 2801's repair [3fa1c09e] ended not fixed.", PR(2985)),
      e('bug-reported', 'PRD 2801 met an Omni Loop bug [3fa1c09e]: reported as #3012.', 'https://github.com/vertuoza/vertuo-omni-loop/issues/3012'),
    ], { role: null, mission: null });
    expect(rows.map((r) => [r.state, r.linkLabel])).toEqual([['Repairing', 'PRD 2801'], ['Retro', 'PR 2984'], ['Fixed', 'PR 2984'], ['Not fixed', 'PR 2985'], ['Reported', 'Omni Loop #3012']]);
  });
});

describe('the Missions tab', () => {
  const mission: MissionRow = { id: M, repo: 'acme/shop', number: 40, title: 'Pay online', goal: 'Pay.', status: 'stopped', waitingOn: 'PRD 2801 stops: its cause was repaired 3 times', prds: [parsePrd(2801)], level: 'with-you', inPlan: false };

  it('offers Resume on a stopped mission once repairs say why, in the Stopped block, and keeps the plain stopped line otherwise', () => {
    const view = missionOf(mission, [], [], repairLinesOf(stoppedFacts()));
    expect(view.action).toBeNull();
    expect(view.stopped).toBeNull();
    expect(missionOf(mission, []).action).toBeNull();
    const out = renderToStaticMarkup(createElement(MissionsTab, { view: { workspace: 'w', fleet: 'f', missions: [view] } }));
    expect(out).toContain('PRD 2801 stopped');
    expect(out.match(/>Resume</g)).toHaveLength(1);
  });

  it('says Repairing on a running mission', () => {
    const lines = repairLinesOf(facts([row({ outcome: null })], [ev('repair-started', '2026-11-17T06:03:00Z')]));
    const out = renderToStaticMarkup(createElement(MissionsTab, { view: { workspace: 'w', fleet: 'f', missions: [missionOf({ ...mission, status: 'running', waitingOn: null }, [], [], lines)] } }));
    expect(out).toContain('PRD 2801: Repairing (1 of 3) · 8 left in this mission.');
  });

  it('lets Resume move a stopped mission, as it moves a paused one', () => {
    expect(MOVES.resume.from).toEqual(['paused', 'stopped']);
  });
});

describe('repairRepository', () => {
  it('reads the repairs, their events and the missions status as the person', async () => {
    const answers: Record<string, unknown[]> = {
      mission_repairs: [{ mission_id: M, prd: 2801, trigger: 'failure', fingerprint: FP, round: 1, number: 1, job_id: JOB1, fix_pr: PR(2984), outcome: 'fixed', started_at: '2026-11-17T06:03:00Z', retro: { cause: 'c', class: 'code', proposedFix: 'f' } }, { mission_id: M, prd: null, trigger: 'stuck', fingerprint: FP, round: 1, number: 1, job_id: JOB2, fix_pr: null, outcome: null, started_at: '2026-11-17T07:03:00Z', retro: null }],
      mission_events: [{ mission_id: M, kind: 'repair-started', prd: 2801, job_id: JOB1, link: null, at: '2026-11-17T06:03:00Z' }],
      missions: [{ id: M, status: 'stopped' }],
    };
    const db = { from: (table: string) => { const self: Record<string, unknown> = { then: (done: (v: unknown) => void) => { done({ data: answers[table], error: null }); } }; for (const n of ['select', 'in', 'order', 'limit']) self[n] = () => self; return self; } } as unknown as RepairDb;
    const read = await repairRepository(db).facts([M]);
    expect(read.rows[0]).toMatchObject({ prd: 2801, trigger: 'failure', outcome: 'fixed', number: 1 });
    // A stuck repair whose cause is the mission's own names no PRD (PRD 3065), and spends from the mission's 9 all the same.
    expect(read.rows[1]).toMatchObject({ prd: null, trigger: 'stuck', outcome: null });
    expect(leftOf(read.rows)).toBe(7);
    expect(read.events).toHaveLength(1);
    expect(read.statuses.get(M)).toBe('stopped');
    expect((await repairRepository(db).facts([])).rows).toEqual([]);
  });
});
