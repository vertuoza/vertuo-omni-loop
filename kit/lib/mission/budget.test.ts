// A mission's token budget (PRD 3040 s1): what a job's tokens count for, and what a mission run does about its two caps.
import { describe, expect, it } from 'vitest';
import { BUDGET_WINDOW_MS, budgetNext, spent } from './budget.ts';
import type { BudgetState } from './budget.ts';

describe('spent: what a job counts toward a cap', () => {
  it('adds input, output and cache writes, and leaves cache reads out', () => {
    expect(spent({ input: 600, output: 300, cacheRead: 5000, cacheWrite: 200 })).toBe(1100);
    expect(spent({ input: 1, output: 0, cacheRead: 0, cacheWrite: 0 })).toBe(1);
    expect(spent({ input: 0, output: 1, cacheRead: 0, cacheWrite: 0 })).toBe(1);
    expect(spent({ input: 0, output: 0, cacheRead: 0, cacheWrite: 1 })).toBe(1);
    expect(spent({ input: 0, output: 0, cacheRead: 9, cacheWrite: 0 })).toBe(0);
  });

  it('gives 0 for a job with no tokens kept', () => {
    expect(spent(null)).toBe(0);
    expect(spent(undefined)).toBe(0);
  });
});

const NOW = Date.parse('2027-01-26T10:00:00Z');
const at = (state: Partial<BudgetState>): BudgetState => ({
  missionSpent: 0, missionCap: null, fleetSpent24h: 0, fleetCap: null, stop: null, answer: null, now: NOW, oldestEnd: null, ...state,
});

