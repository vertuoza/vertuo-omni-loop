// A mission's milestone retros (PRD 3065 s4, AC-5 to AC-7 and AC-9) on fake runners: the real job handler and supervisor, against the
// mission's store in memory, and record lines the test hands out as `/omni:mission-retro` writes them. No database, no runner, no
// model call, no GitHub.
import { describe, expect, it } from 'vitest';
import { parseIssue, parsePrd, type PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import { retroRecordLine, type RetroRecord } from 'omni-loop/kit/lib/mission/retro.ts';
import type { ClaimedJob } from '../jobs/ledger.ts';
import type { MissionBranches } from './branch.ts';
import { MISSION_KIND, missionHandler } from './job.ts';
import { fakeMissionStore } from './store.fake.ts';
import type { MissionRecord } from './store.ts';
import type { PrdFacts } from './supervisor.ts';

const ID = '0b7c1f6e-3a52-4d8e-9f10-2c4b6a8d0e11';
const NOW = Date.parse('2027-01-26T09:00:00Z');
const BRANCH = 'mission/12-faster-quotes';
const p = (n: number): PrdNumber => parsePrd(n);
const ROADMAP = { roadmap: parseIssue(2790), prds: [p(1), p(2)] };

const record = (over: Partial<MissionRecord> = {}): MissionRecord => ({
  id: ID,
  workspace: 'ws-1',
  repo: 'acme/widgets',
  fleet: 'night-shift',
  number: parseIssue(12),
  title: 'Faster quotes',
  level: 'own-branch',
  status: 'running',
  waitingOn: null,
  parallel: 2,
  scope: { prds: [p(3)], roadmaps: [parseIssue(2790)] },
  ...over,
});
const facts = (n: number, over: Partial<PrdFacts> = {}): PrdFacts => ({ prd: p(n), approval: 'standing', stage: 'open', blockers: [], territory: [`apps/area-${String(n)}/`], ...over });

const claimed: ClaimedJob = {
  id: 'bg-1',
  kind: MISSION_KIND,
  key: `mission:${ID}`,
  subject: 'acme/widgets',
  payload: { mission: ID },
  tries: 1,
  claim: 'claim-1',
  claimedUntil: new Date(NOW + 300_000).toISOString(),
  progress: {},
  lane: `mission:${ID}`,
};

const cited = (text: string, ref = 2805) => ({ text, cites: [{ kind: 'prd' as const, ref }] });

/** What `/omni:mission-retro` ends on: its record line for `milestone`, its file and its items. */
function retroLine(milestone: string, over: Partial<RetroRecord> = {}): string {
  const line = retroRecordLine({
    v: 1,
    mission: 12,
    milestone,
    retro: { wentWell: [cited('Three of four PRDs reached ready with no question.', 2803)], toChange: [cited('PRD 2805 was stuck twice on its preview.')] },
    file: `.omni-loop/missions/12/retros/1-roadmap-${milestone}.md`,
    items: [{ target: { kind: 'form', form: 'roadmap', section: 'Prerequisites' }, wording: 'Name every secret a preview needs as a prerequisite of the roadmap.', evidence: [cited('PRD 2805 was stuck twice waiting on a preview secret.')] }],
    ...over,
  });
  return `09:10:00 writing the retro…\n09:10:01 ${line}`;
}

const branches: MissionBranches = { prepare: () => Promise.resolve({ ok: true, cut: false }) };

function setup({ mission = record(), all = [facts(1), facts(2), facts(3)] } = {}) {
  const fake = fakeMissionStore({ mission, facts: all, now: () => NOW, retros: { roadmaps: [ROADMAP] } });
  const run = () => missionHandler({ store: fake.store, branches, refresh: () => Promise.resolve('again'), now: () => NOW, log: () => undefined })(claimed);
  const said = (kind: string) => fake.events().filter((event) => event.kind === kind);
  return { fake, run, said };
}

describe('a roadmap of the scope delivered (AC-5)', () => {
  it('sends one /omni:mission-retro for it, once, and its record line adds its retro, linking its file on the mission branch', async () => {
    const { fake, run, said } = setup();
    await run();
    expect(fake.retroJobs()).toEqual([]);
    fake.set(p(1), { stage: 'merged' });
    fake.set(p(2), { stage: 'merged' });
    await run();
    await run();
    expect(fake.retroJobs()).toEqual([expect.objectContaining({ milestone: '2790', key: `mission:${ID}:retro:2790`, line: '/omni:mission-retro --mission 12 --milestone 2790', toFleet: 'night-shift' })]);
    expect(said('dispatched').filter((event) => event.prd === null).map((event) => event.sentence)).toEqual([
      "Sent /omni:mission-retro --mission 12 --milestone 2790 to the night-shift fleet's runners (roadmap #2790 delivered).",
    ]);
    fake.endRetro('2790', { status: 'done' }, retroLine('2790'));
    await run();
    await run();
    expect(fake.retroRows()).toEqual([
      expect.objectContaining({ milestone: '2790', job: fake.retroJobs()[0]?.job, skipped: null, file: '.omni-loop/missions/12/retros/1-roadmap-2790.md', retro: expect.objectContaining({ wentWell: [cited('Three of four PRDs reached ready with no question.', 2803)] }) as unknown }),
    ]);
    expect(said('milestone-retro')).toEqual([
      expect.objectContaining({ role: 'supervisor', actor: 'agent', prd: null, sentence: 'Retro: roadmap #2790 delivered.', link: `https://github.com/acme/widgets/blob/${BRANCH}/.omni-loop/missions/12/retros/1-roadmap-2790.md` }),
    ]);
  });

  it('AC-7: a change it proposes is one question of the mission, its target, wording and evidence, and changes nothing else', async () => {
    const { fake, run, said } = setup({ all: [facts(1, { stage: 'merged' }), facts(2, { stage: 'merged' }), facts(3)] });
    await run();
    fake.endRetro('2790', { status: 'done' }, retroLine('2790'));
    await run();
    await run();
    expect(fake.items()).toEqual([
      { retro: fake.retroRows()[0]?.id, number: 1, target: 'the roadmap form: Prerequisites', wording: 'Name every secret a preview needs as a prerequisite of the roadmap.', evidence: ['PRD 2805 was stuck twice waiting on a preview secret.'] },
    ]);
    expect(said('item-proposed').map((event) => [event.role, event.actor, event.sentence])).toEqual([['supervisor', 'agent', 'Proposes a change to the roadmap form: Prerequisites.']]);
    expect(fake.mission().status).toBe('running');
  });

  it('a line that cannot be read, or names another milestone, is kept as skipped, saying why', async () => {
    const { fake, run, said } = setup({ all: [facts(1, { stage: 'merged' }), facts(2, { stage: 'merged' }), facts(3)] });
    await run();
    fake.endRetro('2790', { status: 'done' }, retroLine('2791'));
    await run();
    expect(fake.retroRows()).toEqual([expect.objectContaining({ milestone: '2790', skipped: 'its record line names another mission or milestone', file: null, retro: null })]);
    expect(said('milestone-retro').map((event) => event.sentence)).toEqual(['Retro skipped: its record line names another mission or milestone (roadmap #2790 delivered).']);
    expect(fake.items()).toEqual([]);
  });
});

describe('the mission delivered (AC-6)', () => {
  it('sends one more retro, for the mission, after its roadmap\'s; at with-you it is kept with no file', async () => {
    const all = [facts(1, { stage: 'merged' }), facts(2, { stage: 'merged' }), facts(3)];
    const { fake, run, said } = setup({ mission: record({ level: 'with-you' }), all });
    await run();
    fake.set(p(3), { stage: 'merged' });
    // Delivered while the roadmap's retro works: watched until each retro is recorded, one at a time.
    expect(await run()).toMatchObject({ outcome: 'later' });
    expect(fake.mission().status).toBe('delivered');
    expect(fake.retroJobs().map((job) => job.milestone)).toEqual(['2790']);
    fake.endRetro('2790', { status: 'done' }, retroLine('2790', { file: null }));
    expect(await run()).toMatchObject({ outcome: 'later' });
    expect(fake.retroJobs().map((job) => job.milestone)).toEqual(['2790', 'mission']);
    fake.endRetro('mission', { status: 'done' }, retroLine('mission', { file: null, items: [] }));
    expect(await run()).toEqual({ outcome: 'done' });
    expect(fake.retroRows().map(({ milestone, file, skipped }) => [milestone, file, skipped])).toEqual([['2790', null, null], ['mission', null, null]]);
    expect(said('milestone-retro').map((event) => [event.sentence, event.link])).toEqual([['Retro: roadmap #2790 delivered.', null], ['Retro: mission delivered.', null]]);
    expect(await run()).toEqual({ outcome: 'done' });
    expect(fake.retroJobs()).toHaveLength(2);
  });
});

describe('retros count toward the token caps (AC-9)', () => {
  it('sends no milestone retro while a cap is reached, and sends it once the mission is under every cap again', async () => {
    const { fake, run } = setup({ mission: record({ tokens: 1000 }), all: [facts(1, { stage: 'merged' }), facts(2, { stage: 'merged' }), facts(3)] });
    fake.spend({ mission: 1100 });
    await run();
    await run();
    expect(fake.mission().status).toBe('paused');
    expect(fake.retroJobs()).toEqual([]);
    fake.answer('raised', 5000);
    await run();
    expect(fake.retroJobs().map((job) => job.milestone)).toEqual(['2790']);
  });

  it('a delivered mission over a cap sends none any more: Retro skipped, budget reached', async () => {
    const all = [facts(1, { stage: 'merged' }), facts(2, { stage: 'merged' }), facts(3, { stage: 'merged' })];
    const { fake, run, said } = setup({ mission: record({ tokens: 1000 }), all });
    fake.spend({ mission: 1100 });
    expect(await run()).toEqual({ outcome: 'done' });
    expect(fake.mission().status).toBe('delivered');
    expect(fake.retroJobs()).toEqual([]);
    expect(fake.retroRows().map(({ milestone, skipped }) => [milestone, skipped])).toEqual([['2790', 'budget reached'], ['mission', 'budget reached']]);
    expect(said('milestone-retro').map((event) => event.sentence)).toEqual(['Retro skipped: budget reached (roadmap #2790 delivered).', 'Retro skipped: budget reached (mission delivered).']);
    expect(await run()).toEqual({ outcome: 'done' });
    expect(fake.retroRows()).toHaveLength(2);
  });
});
