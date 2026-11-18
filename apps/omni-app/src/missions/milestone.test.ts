// A mission's milestone retros (PRD 3065 s4, spec sections 3, 5 and 6), pure: which milestone retro a run sends, skips or waits on,
// and what a retro's record line becomes as rows and events.
import { describe, expect, it } from 'vitest';
import { parseIssue, parsePrd, type PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import type { RetroRecord } from 'omni-loop/kit/lib/mission/retro.ts';
import {
  fileOf,
  itemRows,
  milestoneNext,
  milestoneWords,
  retroEvents,
  retroKey,
  retroOfKey,
  retroSkillLine,
  targetWords,
  type MilestoneView,
  type RetroJob,
  type RetroRow,
} from './milestone.ts';
import type { Attempt } from './supervisor.ts';

const ID = '0b7c1f6e-3a52-4d8e-9f10-2c4b6a8d0e11';
const p = (n: number): PrdNumber => parsePrd(n);
const attempt = (id: string, over: Partial<Attempt> = {}): Attempt => ({ id, status: 'running', outcome: null, reason: null, prUrl: null, ...over });
const job = (milestone: string, ...attempts: Attempt[]): RetroJob => ({ milestone, job: attempts[0]?.id ?? `r-${milestone}`, attempts });
const row = (milestone: string, over: Partial<RetroRow> = {}): RetroRow => ({ id: `row-${milestone}`, milestone, job: `r-${milestone}`, skipped: null, file: null, ...over });
const view = (over: Partial<MilestoneView> = {}): MilestoneView => ({ roadmaps: [{ roadmap: parseIssue(2790), prds: [p(1), p(2)] }], jobs: [], rows: [], ...over });
const doneOf = (...prds: number[]) => (prd: PrdNumber): boolean => prds.includes(prd);

const cited = (text: string) => ({ text, cites: [{ kind: 'prd' as const, ref: 2805 }] });
const record = (over: Partial<RetroRecord> = {}): RetroRecord => ({
  v: 1,
  mission: 12,
  milestone: '2790',
  retro: { wentWell: [cited('Three PRDs reached ready with no question.')], toChange: [cited('PRD 2805 was stuck twice on its preview.')] },
  file: '.omni-loop/missions/12/retros/1-roadmap-2790.md',
  items: [{ target: { kind: 'form', form: 'roadmap', section: 'Prerequisites' }, wording: 'Name every secret a preview needs.', evidence: [cited('PRD 2805 was stuck twice waiting on a preview secret.')] }],
  ...over,
});

describe('the milestone retro job: its key and its line', () => {
  it('is keyed mission:<id>:retro:<roadmap n | mission>, and read back', () => {
    expect(retroKey(ID, '2790')).toBe(`mission:${ID}:retro:2790`);
    expect(retroKey(ID, 'mission')).toBe(`mission:${ID}:retro:mission`);
    expect(retroOfKey(`mission:${ID}:retro:2790`)).toBe('2790');
    expect(retroOfKey(`mission:${ID}:retro:mission`)).toBe('mission');
    expect(retroOfKey(`mission:${ID}:stuck:1`)).toBeNull();
  });

  it('is sent as /omni:mission-retro, naming the mission by its number and the milestone', () => {
    expect(retroSkillLine(12, '2790')).toBe('/omni:mission-retro --mission 12 --milestone 2790');
    expect(retroSkillLine(12, 'mission')).toBe('/omni:mission-retro --mission 12 --milestone mission');
    expect(milestoneWords('2790')).toBe('roadmap #2790 delivered');
    expect(milestoneWords('mission')).toBe('mission delivered');
  });
});

describe('when a milestone retro is sent (AC-5, AC-6, AC-9)', () => {
  it('AC-5: sends one for a roadmap once every PRD of it is merged or joined, and none before', () => {
    expect(milestoneNext(view(), { done: doneOf(1), delivered: false, held: null })).toEqual({ send: null, skip: [], atWork: false });
    expect(milestoneNext(view(), { done: doneOf(1, 2), delivered: false, held: null })).toEqual({ send: '2790', skip: [], atWork: false });
  });

  it('sends it once: never again once sent or kept', () => {
    const sent = view({ jobs: [job('2790', attempt('r1'))] });
    expect(milestoneNext(sent, { done: doneOf(1, 2), delivered: false, held: null })).toEqual({ send: null, skip: [], atWork: true });
    const kept = view({ jobs: [job('2790', attempt('r1', { status: 'done' }))], rows: [row('2790', { job: 'r1' })] });
    expect(milestoneNext(kept, { done: doneOf(1, 2), delivered: false, held: null })).toEqual({ send: null, skip: [], atWork: false });
  });

  it('AC-6: one more for the mission delivered, after its roadmaps, one at a time', () => {
    expect(milestoneNext(view(), { done: doneOf(1, 2), delivered: true, held: null })).toEqual({ send: '2790', skip: [], atWork: false });
    const roadmapKept = view({ jobs: [job('2790', attempt('r1', { status: 'done' }))], rows: [row('2790', { job: 'r1' })] });
    expect(milestoneNext(roadmapKept, { done: doneOf(1, 2), delivered: true, held: null })).toEqual({ send: 'mission', skip: [], atWork: false });
    expect(milestoneNext(view({ roadmaps: [] }), { done: doneOf(), delivered: true, held: null })).toEqual({ send: 'mission', skip: [], atWork: false });
  });

  it('a roadmap with no PRD is no milestone', () => {
    expect(milestoneNext(view({ roadmaps: [{ roadmap: parseIssue(9), prds: [] }] }), { done: doneOf(), delivered: false, held: null })).toEqual({ send: null, skip: [], atWork: false });
  });

  it('AC-9: over a cap sends none until under every cap again; a delivered mission over a cap skips it, budget reached', () => {
    expect(milestoneNext(view(), { done: doneOf(1, 2), delivered: false, held: 'budget' })).toEqual({ send: null, skip: [], atWork: false });
    expect(milestoneNext(view(), { done: doneOf(1, 2), delivered: false, held: 'paused' })).toEqual({ send: null, skip: [], atWork: false });
    expect(milestoneNext(view(), { done: doneOf(1, 2), delivered: true, held: 'budget' })).toEqual({ send: null, skip: ['2790', 'mission'], atWork: false });
  });
});

describe("a retro's record line, as rows", () => {
  it('keeps a file inside the repository as the database takes it, and none other', () => {
    expect(fileOf('.omni-loop/missions/12/retros/1-roadmap-2790.md')).toBe('.omni-loop/missions/12/retros/1-roadmap-2790.md');
    for (const bad of [null, 'retros/a b.md', '../x.md', 'retros/./x.md', 'retros/x.txt', `${'a/'.repeat(160)}x.md`]) expect(fileOf(bad), String(bad)).toBeNull();
  });

  it('AC-7: an item is its target, its wording and its evidence, numbered in order', () => {
    expect(itemRows(record())).toEqual([{ number: 1, target: 'the roadmap form: Prerequisites', wording: 'Name every secret a preview needs.', evidence: ['PRD 2805 was stuck twice waiting on a preview secret.'] }]);
    expect(targetWords({ kind: 'law', id: 'BR-PRODUCT-12' })).toBe('law BR-PRODUCT-12');
    expect(targetWords({ kind: 'rule', id: 'BR-PRODUCT-139' })).toBe('rule BR-PRODUCT-139');
    const many = record({ items: Array.from({ length: 25 }, () => record().items[0]).filter((one) => one !== undefined) });
    expect(itemRows(many)).toHaveLength(20);
  });
});

describe('the retro events: signed by the supervisor, never a log', () => {
  it('says each retro recorded, linking its file on the mission branch, or skipped and why, and each change proposed', () => {
    const at = { repo: 'acme/widgets', branch: 'mission/12-faster-quotes' };
    const kept = retroEvents({ milestone: '2790', job: 'r1', file: '.omni-loop/missions/12/retros/1-roadmap-2790.md', skipped: null, targets: ['the roadmap form: Prerequisites'] }, at);
    expect(kept.map(({ kind, role, prd, job: id, link, sentence }) => [kind, role, prd, id, link, sentence])).toEqual([
      ['milestone-retro', 'supervisor', null, 'r1', 'https://github.com/acme/widgets/blob/mission/12-faster-quotes/.omni-loop/missions/12/retros/1-roadmap-2790.md', 'Retro: roadmap #2790 delivered.'],
      ['item-proposed', 'supervisor', null, 'r1', null, 'Proposes a change to the roadmap form: Prerequisites.'],
    ]);
    expect(retroEvents({ milestone: 'mission', job: null, file: null, skipped: 'budget reached', targets: [] }, { repo: 'acme/widgets', branch: null }).map(({ sentence, link }) => [sentence, link])).toEqual([
      ['Retro skipped: budget reached (mission delivered).', null],
    ]);
  });
});
