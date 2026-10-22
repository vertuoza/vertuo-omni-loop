import { describe, expect, it } from 'vitest';
import { timeline, GAPS, GAP_WAITS_ON, type Milestone } from './timeline';
import type { MilestoneId } from './store';
import { parsePr } from 'omni-loop/kit/lib/ids.ts';

// A PRD's timeline (PRD 2370): the six gaps from recorded milestones and a fixed `now`.

const DAY = 24 * 60 * 60 * 1000;
const T0 = Date.parse('2026-10-01T00:00:00Z');
const at = (days: number) => new Date(T0 + days * DAY).toISOString();
const ms = (lane: string, milestone: MilestoneId, days: number, pr: number | null = null): Milestone =>
  ({ lane, milestone, reachedAt: at(days), pr: pr === null ? null : parsePr(pr) });
const REPO = 'acme/app';
const oneLane = (): Milestone[] => [
  ms(REPO, 'idea', 0), ms(REPO, 'plan', 1), ms(REPO, 'approved', 3),
  ms(REPO, 'opened', 2, 10), ms(REPO, 'first-slice', 4, 11), ms(REPO, 'last-slice', 6, 12),
  ms(REPO, 'ready', 7, 10), ms(REPO, 'merged', 12, 10),
];
const days = (g: { ms: number | null }) => (g.ms === null ? null : g.ms / DAY);
const NOW = T0 + 20 * DAY;

describe('the gaps of a one-lane PRD', () => {
  it('are the six of the spec, with their durations and who they wait on', () => {
    const t = timeline(oneLane(), NOW);
    const all = [...t.gaps, ...t.lanes[0]?.gaps ?? []];
    expect(all.map((g) => g.id)).toEqual([...GAPS]);
    expect(all.map(days)).toEqual([1, 2, 1, 2, 1, 5]);
    expect(all.map((g) => g.waitsOn)).toEqual(GAPS.map((g) => GAP_WAITS_ON[g]));
    expect(all.map((g) => g.waitsOn)).toEqual(['PM + brainstorm', 'approver', 'agents', 'agents', 'agents + outbox', 'reviewer']);
    expect(all.every((g) => g.state === 'done')).toBe(true);
  });

  it('starts Starting at the later of approved and opened', () => {
    const t = timeline(oneLane(), NOW);
    expect(t.lanes[0]?.gaps[0]).toMatchObject({ from: 'approved', start: at(3), ms: DAY });
    const late = oneLane().map((m) => (m.milestone === 'opened' ? ms(REPO, 'opened', 3.5, 10) : m));
    expect(timeline(late, NOW).lanes[0]?.gaps[0]).toMatchObject({ from: 'opened', ms: 0.5 * DAY });
  });

  it('totals from the first milestone to the merge, and names the longest gap', () => {
    const t = timeline(oneLane(), NOW);
    expect(t.total).toEqual({ ms: 12 * DAY, running: false });
    expect(t.longest).toMatchObject({ id: 'review', lane: REPO });
    expect(t.now).toBeNull();
  });
});

describe('a running gap and a gap not recorded', () => {
  it('counts a gap with a start and no end up to now', () => {
    const t = timeline(oneLane().filter((m) => m.milestone !== 'merged'), NOW);
    expect(t.lanes[0]?.gaps[3]).toMatchObject({ id: 'review', state: 'running', end: null, ms: 13 * DAY });
    expect(t.total).toEqual({ ms: 20 * DAY, running: true });
    expect(t.now).toMatchObject({ id: 'review' });
    expect(t.longest).toMatchObject({ id: 'review', ms: 13 * DAY });
  });

  it('reads a gap with no start as not recorded, never zero', () => {
    const t = timeline(oneLane().filter((m) => m.milestone !== 'plan' && m.milestone !== 'ready'), NOW);
    expect(t.gaps[0]).toMatchObject({ id: 'writing', state: 'not-recorded', ms: null });
    expect(t.gaps[1]).toMatchObject({ id: 'approval', state: 'not-recorded', ms: null });
    const lane = t.lanes[0]?.gaps ?? [];
    expect(lane[2]).toMatchObject({ id: 'finishing', state: 'not-recorded', ms: null, start: at(6) });
    expect(lane[3]).toMatchObject({ id: 'review', state: 'not-recorded', ms: null, start: null });
    expect(t.longest?.id).toBe('building');
  });

  it('has no total and no longest gap with nothing recorded', () => {
    const t = timeline([], NOW);
    expect(t).toMatchObject({ lanes: [], total: null, longest: null, now: null });
    expect(t.gaps.every((g) => g.state === 'not-recorded')).toBe(true);
  });

  it('ignores a time it cannot read', () => {
    const t = timeline([{ lane: REPO, milestone: 'idea', reachedAt: 'soon', pr: null }], NOW);
    expect(t.total).toBeNull();
  });
});

describe('a rework slice after ready', () => {
  it('lengthens Building, not Finishing', () => {
    const rework = oneLane().map((m) => (m.milestone === 'last-slice' ? ms(REPO, 'last-slice', 9, 13) : m));
    const gaps = timeline(rework, NOW).lanes[0]?.gaps ?? [];
    expect(gaps.map(days)).toEqual([1, 5, 0, 5]);
    expect(gaps[1]).toMatchObject({ id: 'building' });
  });

  it('keeps the first time of a milestone but the latest of last-slice', () => {
    const rows = [...oneLane(), ms(REPO, 'first-slice', 5), ms(REPO, 'last-slice', 5.5)];
    const gaps = timeline(rows, NOW).lanes[0]?.gaps ?? [];
    expect(gaps[1]).toMatchObject({ start: at(4), end: at(6) });
  });
});

describe('a PRD of three lanes', () => {
  const lane = (repo: string, shift: number): Milestone[] => [
    ms(repo, 'opened', 2 + shift, 1), ms(repo, 'first-slice', 4 + shift), ms(repo, 'last-slice', 6 + shift),
    ms(repo, 'ready', 7 + shift), ms(repo, 'merged', 8 + shift),
  ];
  const prd = [ms('acme/plan', 'idea', 0), ms('acme/plan', 'plan', 1), ms('acme/plan', 'approved', 2)];

  it('has its PRD-level gaps once and its lane gaps per lane, in lane order', () => {
    const t = timeline([...prd, ...lane('acme/web', 4), ...lane('acme/api', 0), ...lane('acme/app', 2)], NOW);
    expect(t.gaps.map((g) => g.id)).toEqual(['writing', 'approval']);
    expect(t.lanes.map((l) => l.lane)).toEqual(['acme/api', 'acme/app', 'acme/web']);
    expect(t.lanes.every((l) => l.gaps.length === 4 && l.gaps.every((g) => g.lane === l.lane))).toBe(true);
    expect(t.total).toEqual({ ms: 12 * DAY, running: false });
  });

  it('runs until the last lane merges', () => {
    const rows = [...prd, ...lane('acme/api', 0), ...lane('acme/web', 4).filter((m) => m.milestone !== 'merged')];
    const t = timeline(rows, NOW);
    expect(t.total).toEqual({ ms: 20 * DAY, running: true });
    expect(t.now).toMatchObject({ id: 'review', lane: 'acme/web' });
  });
});
