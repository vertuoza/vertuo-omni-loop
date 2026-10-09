import { describe, expect, it } from 'vitest';
import { parsePrd, parseWorkSliceId } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { planLoop } from 'vertuo-omni-plan/kit/lib/next/plan.ts';
import { clockOf, ledgerOf, readPlan, stateLineOf, timelineOf } from './view';

// The Loop page's reads of a loop (PRD 1139 s5), pure: the plan the kit pushed, read into steps; the
// steps laid out as one timeline row per PRD, collisions marked; the ledger with every replan between
// its ticks; and the line naming a loop's state.

const NOW = Date.parse('2026-10-07T14:25:00Z');

// The shape `omni next --plan` writes (kit/lib/next/plan.ts' Step).
const step = (n: number, prd: number, kind: string, over: Record<string, unknown> = {}) => ({ step: n, prd, kind, wave: null, slices: [], after: [], waitsFor: [], why: [], beside: [], ...over });
const NAV = '1017 s2 after 1030 s3: both touch apps/galaxy/src/nav/';
const PLAN = {
  version: 1,
  reason: null,
  steps: [
    step(1, 1030, 'wave', { wave: 1, slices: ['s1'] }),
    step(2, 971, 'finish', { beside: [1] }),
    step(3, 1030, 'wave', { wave: 2, slices: ['s3'], after: [1] }),
    step(4, 1017, 'wave', { wave: 1, slices: ['s2'], after: [3], why: [NAV] }),
  ],
};

describe('readPlan', () => {
  it('reads each step as the kit writes it: its number, PRD, kind, wave, slices, what it runs beside, and why it waits', () => {
    const read = readPlan(PLAN);
    expect(read.kind).toBe('steps');
    if (read.kind !== 'steps') return;
    expect(read.steps.map((s) => [s.step, s.prd, s.kind, s.slices, s.wave, s.beside])).toEqual([
      [1, 1030, 'wave', ['s1'], 1, false], [2, 971, 'finish', [], null, true], [3, 1030, 'wave', ['s3'], 2, false], [4, 1017, 'wave', ['s2'], 1, false],
    ]);
    expect(read.steps[3]?.collision).toBe(NAV);
    expect(read.steps[0]?.collision).toBeNull();
  });

  it('puts the steps in their order, whatever order they came in', () => {
    const read = readPlan({ steps: [...PLAN.steps].reverse() });
    expect(read.kind === 'steps' && read.steps.map((s) => s.step)).toEqual([1, 2, 3, 4]);
  });

  it('reads a plan with no steps as empty, and one it cannot read as unreadable, never as a guess', () => {
    expect(readPlan({ steps: [] })).toEqual({ kind: 'steps', steps: [] });
    const bad = [
      {}, { steps: 'x' }, { steps: [{ step: 1 }] }, { steps: [step(0, 5, 'wave')] }, { steps: [step(1, -1, 'wave')] },
      { steps: [step(1, 5, 'wave', { slices: ['nope'] })] },
      { steps: [step(1, 5, 'wave', { after: { prd: 1030, reason: 'the old shape' } })] },
    ];
    for (const plan of bad) {
      expect(readPlan(plan), JSON.stringify(plan)).toEqual({ kind: 'unreadable' });
    }
  });
});

describe('readPlan on the kit\'s own plan', () => {
  it('reads what `omni next --plan` writes: two PRDs on the same ground, the later one marked with the kit\'s reason', () => {
    const slice = (id: string, territory: string[], wave: number) => ({ id: parseWorkSliceId(id), territory, wave, state: 'runnable' as const });
    const kit = planLoop({
      prds: [
        { prd: parsePrd(1030), blockedBy: [], slices: [slice('s3', ['apps/galaxy/src/nav/'], 1)], ended: null },
        { prd: parsePrd(1017), blockedBy: [], slices: [slice('s2', ['apps/galaxy/src/nav/'], 1)], ended: null },
      ],
      shipped: [],
    });
    const read = readPlan(structuredClone(kit));
    expect(read.kind).toBe('steps');
    if (read.kind !== 'steps') return;
    expect(read.steps.map((s) => s.step)).toEqual(kit.steps.map((s) => s.step));
    const marked = read.steps.filter((s) => s.collision !== null);
    expect(marked.length).toBeGreaterThan(0);
    expect(marked[0]?.collision).toContain('both touch apps/galaxy/src/nav/');
  });
});

