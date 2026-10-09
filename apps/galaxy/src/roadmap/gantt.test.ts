import { describe, expect, it } from 'vitest';
import { parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { ganttOf, type GanttPrd, type GanttRow } from './gantt';
import { readAt } from '../dossier/page/history-at';
import { sure } from '../arcade/test/sure';

// A roadmap's Gantt (PRD 1162, "Roadmaps in Omni"), laid out pure: one row per PRD grouped by wave,
// one arrow per blocker, real dates once a PRD started, a dashed projection from the median length of
// the roadmap's merged PRDs, wave columns without dates before any merged, one lane per repository in
// a plan repository, and the pull request a held PRD waits on, on its bar.

const DAY = 86_400_000;
const NOW = Date.parse('2026-10-20T12:00:00Z');
const REPO = 'acme/widgets';
const day = (n: number) => new Date(NOW + n * DAY).toISOString();

const prd = (over: Partial<GanttPrd> & Pick<GanttPrd, 'row_id' | 'wave'>): GanttPrd => ({
  prd: parsePrd(1200 + Number(over.row_id.replace(/\D/g, ''))), title: `PRD ${over.row_id}`, repos: [], blockers: [], state: 'waiting',
  waits_on: null, waits_on_url: null, started_at: null, ended_at: null, ...over,
});

const rowOf = (rows: readonly GanttRow[], id: string) => sure(rows.find((r) => r.id === id), id);

describe('ganttOf: rows and arrows', () => {
  const prds = [
    prd({ row_id: 'P3', wave: 2, blockers: ['P1', 'P2'] }),
    prd({ row_id: 'P1', wave: 1 }),
    prd({ row_id: 'P4', wave: 3, blockers: ['P3'] }),
    prd({ row_id: 'P2', wave: 1 }),
  ];

  it('groups the rows by wave, each wave in the table\'s order, and numbers them top to bottom', () => {
    const gantt = ganttOf(prds, NOW, REPO);
    expect(gantt.groups.map((g) => [g.wave, g.rows.map((r) => r.id)])).toEqual([[1, ['P1', 'P2']], [2, ['P3']], [3, ['P4']]]);
    expect(gantt.rows.map((r) => [r.id, r.index])).toEqual([['P1', 0], ['P2', 1], ['P3', 2], ['P4', 3]]);
  });

  it('draws one arrow per blocker, from the blocker\'s row to the blocked one, and none for a blocker that is no row', () => {
    const gantt = ganttOf([...prds, prd({ row_id: 'P5', wave: 2, blockers: ['P9'] })], NOW, REPO);
    expect(gantt.arrows.map((a) => [a.from, a.to])).toEqual([['P1', 'P3'], ['P2', 'P3'], ['P3', 'P4']]);
    const arrow = sure(gantt.arrows[0], 'the first arrow');
    expect([arrow.fromRow, arrow.toRow]).toEqual([0, 2]);
  });

  it('links each row to its PRD\'s page, by the roadmap\'s repository and the PRD\'s number (#1199)', () => {
    // /prd/<n> is Not found: /prd/<id> opens a dossier by its id, which the roadmap does not hold.
    const href = rowOf(ganttOf(prds, NOW, 'vertuoza/vertuo-vibe-master-plan').rows, 'P1').href;
    expect(href).toBe('/prd/at/vertuoza/vertuo-vibe-master-plan/1201?to=page');
    const [owner = '', repo = '', n = ''] = new URL(href, 'https://omni.test').pathname.split('/').slice(3);
    expect(readAt({ owner, repo, n })).toEqual({ owner: 'vertuoza', repo: 'vertuo-vibe-master-plan', prd: parsePrd(1201) });
  });

  it('draws nothing for a roadmap with no PRD', () => {
    expect(ganttOf([], NOW, REPO)).toMatchObject({ dated: false, rows: [], groups: [], arrows: [], columns: [] });
  });
});

describe('ganttOf: before any PRD merged', () => {
  it('sits each bar in its wave\'s column, without dates, even once a PRD started', () => {
    const gantt = ganttOf([prd({ row_id: 'P1', wave: 1, state: 'building', started_at: day(-3) }), prd({ row_id: 'P2', wave: 2, blockers: ['P1'] })], NOW, REPO);
    expect(gantt.dated).toBe(false);
    expect(gantt.median).toBeNull();
    expect(gantt.columns.map((c) => c.label)).toEqual(['wave 1', 'wave 2']);
    expect(rowOf(gantt.rows, 'P1').segments).toEqual([{ kind: 'wave', from: 0, to: 0.5 }]);
    expect(rowOf(gantt.rows, 'P2').segments).toEqual([{ kind: 'wave', from: 0.5, to: 1 }]);
  });
});

describe('ganttOf: once a PRD merged', () => {
  // P1 merged in 4 days, P2 in 6: the median is 5 days.
  const prds = [
    prd({ row_id: 'P1', wave: 1, state: 'merged', started_at: day(-10), ended_at: day(-6) }),
    prd({ row_id: 'P2', wave: 1, state: 'merged', started_at: day(-10), ended_at: day(-4) }),
    prd({ row_id: 'P3', wave: 2, blockers: ['P1'], state: 'building', started_at: day(-2) }),
    prd({ row_id: 'P4', wave: 3, blockers: ['P3'] }),
  ];
  const gantt = ganttOf(prds, NOW, REPO);
  const span = 18 * DAY; // day -10 to day +8: P4 projected from P3's end, day +3, for 5 days
  const x = (n: number) => (n + 10) * DAY / span;

  it('takes the median length of the merged PRDs, and draws on dates', () => {
    expect(gantt.dated).toBe(true);
    expect(gantt.median).toBe(5 * DAY);
  });

  it('draws a merged PRD solid, from its start to its end', () => {
    expect(rowOf(gantt.rows, 'P1').segments).toEqual([{ kind: 'real', from: x(-10), to: x(-6) }]);
  });

  it('draws a started PRD solid up to now, then dashed to its start plus the median', () => {
    const segments = rowOf(gantt.rows, 'P3').segments;
    expect(segments).toHaveLength(2);
    expect(segments[0]).toEqual({ kind: 'real', from: x(-2), to: x(0) });
    expect(segments[1]?.kind).toBe('projected');
    expect(segments[1]?.from).toBeCloseTo(x(0));
    expect(segments[1]?.to).toBeCloseTo(x(3));
  });

  it('projects a PRD not started after its blockers\' projected end, for the median', () => {
    const [only] = rowOf(gantt.rows, 'P4').segments;
    expect(only?.kind).toBe('projected');
    expect(only?.from).toBeCloseTo(x(3));
    expect(only?.to).toBeCloseTo(1);
  });

  it('projects a PRD with no blocker from now', () => {
    const [only] = rowOf(ganttOf([...prds, prd({ row_id: 'P5', wave: 1 })], NOW, REPO).rows, 'P5').segments;
    expect(only?.kind).toBe('projected');
    expect(only?.from).toBeCloseTo(x(0));
  });

  it('starts an arrow at its blocker\'s last segment\'s end and ends it at the blocked row\'s first segment\'s start', () => {
    const arrow = sure(gantt.arrows.find((a) => a.from === 'P1'), 'P1 → P3');
    expect(arrow.x1).toBeCloseTo(x(-6));
    expect(arrow.x2).toBeCloseTo(x(-2));
  });

  it('labels the axis with dates', () => {
    expect(gantt.columns[0]?.label).toBe('Oct 10');
    expect(gantt.columns.length).toBeGreaterThan(1);
  });
});

describe('ganttOf: lanes and the waiting pull request', () => {
  it('splits each bar into one lane per repository in a plan repository, and none in one repository', () => {
    const plan = ganttOf([prd({ row_id: 'P1', wave: 1, repos: ['crew', 'ux-research'] }), prd({ row_id: 'P2', wave: 1, repos: ['crew'] })], NOW, REPO);
    expect(plan.lanes).toBe(true);
    expect(plan.rows.map((r) => r.lanes)).toEqual([['crew', 'ux-research'], ['crew']]);
    const one = ganttOf([prd({ row_id: 'P1', wave: 1 })], NOW, REPO);
    expect(one.lanes).toBe(false);
    expect(one.rows.map((r) => r.lanes)).toEqual([[]]);
  });

  it('puts the pull request a held PRD waits on on its bar, with its link', () => {
    const gantt = ganttOf([
      prd({ row_id: 'P1', wave: 1, state: 'ready', waits_on: 'acme/crew#44: ready, waiting for your merge', waits_on_url: 'https://github.com/acme/crew/pull/44' }),
      prd({ row_id: 'P2', wave: 2, blockers: ['P1'], waits_on: 'waits on acme/crew#44 (P1 Crew API): ready, waiting for your merge', waits_on_url: 'https://github.com/acme/crew/pull/44' }),
      prd({ row_id: 'P3', wave: 1, state: 'merged', waits_on: 'stale', started_at: day(-3), ended_at: day(-1) }),
    ], NOW, REPO);
    expect(rowOf(gantt.rows, 'P2').waitsOn).toEqual({ label: 'waits on acme/crew#44 (P1 Crew API): ready, waiting for your merge', url: 'https://github.com/acme/crew/pull/44' });
    expect(rowOf(gantt.rows, 'P3').waitsOn).toBeNull();
  });

  it('names each state as the bar\'s colour reads it', () => {
    const states = ['waiting', 'building', 'outbox', 'ready', 'merged', 'closed'] as const;
    const gantt = ganttOf(states.map((state, i) => prd({ row_id: `P${i + 1}`, wave: 1, state })), NOW, REPO);
    expect(gantt.rows.map((r) => r.stateLabel)).toEqual(['waiting', 'building', 'outbox', 'waiting for merge', 'merged', 'closed unmerged']);
  });
});
