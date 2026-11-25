import { describe, expect, it } from 'vitest';
import { parseIssue, parseProductPrdId, type ProductPrdId } from 'omni-loop/kit/lib/ids.ts';
import { planLine } from 'omni-loop/kit/lib/virtual-fleet/plan-record.ts';
import { pmLine } from 'omni-loop/kit/lib/virtual-fleet/pm.ts';
import { techLine } from 'omni-loop/kit/lib/virtual-fleet/tech-record.ts';
import type { ClaimedJob } from '../jobs/ledger.ts';
import type { MissionBranches } from './branch.ts';
import { MISSION_KIND, missionHandler } from './job.ts';
import type { Home } from './pm.ts';
import { fakeMissionStore } from './store.fake.ts';
import type { MissionRecord, StoredProduct } from './store.ts';

// The PM's own product PRDs at `alone` (PRD omni-loop-26): on a repository whose phase 0 is on the server, in product `omni-loop`, a
// PRD the PM wrote is planned by the PM, its plan approved by the PM (`omni plan:`), reviewed by the fleet's Architect (`omni tech:`)
// and built only once both decisions name its latest plan version, the PM sent again on a version the Architect pushed. No
// committee job is sent for it, and a product PRD a person wrote waits for a person's approval as before.

const ID = '0b7c1f6e-3a52-4d8e-9f10-2c4b6a8d0e26';
const NOW = Date.parse('2027-01-30T09:00:00Z');
const P31 = parseProductPrdId('omni-loop-31');
const P40 = parseProductPrdId('omni-loop-40');
const A = 'a'.repeat(64);
const B = 'b'.repeat(64);
const SERVER: Home = { phase0: 'server', product: 'omni-loop' };

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
  scope: { prds: [], roadmaps: [] },
  ownPrds: 2,
  ...over,
});

const page = (prd: ProductPrdId, over: Partial<StoredProduct> = {}): StoredProduct => ({
  prd,
  approval: 'none',
  blockers: [],
  targets: ['acme/widgets'],
  items: { ranks: [], open: [] },
  plan: null,
  ...over,
});

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

const wrote = (prds: ProductPrdId[]) => `12:00:00 Done\n${pmLine({ v: 1, mission: 12, skill: 'roadmap', cap: 2, prds, unwritten: [] })}`;
const approvedPlan = (plan: string) => `12:10:00 Done\n${planLine({ v: 1, prd: P31, plan, outcome: 'approved' })}`;
const reviewed = (plan: string, over: { settled?: string[]; open?: string[]; outcome?: 'approved' | 'escalated' } = {}) =>
  `12:20:00 Done\n${techLine({ v: 1, prd: P31, plan, settled: over.settled ?? ['the slices s2 and s3 share no file now'], open: over.open ?? [], outcome: over.outcome ?? 'approved' })}`;

function setup({ mission = record(), home = SERVER, products = [] as StoredProduct[] } = {}) {
  const fake = fakeMissionStore({ mission, facts: [], products, productPages: [page(P31)], home });
  const run = () => missionHandler({ store: fake.store, branches, refresh: () => Promise.resolve('again'), now: () => NOW, log: () => undefined })(claimed);
  const sentences = (kind: string) => fake.events().filter((event) => event.kind === kind).map((event) => event.sentence);
  return { fake, run, sentences };
}

/** The PM wrote omni-loop-31, and its plan job was sent. */
async function written() {
  const made = setup();
  await made.run();
  made.fake.endPm({ status: 'done', outcome: 'ready' }, wrote([P31]));
  await made.run();
  return made;
}

/** omni-loop-31 planned at version A and approved by the PM, then sent to the Architect. */
async function planned() {
  const made = await written();
  made.fake.setProduct(P31, { plan: A });
  made.fake.endPm({ status: 'done', outcome: 'ready' }, approvedPlan(A));
  await made.run();
  return made;
}