describe('timelineOf', () => {
  const read = readPlan(PLAN);
  const steps = read.kind === 'steps' ? read.steps : [];

  it('gives one row per PRD, in the order each first appears, each step at its place on the plan', () => {
    const rows = timelineOf(steps, null);
    expect(rows.map((r) => [r.prd, r.cells.map((c) => c.step)])).toEqual([[1030, [1, 3]], [971, [2]], [1017, [4]]]);
  });

  it('labels each step by its slices, else its kind, and marks the collision with its reason', () => {
    const cells = timelineOf(steps, null).flatMap((r) => r.cells);
    expect(cells.map((c) => c.label)).toEqual(['s1', 's3', 'finish', 's2']);
    expect(cells.find((c) => c.step === 4)?.collision).toBe(NAV);
    expect(cells.filter((c) => c.collision !== null)).toHaveLength(1);
  });

  it('marks the steps before the current one done and the current one current; with no tick, none', () => {
    const at3 = timelineOf(steps, 3).flatMap((r) => r.cells).sort((a, b) => a.step - b.step);
    expect(at3.map((c) => [c.step, c.done, c.current])).toEqual([[1, true, false], [2, true, false], [3, false, true], [4, false, false]]);
    expect(timelineOf(steps, null).flatMap((r) => r.cells).some((c) => c.done || c.current)).toBe(false);
  });
});

describe('stateLineOf', () => {
  const loop = (over: Partial<{ state: 'running' | 'parked' | 'stopped'; seen_at: string; last_tick_at: string | null; next_wake_at: string | null }>) =>
    ({ state: 'running' as const, seen_at: '2026-10-07T14:20:00Z', last_tick_at: '2026-10-07T14:20:00Z', next_wake_at: null, ...over });

  it('names each state, a sleeping loop with its wake and a silent one with how long it has been quiet', () => {
    expect(stateLineOf(loop({ next_wake_at: '2026-10-07T14:32:00Z' }), NOW)).toEqual({ state: 'sleeping', line: 'sleeping · wakes 14:32 UTC' });
    expect(stateLineOf(loop({ next_wake_at: '2026-10-07T14:24:00Z' }), NOW)).toEqual({ state: 'live', line: 'live' });
    expect(stateLineOf(loop({ state: 'parked' }), NOW)).toEqual({ state: 'parked', line: 'parked' });
    expect(stateLineOf(loop({ state: 'stopped' }), NOW)).toEqual({ state: 'stopped', line: 'stopped' });
    expect(stateLineOf(loop({ last_tick_at: '2026-10-07T13:48:00Z', next_wake_at: '2026-10-07T13:50:00Z' }), NOW))
      .toEqual({ state: 'silent', line: 'silent · no tick for 37 min' });
  });

  it('counts a silent loop that never ticked from its last push', () => {
    expect(stateLineOf(loop({ last_tick_at: null, seen_at: '2026-10-07T12:25:00Z' }), NOW)).toEqual({ state: 'silent', line: 'silent · no tick for 120 min' });
  });
});

describe('ledgerOf', () => {
  const tick = (id: number, at: string, step: number) => ({
    id, loop_id: 'l', at, step, steps: 4, prd: parsePrd(1030), action: 'wave', result: '3 sub-PRs', link: null, merged: [], items: [], next_wake_at: null,
  });
  const plan = (version: number, at: string, reason: string) => ({ loop_id: 'l', version, reason, plan: {}, created_at: at });

  it('lists the ticks and every replan after the first plan, the newest first', () => {
    const lines = ledgerOf([tick(1, '2026-10-07T14:02:00Z', 1), tick(2, '2026-10-07T14:21:00Z', 2)], [plan(1, '2026-10-07T14:00:00Z', 'first plan'), plan(2, '2026-10-07T14:20:00Z', 's4 of 1030 stuck')], 'acme/widgets');
    expect(lines.map((l) => [l.kind, l.at])).toEqual([['tick', '14:21 UTC'], ['replan', '14:20 UTC'], ['tick', '14:02 UTC']]);
    const replan = lines[1];
    expect(replan?.kind === 'replan' && [replan.version, replan.reason]).toEqual([2, 's4 of 1030 stuck']);
    const first = lines[0];
    expect(first?.kind === 'tick' && [first.step, first.steps, first.prd, first.href]).toEqual([2, 4, 1030, '/prd/at/acme/widgets/1030?to=page']);
  });

  it('carries the repositories each tick\'s step touched (PRD 1162), none when the tick did not say', () => {
    const lines = ledgerOf([{ ...tick(1, '2026-10-07T14:02:00Z', 1), repos: ['crew', 'ai-domain'] }, tick(2, '2026-10-07T14:21:00Z', 2)], [], 'acme/widgets');
    expect(lines.map((l) => (l.kind === 'tick' ? l.repos : null))).toEqual([[], ['crew', 'ai-domain']]);
  });
});

describe('clockOf', () => {
  it('reads an instant as its UTC hour and minute, and an unreadable one as —', () => {
    expect(clockOf('2026-10-07T09:05:59Z')).toBe('09:05 UTC');
    expect(clockOf('2026-10-07T16:05:00+02:00')).toBe('14:05 UTC');
    expect(clockOf('nope')).toBe('—');
  });
});
