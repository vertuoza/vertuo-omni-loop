import { describe, expect, it } from 'vitest';
import { parseIssue, parsePrd, type PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import { pmLine } from 'omni-loop/kit/lib/virtual-fleet/pm.ts';
import { addedOf, pmEvents, pmKey, pmNext, pmRoundOfKey, withAdded, withPm, type PmJob } from './pm.ts';
import type { Concluded, Mission } from './supervisor.ts';

// The PM's own PRDs in a mission's run (PRD 2896 s12), pure: its key, when it is sent, what it added, and the mission while it writes.

const ID = '0b7c1f6e-3a52-4d8e-9f10-2c4b6a8d0e13';
const p = (n: number): PrdNumber => parsePrd(n);
const mission: Pick<Mission, 'level' | 'status' | 'number'> = { level: 'alone', status: 'running', number: parseIssue(12) };
const job = (over: Partial<PmJob['attempt']> = {}, line = '/omni:roadmap --mission 12 --cap 2'): PmJob => ({
  round: 1, job: 'job-1', line, attempt: { id: 'job-1', status: 'done', outcome: null, reason: null, prUrl: null, ...over },
});

describe('pmKey', () => {
  it('reads back its round, and none from another key', () => {
    expect(pmRoundOfKey(pmKey(ID, 1))).toBe(1);
    expect(pmRoundOfKey(`mission:${ID}:prd:1:approve:1`)).toBeNull();
    expect(pmRoundOfKey(`mission:${ID}:pm:0`)).toBeNull();
  });
});

describe('pmNext', () => {
  const view = { mission, ownPrds: 3, added: 0, jobs: [] as PmJob[], inPlan: false };

  it('sends the cap left, once, while the mission runs or waits at alone', () => {
    expect(pmNext(view)).toEqual({ next: 'send', round: 1, skill: 'roadmap', cap: 3, line: '/omni:roadmap --mission 12 --cap 3' });
    expect(pmNext({ ...view, added: 2 })).toMatchObject({ next: 'send', skill: 'brainstorm', cap: 1 });
    expect(pmNext({ ...view, mission: { ...mission, status: 'waiting' } })).toMatchObject({ next: 'send' });
  });

  it('sends nothing once sent, at the cap, below alone, or while paused, a draft or delivered', () => {
    expect(pmNext({ ...view, jobs: [job()] })).toEqual({ next: 'none' });
    expect(pmNext({ ...view, added: 3 })).toEqual({ next: 'none' });
    expect(pmNext({ ...view, ownPrds: 0 })).toEqual({ next: 'none' });
    expect(pmNext({ ...view, mission: { ...mission, level: 'own-branch' } })).toEqual({ next: 'none' });
    for (const status of ['paused', 'draft', 'delivered', 'stopped'] as const) expect(pmNext({ ...view, mission: { ...mission, status } }), status).toEqual({ next: 'none' });
  });
});

describe('addedOf and withAdded', () => {
  it('reads the PRDs the fleet added, in order, once each, and puts them after the scope', () => {
    const recorded = [
      { kind: 'prd-added', prd: p(51), job: 'j' }, { kind: 'dispatched', prd: p(9), job: 'j' }, { kind: 'prd-added', prd: p(50), job: 'j' }, { kind: 'prd-added', prd: p(51), job: 'k' },
    ];
    expect(addedOf(recorded)).toEqual([p(51), p(50)]);
    expect(withAdded([p(1), p(50)], [p(51), p(50)])).toEqual([p(1), p(50), p(51)]);
  });
});

describe('pmEvents', () => {
  it('records nothing while the job works, or once an event names it', () => {
    expect(pmEvents(mission, job({ status: 'running' }), null, new Set(), [])).toEqual([]);
    expect(pmEvents(mission, job(), 'x', new Set(), [{ kind: 'prd-added', prd: p(50), job: 'job-1' }])).toEqual([]);
  });

  it('reads the cap from the line it was sent with, never more than the record says', () => {
    const log = pmLine({ v: 1, mission: 12, skill: 'roadmap', cap: 5, prds: [p(50), p(51), p(52)], unwritten: [] });
    expect(pmEvents(mission, job(), log, new Set([p(50)]), []).map((event) => [event.kind, event.prd, event.sentence])).toEqual([
      ['prd-added', p(51), 'PRD 51 added by the fleet.'],
      ['prd-added', p(52), 'PRD 52 added by the fleet.'],
    ]);
  });

  it('says a job that wrote nothing, was cancelled, or left no record added no PRD', () => {
    const none = pmLine({ v: 1, mission: 12, skill: 'brainstorm', cap: 1, prds: [], unwritten: [] });
    expect(pmEvents(mission, job({}, '/omni:brainstorm --mission 12 --cap 1'), none, new Set(), [])[0]?.sentence).toBe('/omni:brainstorm wrote no PRD: the fleet added none.');
    expect(pmEvents(mission, job({ status: 'cancelled' }), null, new Set(), [])[0]?.sentence).toBe('/omni:roadmap was cancelled: the fleet added no PRD.');
    expect(pmEvents(mission, job(), 'no record', new Set(), [])[0]?.sentence).toBe('/omni:roadmap ended with no record: the fleet added no PRD.');
  });
});

describe('withPm', () => {
  const at = '2027-01-23T09:01:00.000Z';
  const of = (status: Concluded['status'], waitingOn: string | null = null): Concluded => ({ status, waitingOn, nextWakeAt: null });

  it('keeps a mission whose PM writes running, a minute on', () => {
    expect(withPm(of('delivered'), true, at)).toEqual({ status: 'running', waitingOn: null, nextWakeAt: at });
    expect(withPm(of('stopped', 'nothing to do'), true, at)).toEqual({ status: 'running', waitingOn: null, nextWakeAt: at });
    expect(withPm(of('waiting', 'PRD 1: approve it'), true, at)).toEqual({ status: 'running', waitingOn: 'PRD 1: approve it', nextWakeAt: at });
  });

  it('changes nothing when the PM does not write, or the mission is paused, a draft or running', () => {
    expect(withPm(of('delivered'), false, at)).toEqual(of('delivered'));
    for (const status of ['paused', 'draft', 'running'] as const) expect(withPm(of(status), true, at)).toEqual(of(status));
  });
});
