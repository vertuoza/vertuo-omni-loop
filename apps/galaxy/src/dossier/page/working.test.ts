import { describe, expect, it, vi } from 'vitest';
import type { DossierRoundRow } from '../store';
import { questionsHref, readWorking, workingOf } from './working';

// The dossier page's live poll carries `working` (PRD 757, s4): each tick reads the freshest heartbeat
// of the dossier's sessions and its open rounds, and the one rule (workingState) says working, asking
// or idle. A read that fails never breaks the poll: the page reads idle, or asking when rounds may be open.

const NOW = Date.parse('2026-09-30T10:00:00Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const ping = (seenMsAgo: number, ended: string | null = null) => ({ seen_at: ago(seenMsAgo), ended_at: ended });
const round = (status: DossierRoundRow['status']) => ({ status }) as DossierRoundRow;
const pulse = (asked: number, answered: number) => ({ asked, answered, latest: {} });

describe('workingOf: the dossier page\'s working state', () => {
  it('is working while a heartbeat came under 3 minutes ago and nothing is open', async () => {
    const rounds = vi.fn();
    expect(await workingOf({ pulse: pulse(2, 2), ping: async () => ping(30_000), rounds, now: NOW })).toBe('working');
    expect(rounds).not.toHaveBeenCalled();
  });

  it('is idle once the heartbeat is 3 minutes old, or its session ended', async () => {
    expect(await workingOf({ pulse: pulse(0, 0), ping: async () => ping(180_000), rounds: async () => [], now: NOW })).toBe('idle');
    expect(await workingOf({ pulse: pulse(0, 0), ping: async () => ping(10_000, ago(5_000)), rounds: async () => [], now: NOW })).toBe('idle');
  });

  it('is asking over working when a round is open', async () => {
    const rounds = async () => [round('answered'), round('open')];
    expect(await workingOf({ pulse: pulse(2, 1), ping: async () => ping(30_000), rounds, now: NOW })).toBe('asking');
  });

  it('counts only open rounds: an abandoned one leaves the page working', async () => {
    const rounds = async () => [round('answered'), round('abandoned')];
    expect(await workingOf({ pulse: pulse(2, 1), ping: async () => ping(30_000), rounds, now: NOW })).toBe('working');
  });

  it('is idle when the heartbeat cannot be read, or the dossier is gone', async () => {
    const failing = async () => { throw new Error('down'); };
    expect(await workingOf({ pulse: pulse(0, 0), ping: failing, rounds: async () => [], now: NOW })).toBe('idle');
    expect(await workingOf({ pulse: null, ping: async () => ping(1_000), rounds: async () => [], now: NOW })).toBe('idle');
  });

  it('reads the unanswered rounds as open when the rounds cannot be read', async () => {
    const failing = async () => { throw new Error('down'); };
    expect(await workingOf({ pulse: pulse(3, 2), ping: async () => ping(1_000), rounds: failing, now: NOW })).toBe('asking');
  });
});

describe('readWorking: the real reads', () => {
  it('reads the dossier\'s freshest live heartbeat and, only when a round may be open, its rounds', async () => {
    const calls: string[] = [];
    const query = {
      select: () => query, eq: (col: string, v: string) => { calls.push(`eq ${col}=${v}`); return query; },
      is: (col: string) => { calls.push(`is ${col}`); return query; }, order: () => query,
      limit: async () => ({ data: [ping(5_000)], error: null }),
    };
    const db = {
      from: (table: string) => { calls.push(`from ${table}`); return query; },
      rpc: async (fn: string) => { calls.push(`rpc ${fn}`); return { data: [round('open')], error: null }; },
    };
    expect(await readWorking(db as never, 'd1', pulse(1, 1), NOW)).toBe('working');
    expect(calls).toEqual(['from working_pings', 'eq dossier_id=d1', 'is ended_at']);
    expect(await readWorking(db as never, 'd1', pulse(2, 1), NOW)).toBe('asking');
    expect(calls).toContain('rpc dossier_rounds');
  });
});

describe('questionsHref', () => {
  it('leads to the Questions tab on the dossier\'s own route', () => {
    expect(questionsHref('abc', 'prd')).toBe('/prd/abc?tab=questions');
    expect(questionsHref('abc', 'visual')).toBe('/visual/abc?tab=questions');
    expect(questionsHref('abc', 'bug')).toBe('/bugs/abc?tab=questions');
  });
});
