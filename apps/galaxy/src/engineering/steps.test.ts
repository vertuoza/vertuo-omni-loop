import { describe, expect, it } from 'vitest';
import { parsePr, parsePrd } from 'omni-loop/kit/lib/ids.ts';
import type { WorkspaceMilestone } from '../timeline/store';
import { timePerStepOf } from './steps';

// The Time per step panel (PRD 2370 s6): the median of each gap over the PRDs done in the window.

const DAY = 24 * 3_600_000;
const T0 = Date.parse('2026-10-01T00:00:00Z');
const NOW = new Date(T0 + 30 * DAY);
const TRACKED = new Set(['acme/app', 'acme/api']);
const at = (days: number) => new Date(T0 + days * DAY).toISOString();

type Milestone = WorkspaceMilestone['milestone'];
type Times = Partial<Record<Milestone, number>>;
function prd(repository: string, number: number, times: Times, lane = repository): WorkspaceMilestone[] {
  return Object.entries(times).map(([milestone, days]) => ({
    repository, prd: parsePrd(number), lane, milestone: milestone as Milestone,
    pr: milestone === 'idea' || milestone === 'plan' || milestone === 'approved' ? null : parsePr(number), reached_at: at(days),
  }));
}
const FULL: Times = { idea: 0, plan: 1, approved: 2, opened: 2, 'first-slice': 3, 'last-slice': 5, ready: 6, merged: 11 };
const panel = (rows: WorkspaceMilestone[], from = 0, to = 20, tracked = TRACKED) =>
  timePerStepOf(rows, tracked, T0 + from * DAY, T0 + to * DAY, NOW);

describe('timePerStepOf', () => {
  it('takes each gap of a done PRD, in order, with who it waits on', () => {
    const p = panel(prd('acme/app', 1, FULL));
    expect(p.done).toBe(1);
    expect(p.steps.map((s) => [s.label, s.median, s.covers])).toEqual([
      ['Writing it', DAY, 1], ['Approval', DAY, 1], ['Starting', DAY, 1], ['Building', 2 * DAY, 1], ['Finishing', DAY, 1], ['Review', 5 * DAY, 1],
    ]);
    expect(p.steps.map((s) => s.waitsOn)).toEqual(['PM + brainstorm', 'approver', 'agents', 'agents', 'agents + outbox', 'reviewer']);
  });

  it('names the slowest step by its median', () => {
    expect(panel(prd('acme/app', 1, FULL)).slowest).toEqual({ label: 'Review', median: 5 * DAY });
  });

  it('takes the median over the PRDs done in the window, and says how many it covers', () => {
    const rows = [
      ...prd('acme/app', 1, FULL),
      ...prd('acme/app', 2, { ...FULL, merged: 7 }),
      ...prd('acme/app', 3, { ...FULL, merged: 17 }),
    ];
    expect(panel(rows).steps.find((s) => s.id === 'review')).toMatchObject({ median: 5 * DAY, covers: 3 });
  });

  it('counts one value per lane for a lane gap, the PRD-level gaps once', () => {
    const lane = { opened: 2, 'first-slice': 3, 'last-slice': 4, ready: 5 };
    const rows = [
      ...prd('acme/plan', 7, { idea: 0, plan: 1, approved: 2 }),
      ...prd('acme/plan', 7, { ...lane, merged: 6 }, 'acme/app'),
      ...prd('acme/plan', 7, { ...lane, merged: 9 }, 'acme/api'),
    ];
    const p = panel(rows, 0, 20, new Set(['acme/plan']));
    expect(p.done).toBe(1);
    expect(p.steps.find((s) => s.id === 'writing')?.covers).toBe(1);
    expect(p.steps.find((s) => s.id === 'review')).toMatchObject({ covers: 2, median: 2.5 * DAY });
  });

  it('leaves out a PRD not done in the window, one still running and one of an untracked repository', () => {
    const running = { ...FULL };
    delete running.merged;
    const rows = [...prd('acme/app', 1, FULL), ...prd('acme/app', 2, running), ...prd('other/repo', 3, FULL)];
    expect(panel(rows, 12, 20).done).toBe(0);
    expect(panel(rows, 0, 20).done).toBe(1);
  });

  it('reads a gap no PRD dated as no value, never zero', () => {
    const noIdea = { ...FULL };
    delete noIdea.idea;
    const p = panel(prd('acme/app', 1, noIdea));
    expect(p.steps.find((s) => s.id === 'writing')).toMatchObject({ median: null, covers: 0 });
    expect(p.slowest?.label).toBe('Review');
  });

  it('with no PRD done: nothing to show, no steps, no slowest step', () => {
    expect(panel([])).toEqual({ done: 0, steps: [], slowest: null });
  });
});