describe('a PM product PRD, planned, approved and reviewed before its build (AC-1, AC-3)', () => {
  it('AC-1: the PM writes on the product, and the PRD it wrote is planned, never sent to a committee', async () => {
    const { fake, sentences } = await written();
    expect(fake.pms().map(({ line }) => line)).toEqual(['/omni:roadmap --mission 12 --cap 2 --product omni-loop', '/omni:mega-brainstorm --product omni-loop --plan-only omni-loop-31 --mission 12']);
    expect(sentences('prd-added')).toEqual(['PRD omni-loop-31 added by the fleet.']);
    expect(sentences('dispatched').at(-1)).toBe('Sent the PM /omni:mega-brainstorm --product omni-loop --plan-only omni-loop-31 --mission 12: it plans PRD omni-loop-31, which it wrote, and approves its plan.');
    expect(fake.committees()).toEqual([]);
    expect(fake.productJobs()).toEqual([]);
  });

  it('AC-3: records the PM\'s plan approval, then sends the Architect its review', async () => {
    const { fake, sentences } = await planned();
    expect(fake.planDecisions().map(({ kind, plan, outcome }) => [kind, plan, outcome])).toEqual([['plan', A, 'approved']]);
    expect(fake.techJobs().map(({ key, line, toFleet }) => [key, line, toFleet])).toEqual([[`mission:${ID}:prd:omni-loop-31:tech:1`, '/omni:tech-review omni-loop-31 --mission 12', 'night-shift']]);
    expect(sentences('job-ended')).toContain('The PM approved the plan of PRD omni-loop-31 (version aaaaaaa).');
    expect(fake.productJobs()).toEqual([]);
  });

  it('AC-3: the Architect approves a version it pushed: the PM is sent again on it, and no build until both name it', async () => {
    const { fake, run, sentences } = await planned();
    fake.setProduct(P31, { plan: B });
    fake.endTech(P31, { status: 'done', outcome: 'ready' }, reviewed(B));
    await run();
    expect(fake.planDecisions().map(({ kind, plan, outcome, techApproval, approval }) => [kind, plan, outcome, techApproval, approval])).toEqual([
      ['plan', A, 'approved', false, false],
      ['tech', B, 'approved', true, false],
    ]);
    expect(sentences('job-ended')).toContain('The Architect approved the plan of PRD omni-loop-31 (version bbbbbbb), settling: the slices s2 and s3 share no file now.');
    expect(fake.pms().map(({ line }) => line).at(-1)).toBe('/omni:mega-brainstorm --product omni-loop --plan-only omni-loop-31 --mission 12');
    expect(fake.pms()).toHaveLength(3);
    expect(sentences('dispatched').at(-1)).toBe('Sent the PM /omni:mega-brainstorm --product omni-loop --plan-only omni-loop-31 --mission 12 again: PRD omni-loop-31 has a newer plan version, so the PM approves it.');
    expect(fake.productJobs()).toEqual([]);

    fake.endPm({ status: 'done', outcome: 'ready' }, approvedPlan(B));
    await run();
    expect(fake.planDecisions().at(-1)).toMatchObject({ kind: 'plan', plan: B, outcome: 'approved', approval: true });
    expect(fake.productJobs().map(({ key, line }) => [key, line])).toEqual([[`mission:${ID}:prd:omni-loop-31:run:1`, '/omni:ultra-yolo omni-loop-31 --base-of acme/widgets=mission/12-faster-quotes']]);
    expect(fake.techJobs()).toHaveLength(1);
  });

  it('AC-6: the Architect approving the version the PM approved gives the Tech Approval and the build', async () => {
    const { fake, run } = await planned();
    fake.endTech(P31, { status: 'done', outcome: 'ready' }, reviewed(A, { settled: [] }));
    await run();
    expect(fake.planDecisions().at(-1)).toMatchObject({ kind: 'tech', plan: A, outcome: 'approved', techApproval: true, approval: true });
    expect(fake.productJobs()).toHaveLength(1);
    expect(fake.pms()).toHaveLength(2);
  });

  it('sends a person the PRD once two rounds named no one plan version', async () => {
    const { fake, run } = await planned();
    fake.setProduct(P31, { plan: B });
    fake.endTech(P31, { status: 'done', outcome: 'ready' }, reviewed(B));
    await run();
    // The PM's second plan job pushed yet another version, and approved it.
    const C = 'c'.repeat(64);
    fake.setProduct(P31, { plan: C });
    fake.endPm({ status: 'done', outcome: 'ready' }, approvedPlan(C));
    await run();
    expect(fake.techJobs()).toHaveLength(2);
    const D = 'd'.repeat(64);
    fake.setProduct(P31, { plan: D });
    fake.endTech(P31, { status: 'done', outcome: 'ready' }, reviewed(D));
    await run();
    expect(fake.pms()).toHaveLength(3);
    expect(fake.productJobs()).toEqual([]);
    expect(fake.mission()).toMatchObject({ status: 'waiting' });
    expect(fake.mission().waitingOn).toContain('PRD omni-loop-31: the PM and the Architect did not approve one plan version in 2 rounds; approve it on its page');
  });
});