describe('budgetNext: what a mission run does about its caps', () => {
  it('sends with no cap set, however much was spent (AC-1)', () => {
    expect(budgetNext(at({ missionSpent: 9_000_000, fleetSpent24h: 9_000_000 }))).toEqual({ next: 'send' });
  });

  it('sends under every cap', () => {
    expect(budgetNext(at({ missionSpent: 999, missionCap: 1000, fleetSpent24h: 1999, fleetCap: 2000 }))).toEqual({ next: 'send' });
  });

  it("pauses a mission that reached its own budget, naming the mission's cap (AC-2)", () => {
    expect(budgetNext(at({ missionSpent: 1100, missionCap: 1000 }))).toEqual({ next: 'pause', cap: 'mission', limit: 1000, spent: 1100 });
    expect(budgetNext(at({ missionSpent: 1000, missionCap: 1000 }))).toEqual({ next: 'pause', cap: 'mission', limit: 1000, spent: 1000 });
  });

  it("pauses a mission whose fleet reached its daily cap, naming the fleet's cap (AC-3)", () => {
    expect(budgetNext(at({ fleetSpent24h: 1200, fleetCap: 1000 }))).toEqual({ next: 'pause', cap: 'fleet', limit: 1000, spent: 1200 });
    expect(budgetNext(at({ fleetSpent24h: 1000, fleetCap: 1000 }))).toEqual({ next: 'pause', cap: 'fleet', limit: 1000, spent: 1000 });
  });

  it("names the fleet's cap when both are reached: its one stop holds every mission of the fleet", () => {
    expect(budgetNext(at({ missionSpent: 1100, missionCap: 1000, fleetSpent24h: 5000, fleetCap: 2000 })))
      .toEqual({ next: 'pause', cap: 'fleet', limit: 2000, spent: 5000 });
  });

  it('records nothing new while its stop waits for an answer and the cap is still reached (AC-8)', () => {
    expect(budgetNext(at({ missionSpent: 1100, missionCap: 1000, stop: 'mission' }))).toEqual({ next: 'hold', cap: 'mission' });
    expect(budgetNext(at({ fleetSpent24h: 1200, fleetCap: 1000, stop: 'fleet' }))).toEqual({ next: 'hold', cap: 'fleet' });
  });

  it('holds on its open stop even when the other cap is reached too', () => {
    expect(budgetNext(at({ missionSpent: 1100, missionCap: 1000, fleetSpent24h: 1200, fleetCap: 1000, stop: 'mission' })))
      .toEqual({ next: 'hold', cap: 'mission' });
  });

  it('pauses by the other cap when its open stop no longer holds but the other cap is reached', () => {
    expect(budgetNext(at({ missionSpent: 1100, missionCap: 1000, fleetSpent24h: 10, fleetCap: 1000, stop: 'fleet' })))
      .toEqual({ next: 'pause', cap: 'mission', limit: 1000, spent: 1100 });
  });

  it('sends once every cap has room again, even with its stop unanswered (a pushed brief raised the budget)', () => {
    expect(budgetNext(at({ missionSpent: 1100, missionCap: 5000, stop: 'mission' }))).toEqual({ next: 'send' });
    expect(budgetNext(at({ missionSpent: 1100, stop: 'mission' }))).toEqual({ next: 'send' });
  });

  it('sends after a raise that leaves room under every cap (AC-5)', () => {
    expect(budgetNext(at({ missionSpent: 1100, missionCap: 5000, stop: 'mission', answer: 'raised' }))).toEqual({ next: 'send' });
  });

  it('pauses again, asking anew, after a raise that left no room', () => {
    expect(budgetNext(at({ missionSpent: 1100, missionCap: 1050, stop: 'mission', answer: 'raised' })))
      .toEqual({ next: 'pause', cap: 'mission', limit: 1050, spent: 1100 });
  });

  it('ends the mission once its stop is answered stopped (AC-7), whatever was spent', () => {
    expect(budgetNext(at({ missionSpent: 1100, missionCap: 1000, stop: 'mission', answer: 'stopped' }))).toEqual({ next: 'stop', cap: 'mission' });
    expect(budgetNext(at({ fleetSpent24h: 10, fleetCap: 1000, stop: 'fleet', answer: 'stopped' }))).toEqual({ next: 'stop', cap: 'fleet' });
  });

  describe('resume tomorrow (AC-6)', () => {
    const tomorrow = (state: Partial<BudgetState>) => budgetNext(at({ fleetCap: 1000, stop: 'fleet', answer: 'tomorrow', ...state }));

    it('wakes when the oldest counted job leaves the 24 hours', () => {
      expect(BUDGET_WINDOW_MS).toBe(24 * 60 * 60 * 1000);
      expect(tomorrow({ fleetSpent24h: 1200, oldestEnd: '2027-01-25T14:30:00Z' })).toEqual({ next: 'wake-at', at: '2027-01-26T14:30:00.000Z' });
    });

    it('wakes no sooner than now', () => {
      expect(tomorrow({ fleetSpent24h: 1200, oldestEnd: '2027-01-25T09:00:00Z' })).toEqual({ next: 'wake-at', at: '2027-01-26T10:00:00.000Z' });
    });

    it('waits a whole window when no counted job is known', () => {
      expect(tomorrow({ fleetSpent24h: 1200, oldestEnd: null })).toEqual({ next: 'wake-at', at: '2027-01-27T10:00:00.000Z' });
      expect(tomorrow({ fleetSpent24h: 1200, oldestEnd: 'not a time' })).toEqual({ next: 'wake-at', at: '2027-01-27T10:00:00.000Z' });
    });

    it('sends once the window is back under the cap', () => {
      expect(tomorrow({ fleetSpent24h: 999, oldestEnd: '2027-01-25T14:30:00Z' })).toEqual({ next: 'send' });
      expect(tomorrow({ fleetSpent24h: 1200, fleetCap: null })).toEqual({ next: 'send' });
    });

    it("pauses by the mission's own budget once the fleet has room but the mission has none", () => {
      expect(tomorrow({ fleetSpent24h: 10, missionSpent: 1100, missionCap: 1000 })).toEqual({ next: 'pause', cap: 'mission', limit: 1000, spent: 1100 });
    });
  });
});
