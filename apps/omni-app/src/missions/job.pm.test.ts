import { describe, expect, it } from 'vitest';
import { committeeLine } from 'omni-loop/kit/lib/committee/record.ts';
import { parseIssue, parsePrd, type PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import { pmLine } from 'omni-loop/kit/lib/virtual-fleet/pm.ts';
import type { ClaimedJob } from '../jobs/ledger.ts';
import type { MissionBranches } from './branch.ts';
import { MISSION_KIND, missionHandler } from './job.ts';
import { fakeMissionStore } from './store.fake.ts';
import type { MissionRecord } from './store.ts';
import type { PrdFacts } from './supervisor.ts';

// The PM's own PRDs at `alone` (PRD 2896 s12, criteria 19, 21 and 22): with `mandate.ownPrds` at 0 no PM job is sent; above it,
// the mission sends its PM one job, a brainstorm for one PRD or a roadmap for several, under its own key; what the PM wrote joins
// the scope, at most the cap, each `added by the fleet`, the rest named `not written: the cap is <k>`; and a PRD it wrote goes to
// the committee with the PM sitting out, so the Architect and the Reviewer approve it.

const ID = '0b7c1f6e-3a52-4d8e-9f10-2c4b6a8d0e12';
const NOW = Date.parse('2027-01-23T09:00:00Z');
const p = (n: number): PrdNumber => parsePrd(n);

const record = (over: Partial<MissionRecord> = {}): MissionRecord => ({
  id: ID,
  workspace: 'ws-1',
  repo: 'acme/widgets',
  fleet: 'night-shift',
  number: parseIssue(12),
  title: 'Faster quotes',
  level: 'alone',
  status: 'running',
  waitingOn: null,
  parallel: 1,
  scope: { prds: [p(1)], roadmaps: [] },
  ownPrds: 2,
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

const branches: MissionBranches = { prepare: () => Promise.resolve({ ok: true, cut: false }) };

function setup({ mission = record(), planRepository = false, all = [facts(1)] } = {}) {
  const pages = [facts(50, { approval: 'none', territory: ['apps/area-50/'] }), facts(51, { approval: 'none', territory: ['apps/area-51/'] }), facts(52, { approval: 'none' })];
  const fake = fakeMissionStore({ mission, facts: all, pages, planRepository });
  const run = () => missionHandler({ store: fake.store, branches, refresh: () => Promise.resolve('again'), now: () => NOW, log: () => undefined })(claimed);
  return { fake, run };
}

const wrote = (prds: number[], unwritten: string[] = [], cap = 2) => `12:00:00 Done\n${pmLine({ v: 1, mission: 12, skill: 'roadmap', cap, prds: prds.map(p), unwritten })}`;
const kinds = (fake: ReturnType<typeof setup>['fake'], kind: string) => fake.events().filter((event) => event.kind === kind);

describe('the PM\'s job', () => {
  it('is never sent with mandate.ownPrds at 0, nor below alone', async () => {
    const unset = record();
    delete unset.ownPrds;
    for (const mission of [record({ ownPrds: 0 }), record({ level: 'own-branch' }), unset]) {
      const { fake, run } = setup({ mission });
      await run();
      expect(fake.pms(), JSON.stringify(mission)).toEqual([]);
    }
  });

  it('is a roadmap for several PRDs, a brainstorm for one, and their mega forms in a plan repository, sent once to the fleet', async () => {
    const several = setup();
    await several.run();
    await several.run();
    expect(several.fake.pms().map(({ line, key, toFleet }) => [line, key, toFleet])).toEqual([['/omni:roadmap --mission 12 --cap 2', `mission:${ID}:pm:1`, 'night-shift']]);
    expect(kinds(several.fake, 'dispatched').map((event) => event.sentence)).toContain('Sent the PM /omni:roadmap for the mission\'s goal: 2 PRDs at most.');
    const one = setup({ mission: record({ ownPrds: 1 }) });
    await one.run();
    expect(one.fake.pms().map((job) => job.line)).toEqual(['/omni:brainstorm --mission 12 --cap 1']);
    const plan = setup({ planRepository: true });
    await plan.run();
    expect(plan.fake.pms().map((job) => job.line)).toEqual(['/omni:mega-roadmap --mission 12 --cap 2']);
  });

  it('keeps the mission running while the PM writes, even when every PRD of its scope merged', async () => {
    const { fake, run } = setup({ all: [facts(1, { stage: 'merged' })] });
    await run();
    expect(fake.mission().status).toBe('running');
    fake.endPm({ status: 'done' }, '12:00:00 Done');
    await run();
    expect(fake.mission().status).toBe('delivered');
  });
});

describe('what the PM wrote', () => {
  it('joins the scope, at most the cap, each added by the fleet, the rest named with the cap, once (criteria 19 and 22)', async () => {
    const { fake, run } = setup();
    await run();
    fake.endPm({ status: 'done' }, wrote([50, 51, 52], ['Refunds by card']));
    await run();
    await run();
    expect(kinds(fake, 'prd-added').map(({ prd, role, actor, sentence }) => [prd, role, actor, sentence])).toEqual([
      [p(50), 'pm', 'agent', 'PRD 50 added by the fleet.'],
      [p(51), 'pm', 'agent', 'PRD 51 added by the fleet.'],
    ]);
    expect(kinds(fake, 'not-written').map((event) => event.sentence)).toEqual(['PRD 52: not written: the cap is 2.', 'Refunds by card: not written: the cap is 2.']);
    expect(fake.pms()).toHaveLength(1);
  });

  it('goes to the committee with the PM sitting out, and two yes from the Architect and the Reviewer carry it (criterion 19)', async () => {
    const { fake, run } = setup({ mission: record({ ownPrds: 1 }) });
    await run();
    fake.endPm({ status: 'done' }, wrote([50], [], 1));
    await run();
    expect(fake.committees().map((one) => one.line)).toEqual(['/omni:committee 50 --approve --author pm']);
    const two = [{ role: 'architect' as const, answer: 'yes' as const, sentence: 'Sound.' }, { role: 'reviewer' as const, answer: 'yes' as const, sentence: 'Tested.' }];
    const log = committeeLine({ v: 1, prd: p(50), kind: 'approve', author: null, read: [{ kind: 'spec', sha256: 'a'.repeat(64) }], escalations: [], verdicts: two, outcome: 'carried' });
    fake.endCommittee(p(50), { status: 'done' }, log);
    await run();
    expect(fake.committees()[0]?.recorded).toEqual({ record: { author: 'pm', read: [{ kind: 'spec', sha256: 'a'.repeat(64) }], verdicts: two }, decision: { outcome: 'carried', why: [] } });
  });

  it('escalates when the PM voted on a PRD it wrote, whatever its record said of the author', async () => {
    const { fake, run } = setup({ mission: record({ ownPrds: 1 }) });
    await run();
    fake.endPm({ status: 'done' }, wrote([50], [], 1));
    await run();
    const three = [
      { role: 'pm' as const, answer: 'yes' as const, sentence: 'Mine.' },
      { role: 'architect' as const, answer: 'yes' as const, sentence: 'Sound.' },
      { role: 'reviewer' as const, answer: 'yes' as const, sentence: 'Tested.' },
    ];
    fake.endCommittee(p(50), { status: 'done' }, committeeLine({ v: 1, prd: p(50), kind: 'approve', author: null, read: [], escalations: [], verdicts: three, outcome: 'carried' }));
    await run();
    expect(fake.committees()[0]?.recorded?.decision).toEqual({ outcome: 'escalated', why: ['the PM wrote it and may not vote on it'] });
  });

  it('adds nothing when the PM\'s job failed or left no record, and is not sent again', async () => {
    const { fake, run } = setup();
    await run();
    fake.endPm({ status: 'failed', reason: 'boom' });
    await run();
    await run();
    expect(kinds(fake, 'prd-added')).toEqual([]);
    expect(kinds(fake, 'job-ended').filter((event) => event.role === 'pm').map((event) => event.sentence)).toEqual(['/omni:roadmap failed: the fleet added no PRD.']);
    expect(fake.pms()).toHaveLength(1);
  });
});
