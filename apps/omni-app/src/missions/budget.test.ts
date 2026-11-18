// What a mission run does about its token budget (PRD 3040 s3): pure, over what the run read of the caps, the stops and the
// person's own Pause and Resume.
import { describe, expect, it } from 'vitest';
import { budgetAct, capWords, spentWords, type BudgetRead, type StopRow } from './budget.ts';
import type { MissionStatus } from './supervisor.ts';

const ID = 'm-1';
const NOW = Date.parse('2027-01-26T09:00:00Z');
const at = (minutes: number): string => new Date(NOW + minutes * 60_000).toISOString();

const read = (over: Partial<BudgetRead> = {}): BudgetRead => ({
  missionSpent: 0,
  missionCap: null,
  fleetSpent24h: 0,
  fleetCap: null,
  oldestEnd: null,
  named: null,
  open: null,
  personPausedAt: null,
  personResumedAt: null,
  agentPausedAt: null,
  ...over,
});

const stop = (over: Partial<StopRow> = {}): StopRow => ({
  id: 'stop-1',
  cap: 'mission',
  capTokens: 1000,
  spent: 1100,
  missions: [ID],
  answer: null,
  raisedTo: null,
  createdAt: at(-30),
  answeredAt: null,
  ...over,
});

const act = (state: BudgetRead, status: MissionStatus = 'running') => budgetAct(state, { id: ID, status }, NOW);