describe('an Architect job with no record (AC-4)', () => {
  it('AC-4: records the tech decision escalated with "no record of the tech review", sends the Architect again, and a person gets the PRD once its two rounds left no record', async () => {
    const { fake, run, sentences } = await planned();
    const cut = '12:20:00 Done\nomni tech: {"v":1,"prd":"omni-loop-31","pl';
    fake.endTech(P31, { status: 'done', outcome: 'ready' }, cut);
    await run();
    expect(fake.planDecisions().at(-1)).toMatchObject({ kind: 'tech', plan: null, outcome: 'escalated', why: ['no record of the tech review'], techApproval: false });
    expect(sentences('job-ended')).toContain('The Architect left PRD omni-loop-31 to a person: no record of the tech review.');
    await run();
    expect(fake.techJobs()).toHaveLength(2);
    expect(sentences('dispatched').at(-1)).toBe('Sent the Architect /omni:tech-review omni-loop-31 --mission 12 again: its last job on PRD omni-loop-31 failed or left no record.');
    expect(fake.mission()).not.toMatchObject({ status: 'waiting' });

    fake.endTech(P31, { status: 'failed', outcome: null });
    await run();
    await run();
    expect(fake.mission()).toMatchObject({ status: 'waiting' });
    expect(fake.mission().waitingOn).toContain('PRD omni-loop-31: the Architect left it to you: no record of the tech review');
    expect(fake.techJobs()).toHaveLength(2);
    expect(fake.productJobs()).toEqual([]);
  });

  // AC-4, changed by bug #3286 (the owner's decision): the Architect's open points go back to the PM first, and a person gets the PRD
  // only once the Architect still escalates the version the PM answered with.
  it('an escalated review sends the PM again with the Architect\'s open points; a person gets it once the Architect still escalates, and their approval on the page sends the build', async () => {
    const { fake, run, sentences } = await planned();
    fake.endTech(P31, { status: 'done', outcome: 'ready' }, reviewed(A, { open: ['the export needs a person to pick its retention'], outcome: 'escalated' }));
    await run();
    expect(fake.pms()).toHaveLength(3);
    expect(sentences('dispatched').at(-1)).toBe('Sent the PM /omni:mega-brainstorm --product omni-loop --plan-only omni-loop-31 --mission 12 again: it answers the Architect\'s open points on PRD omni-loop-31.');
    expect(fake.mission()).not.toMatchObject({ status: 'waiting' });

    // The PM answered with a new version of its spec and plan, and approved it: the Architect reviews it, and still escalates.
    fake.setProduct(P31, { plan: B });
    fake.endPm({ status: 'done', outcome: 'ready' }, approvedPlan(B));
    await run();
    expect(fake.techJobs()).toHaveLength(2);
    fake.endTech(P31, { status: 'done', outcome: 'ready' }, reviewed(B, { open: ['the export needs a person to pick its retention'], outcome: 'escalated' }));
    await run();
    expect(fake.pms()).toHaveLength(3);
    expect(fake.mission().waitingOn).toContain('the Architect left it to you: the export needs a person to pick its retention');
    expect(fake.productJobs()).toEqual([]);
    fake.setProduct(P31, { approval: 'standing' });
    await run();
    expect(fake.productJobs()).toHaveLength(1);
  });

  it('a failed review is recorded escalated, naming the failure', async () => {
    const { fake, run } = await planned();
    fake.endTech(P31, { status: 'failed', reason: 'runner lost' });
    await run();
    expect(fake.planDecisions().at(-1)).toMatchObject({ kind: 'tech', outcome: 'escalated', why: ['no record of the tech review', 'its job failed'] });
  });
});

describe('a product PRD a person wrote', () => {
  it('is never planned or reviewed by the fleet: it waits for a person\'s approval on its page', async () => {
    const { fake, run } = setup({ mission: record({ products: { prds: [P40], roadmaps: [] }, ownPrds: 0 }), products: [page(P40, { plan: A })] });
    await run();
    expect(fake.pms()).toEqual([]);
    expect(fake.techJobs()).toEqual([]);
    expect(fake.productJobs()).toEqual([]);
    expect(fake.mission().waitingOn).toContain('PRD omni-loop-40: approve it on its page');
  });
});

