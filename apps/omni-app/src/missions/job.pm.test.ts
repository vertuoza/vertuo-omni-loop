import { describe, expect, it } from 'vitest';
import { committeeLine } from 'omni-loop/kit/lib/committee/record.ts';
import { parseIssue, parsePrd, type PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import { fingerprint } from 'omni-loop/kit/lib/repair/fingerprint.ts';
import { repairRecordLine } from 'omni-loop/kit/lib/repair/line.ts';
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

// The PM plans and replans (PRD omni-loop-21 s9): a PRD with no plan on its page is planned before its approval, and one stopped once
// its repairs are spent is replanned, built again only once the committee approved the new plan version, the PM sitting out.

/** A mission at `alone` with no PRD of its own to write, its store keeping retros (PRD 3065), and its PRDs `all`. */
function planning(all: PrdFacts[], over: Partial<MissionRecord> = {}) {
  const fake = fakeMissionStore({ mission: record({ ownPrds: 0, ...over }), facts: all, retros: { roadmaps: [] } });
  const run = () => missionHandler({ store: fake.store, branches, refresh: () => Promise.resolve('again'), now: () => NOW, log: () => undefined })(claimed);
  return { fake, run };
}

/** A committee's record, the Architect and the Reviewer answering `answer`, the PM sitting out. */
const voted = (prd: PrdNumber, answer: 'yes' | 'no') =>
  committeeLine({
    v: 1, prd, kind: 'approve', author: 'pm', read: [{ kind: 'plan', sha256: 'b'.repeat(64) }], escalations: [], outcome: answer === 'yes' ? 'carried' : 'escalated',
    verdicts: [{ role: 'architect', answer, sentence: answer === 'yes' ? 'Smaller slices.' : 'Still too wide.' }, { role: 'reviewer', answer: 'yes', sentence: 'Tested.' }],
  });

/** What `/omni:repair` ends on for PRD 1: a flake of one cause, so the 4th repair of it is refused (3 per cause in a round). */
function flaked(): string {
  const cause = { class: 'flake' as const, place: 'pnpm test', signature: 'Error: socket hang up' };
  const print = fingerprint(cause);
  const retro = { ...cause, cause: 'The test server hung up.', evidence: ['The socket closed mid-run.'], proposedFix: 'Retry the run.', fingerprint: print };
  return `12:00:01 ${repairRecordLine({ v: 1, mission: 12, prd: p(1), fingerprint: print, class: 'flake', retro, fix: null, report: null })}`;
}

/** Fails PRD 1's step four times, each repaired as the same flake: the fourth repair is refused, so its repairs are spent. */
async function spend(fake: ReturnType<typeof planning>['fake'], run: () => Promise<unknown>) {
  await run();
  for (let n = 0; n < 4; n += 1) {
    fake.end(p(1), { status: 'failed', reason: 'exit code 1' });
    await run();
    fake.endRepairJob(p(1), { status: 'done' }, flaked());
    await run();
  }
}

const pmLines = (fake: ReturnType<typeof planning>['fake']) => fake.pms().map(({ line, key }) => [line, key]);

describe('the PM plans a PRD with no plan on its page (AC-3)', () => {
  it('AC-3: sends the PM a plan job before any approval, then the committee once a plan is on its page, the PM sitting out', async () => {
    const { fake, run } = planning([facts(1, { approval: 'none', territory: null })]);
    await run();
    await run();
    expect(pmLines(fake)).toEqual([['/omni:plan 1', `mission:${ID}:pm:2`]]);
    expect(fake.pms()[0]?.toFleet).toBe('night-shift');
    expect(fake.committees()).toEqual([]);
    expect(fake.mission().status).toBe('running');
    expect(kinds(fake, 'dispatched').map((event) => event.sentence)).toContain('Sent the PM /omni:plan 1: PRD 1 has no plan on its page, so it is planned before its approval.');
    fake.endPm({ status: 'done' }, '12:00:00 Done');
    await run();
    // Ended, but no plan on its page yet: no committee, and a person is asked.
    expect(fake.committees()).toEqual([]);
    expect(fake.mission().waitingOn).toBe('PRD 1: approve it (the PM\'s /omni:plan 1 ended and no plan is on its page)');
    fake.set(p(1), { territory: ['apps/area-1/'] });
    await run();
    expect(fake.committees().map((one) => one.line)).toEqual(['/omni:committee 1 --approve --author pm']);
    fake.endCommittee(p(1), { status: 'done' }, voted(p(1), 'yes'));
    await run();
    expect(fake.committees()[0]?.recorded?.decision).toEqual({ outcome: 'carried', why: [] });
    expect(fake.jobs().map((job) => job.step)).toEqual(['build']);
    expect(pmLines(fake)).toHaveLength(1);
    expect(kinds(fake, 'job-ended').filter((event) => event.role === 'pm').map((event) => event.sentence)).toEqual(['The PM planned PRD 1: its committee approves it once the plan is on its page, the PM sitting out.']);
  });

  it('plans nothing below alone, for a PRD whose approval stands, or one with a plan on its page', async () => {
    for (const [all, over] of [
      [[facts(1, { approval: 'none', territory: null })], { level: 'own-branch' }],
      [[facts(1, { territory: null })], {}],
      [[facts(1, { approval: 'none' })], {}],
    ] as const) {
      const { fake, run } = planning([...all], over);
      await run();
      expect(fake.pms(), JSON.stringify(all)).toEqual([]);
    }
  });

  it('sends the PM\'s own PRDs\' job under round 1 beside a plan job', async () => {
    const { fake, run } = planning([facts(1, { approval: 'none', territory: null })], { ownPrds: 1 });
    await run();
    expect(pmLines(fake).sort()).toEqual([['/omni:brainstorm --mission 12 --cap 1', `mission:${ID}:pm:1`], ['/omni:plan 1', `mission:${ID}:pm:2`]]);
  });
});

describe('the PM replans a PRD stuck once its repairs are spent (AC-4)', () => {
  it('AC-4: sends a replan for its slices not merged, and builds it again only once the committee approved the new plan version', async () => {
    const { fake, run } = planning([facts(1)]);
    await spend(fake, run);
    expect(fake.repairJobs()).toHaveLength(4);
    expect(pmLines(fake)).toEqual([['/omni:plan 1 --replan', `mission:${ID}:pm:2`]]);
    expect(kinds(fake, 'stopped')).toEqual([]);
    expect(fake.mission().status).toBe('running');
    const builds = fake.jobs().length;
    await run();
    expect(fake.committees()).toEqual([]);
    // The new plan version voids the approval (BL-APPROVALS-1): a committee approves it, the PM sitting out.
    fake.endPm({ status: 'done' }, '12:00:00 Done');
    fake.set(p(1), { approval: 'voided' });
    await run();
    expect(fake.committees().map((one) => [one.line, one.round])).toEqual([['/omni:committee 1 --approve --author pm', 1]]);
    await run();
    expect(fake.jobs()).toHaveLength(builds);
    fake.endCommittee(p(1), { status: 'done' }, voted(p(1), 'yes'));
    await run();
    expect(fake.jobs()).toHaveLength(builds + 1);
    expect(fake.jobs().at(-1)).toMatchObject({ step: 'build', run: builds + 1 });
    await run();
    expect(fake.jobs()).toHaveLength(builds + 1);
    expect(pmLines(fake)).toHaveLength(1);
  });

  it('a committee that refuses the new plan stops the PRD, saying why, and sends the mission\'s retro', async () => {
    const { fake, run } = planning([facts(1)]);
    await spend(fake, run);
    fake.endPm({ status: 'done' }, '12:00:00 Done');
    await run();
    fake.endCommittee(p(1), { status: 'done' }, voted(p(1), 'no'));
    await run();
    await run();
    expect(fake.mission().status).toBe('stopped');
    expect(fake.mission().waitingOn).toMatch(/^PRD 1 stopped: the committee refused its new plan: /);
    expect(fake.retroJobs().map((job) => job.line)).toEqual(['/omni:mission-retro --mission 12 --milestone mission']);
    expect(kinds(fake, 'dispatched').map((event) => event.sentence)).toContain('A new plan was refused: sent /omni:mission-retro --mission 12 --milestone mission to the night-shift fleet\'s runners.');
  });

  it('a replan that failed stops the PRD, and nothing is replanned twice', async () => {
    const { fake, run } = planning([facts(1)]);
    await spend(fake, run);
    fake.endPm({ status: 'failed', reason: 'boom' });
    await run();
    await run();
    expect(fake.mission().waitingOn).toMatch(/^PRD 1 stopped: its repairs are spent, and the PM's replan failed\./);
    expect(pmLines(fake)).toHaveLength(1);
    expect(fake.committees()).toEqual([]);
  });

  it('replans nothing below alone: the PRD stops as before', async () => {
    const { fake, run } = planning([facts(1)], { level: 'own-branch' });
    await spend(fake, run);
    expect(fake.pms()).toEqual([]);
    expect(fake.mission().status).toBe('stopped');
  });
});