describe('a mission run and its token budget (PRD 3040 s3)', () => {
  it('AC-1: changes nothing with no cap set', () => {
    expect(act(read({ missionSpent: 9_000_000, fleetSpent24h: 9_000_000 }))).toEqual({ act: 'none' });
  });

  it('AC-2: records a stop of its own budget and pauses, once what it spent reaches it', () => {
    // 600 input + 300 output + 200 cache writes: 1100 counted, the 5000 cache reads left out by the store's count.
    expect(act(read({ missionSpent: 1100, missionCap: 1000 }))).toEqual({
      act: 'pause',
      stop: { cap: 'mission', capTokens: 1000, spent: 1100 },
      words: "Paused: budget reached · 1.1k of 1k tokens · this mission's budget",
      event: { kind: 'budget-stop', role: 'supervisor', prd: null, job: null, link: null, sentence: "Paused: this mission's budget reached (1k)" },
    });
  });

  it("records a stop of its fleet's daily cap, the fleet's first, naming the last 24 hours", () => {
    expect(act(read({ missionSpent: 5000, missionCap: 1000, fleetSpent24h: 2_400_000, fleetCap: 2_000_000 }), 'waiting')).toMatchObject({
      act: 'pause',
      stop: { cap: 'fleet', capTokens: 2_000_000, spent: 2_400_000 },
      words: "Paused: budget reached · 2.4M of 2M tokens in the last 24 hours · this fleet's daily cap",
      event: { kind: 'budget-stop', sentence: "Paused: this fleet's daily cap reached (2M)" },
    });
  });

  it('AC-8: records no second stop while its stop waits for an answer, and stays paused', () => {
    expect(act(read({ missionSpent: 1100, missionCap: 1000, named: stop() }), 'paused')).toEqual({
      act: 'hold',
      words: "Paused: budget reached · 1.1k of 1k tokens · this mission's budget",
      event: null,
    });
  });

  it('pauses again by the same stop a mission a person resumed by hand while still over its cap', () => {
    const held = act(read({ missionSpent: 1100, missionCap: 1000, named: stop(), personResumedAt: at(-5) }), 'running');
    expect(held).toMatchObject({ act: 'hold', event: { kind: 'paused', role: 'supervisor', sentence: "Paused again: this mission's budget is still reached (1k); its question waits for an answer." } });
  });

  it("holds a mission its fleet's open stop does not name, once a person resumes it over the cap", () => {
    const open = stop({ cap: 'fleet', capTokens: 1000, missions: ['m-2'], createdAt: at(-30) });
    expect(act(read({ fleetSpent24h: 1200, fleetCap: 1000, open }), 'running')).toMatchObject({ act: 'hold', event: { kind: 'paused' } });
  });

  it('AC-5: resumes a mission its budget paused once a person raised the cap, under every cap', () => {
    const raised = stop({ answer: 'raised', raisedTo: 5000, answeredAt: at(-1) });
    expect(act(read({ missionSpent: 1100, missionCap: 5000, named: raised }), 'paused')).toEqual({
      act: 'resume',
      event: { kind: 'resumed', role: 'supervisor', prd: null, job: null, link: null, sentence: "Resumed: this mission's budget was raised to 5k." },
    });
  });

  it('asks again when the raise is still under what was spent', () => {
    const raised = stop({ answer: 'raised', raisedTo: 1050, answeredAt: at(-1) });
    expect(act(read({ missionSpent: 1100, missionCap: 1050, named: raised }), 'paused')).toMatchObject({ act: 'pause', stop: { cap: 'mission', capTokens: 1050, spent: 1100 } });
  });

  it("AC-6: wakes at the time the oldest counted job leaves the fleet's 24 hours, for Resume tomorrow", () => {
    const tomorrow = stop({ cap: 'fleet', answer: 'tomorrow', answeredAt: at(-1) });
    expect(act(read({ fleetSpent24h: 1200, fleetCap: 1000, oldestEnd: '2027-01-25T14:30:00Z', named: tomorrow }), 'paused')).toEqual({
      act: 'wake',
      at: '2027-01-26T14:30:00.000Z',
      words: "Paused: budget reached · this fleet's daily cap · resumes by itself at 14:30 UTC",
      event: null,
    });
  });

  it('resumes by itself once the window freed room, for Resume tomorrow', () => {
    const tomorrow = stop({ cap: 'fleet', answer: 'tomorrow', answeredAt: at(-600) });
    expect(act(read({ fleetSpent24h: 400, fleetCap: 1000, named: tomorrow }), 'paused')).toMatchObject({
      act: 'resume',
      event: { sentence: "Resumed: this fleet's last 24 hours are back under its daily cap (1k)." },
    });
  });

  it('AC-7: ends the mission stopped, saying the budget stopped it', () => {
    const stopped = stop({ answer: 'stopped', answeredAt: at(-1) });
    expect(act(read({ missionSpent: 1100, missionCap: 1000, named: stopped }), 'paused')).toEqual({
      act: 'stop',
      words: "Stopped by the budget: this mission's budget reached (1k), and a person chose Stop the mission.",
      event: { kind: 'stopped', role: 'supervisor', prd: null, job: null, link: null, sentence: "The budget stopped the mission: this mission's budget reached (1k), and a person chose Stop the mission." },
    });
    expect(act(read({ missionSpent: 1100, missionCap: 1000, named: stopped }), 'stopped')).toEqual({ act: 'quiet' });
  });

  it("keeps a person's own Resume of a mission the budget stopped: over a cap, it asks again", () => {
    const stopped = stop({ answer: 'stopped', answeredAt: at(-10) });
    expect(act(read({ missionSpent: 1100, missionCap: 1000, named: stopped, personResumedAt: at(-2) }), 'running')).toMatchObject({ act: 'pause' });
    expect(act(read({ missionSpent: 100, missionCap: 1000, named: stopped, personResumedAt: at(-2) }), 'running')).toEqual({ act: 'none' });
  });

  it("never resumes a mission a person paused, whatever the answer", () => {
    const raised = stop({ answer: 'raised', raisedTo: 5000, answeredAt: at(-1), createdAt: at(-60) });
    expect(act(read({ missionSpent: 1100, missionCap: 5000, named: raised, personPausedAt: at(-30) }), 'paused')).toEqual({ act: 'none' });
    expect(act(read({ missionSpent: 6000, missionCap: 5000, named: raised, personPausedAt: at(-30) }), 'paused')).toEqual({ act: 'quiet' });
  });

  it('records no stop for a mission that is stopped, sending nothing over a cap', () => {
    expect(act(read({ missionSpent: 1100, missionCap: 1000 }), 'stopped')).toEqual({ act: 'quiet' });
    expect(act(read({ missionSpent: 100, missionCap: 1000 }), 'stopped')).toEqual({ act: 'none' });
  });

  it('keeps a mission its budget paused, while its question waits, even once under the cap', () => {
    expect(act(read({ fleetSpent24h: 100, fleetCap: 1000, named: stop({ cap: 'fleet' }), open: stop({ cap: 'fleet' }) }), 'paused')).toEqual({ act: 'quiet' });
  });

  it('resumes a mission the supervisor paused again once the open stop that held it is answered', () => {
    expect(act(read({ fleetSpent24h: 100, fleetCap: 5000, agentPausedAt: at(-20) }), 'paused')).toMatchObject({
      act: 'resume',
      event: { sentence: 'Resumed: no cap is reached any more.' },
    });
  });
});

describe('the tokens, in words', () => {
  it('says what was spent to a tenth of a k or of a million, and a cap without a trailing .0', () => {
    expect([spentWords(950), spentWords(1100), spentWords(412_000), spentWords(1_300_000), spentWords(2_000_000), spentWords(999_700)]).toEqual(['950', '1.1k', '412k', '1.3M', '2.0M', '999.7k']);
    expect([capWords(2_000_000), capWords(1_500_000), capWords(1000), capWords(500)]).toEqual(['2M', '1.5M', '1k', '500']);
  });
});