// Bug #3302: a PM product PRD waiting on a person after the Architect's escalation, or once its rounds are spent, can be sent back to
// the PM by that person: one more PM round with the Architect's latest open points, the rounds counted again from the send-back, the
// decisions before it never edited (BR-PRODUCT-12).
describe('a person sends a PM product PRD back to the PM (bug #3302)', () => {
  const C = 'c'.repeat(64);
  const open = ['the export needs a person to pick its retention'];

  /** omni-loop-31 escalated by the Architect twice, its PM round spent: it waits on a person. */
  async function waiting() {
    const made = await planned();
    made.fake.endTech(P31, { status: 'done', outcome: 'ready' }, reviewed(A, { open, outcome: 'escalated' }));
    await made.run();
    made.fake.setProduct(P31, { plan: B });
    made.fake.endPm({ status: 'done', outcome: 'ready' }, approvedPlan(B));
    await made.run();
    made.fake.endTech(P31, { status: 'done', outcome: 'ready' }, reviewed(B, { open, outcome: 'escalated' }));
    await made.run();
    expect(made.fake.mission().waitingOn).toContain('PRD omni-loop-31: the Architect left it to you');
    expect(made.fake.pms()).toHaveLength(3);
    return made;
  }

  it('sends the PM its plan job once more, with the Architect\'s open points, and the person\'s event stays theirs', async () => {
    const { fake, run, sentences } = await waiting();
    const decided = fake.planDecisions();
    fake.sendBack(P31);
    await run();
    expect(fake.pms()).toHaveLength(4);
    expect(fake.pms().at(-1)?.line).toBe('/omni:mega-brainstorm --product omni-loop --plan-only omni-loop-31 --mission 12');
    expect(sentences('dispatched').at(-1)).toBe('Sent the PM /omni:mega-brainstorm --product omni-loop --plan-only omni-loop-31 --mission 12 again: a person sent PRD omni-loop-31 back to it, with the Architect\'s open points.');
    expect(fake.mission().waitingOn ?? '').not.toContain('the Architect left it to you');
    // The decisions recorded before the send-back are as they were (BR-PRODUCT-12), and the person's event is signed with their login.
    expect(fake.planDecisions().slice(0, decided.length)).toEqual(decided);
    expect(fake.events().filter((event) => event.kind === 'sent-back').map(({ actor, prd }) => [actor, prd])).toEqual([['ada', P31]]);
  });

  it('the rounds start again: the PM approves a new version, the Architect reviews it, and its approval sends the build', async () => {
    const { fake, run } = await waiting();
    fake.sendBack(P31);
    await run();
    fake.setProduct(P31, { plan: C });
    fake.endPm({ status: 'done', outcome: 'ready' }, approvedPlan(C));
    await run();
    expect(fake.techJobs()).toHaveLength(3);
    fake.endTech(P31, { status: 'done', outcome: 'ready' }, reviewed(C));
    await run();
    expect(fake.productJobs().map(({ key }) => key)).toEqual([`mission:${ID}:prd:omni-loop-31:run:1`]);
  });

  it('the Architect escalating again after the send-back gives the PM its second round, then the person again', async () => {
    const { fake, run } = await waiting();
    fake.sendBack(P31);
    await run();
    fake.setProduct(P31, { plan: C });
    fake.endPm({ status: 'done', outcome: 'ready' }, approvedPlan(C));
    await run();
    fake.endTech(P31, { status: 'done', outcome: 'ready' }, reviewed(C, { open, outcome: 'escalated' }));
    await run();
    expect(fake.pms()).toHaveLength(5);
    const D = 'd'.repeat(64);
    fake.setProduct(P31, { plan: D });
    fake.endPm({ status: 'done', outcome: 'ready' }, approvedPlan(D));
    await run();
    fake.endTech(P31, { status: 'done', outcome: 'ready' }, reviewed(D, { open, outcome: 'escalated' }));
    await run();
    expect(fake.pms()).toHaveLength(5);
    expect(fake.mission().waitingOn).toContain('PRD omni-loop-31: the Architect left it to you');
  });
});
