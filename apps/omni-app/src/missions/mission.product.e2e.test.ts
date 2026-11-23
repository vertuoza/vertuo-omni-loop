// A fake fleet takes a roadmap to its mission branches at `alone`, with no person until landing (PRD omni-loop-21 s15, AC-1 to AC-8).
// The real job handler runs against the in-memory store and a fake GitHub (feature and target pull requests, mission branches and
// mission pull requests, per repository); the runner's outcomes are handed out by the test. No database, no runner, no model call.
//
//   one repository   a two-row roadmap: PRD 10, with no plan on its page, then PRD 11, which waits for it. The PM plans PRD 10 and
//                    its committee approves it; its build ends halfway and is resumed; it fails and a repair fixes it, naming a bug
//                    outside the mission that the Engineer fixes on the branch; a high item bearing on a business law is carried by the
//                    members; both rows join; the mission lands with its Deferred decisions and its Re-test; a person overturns the
//                    carried item: the PRD is reworked on the branch, and the fleet notebook gains the line its next jobs print
//   two repositories a product roadmap whose row's plan names two repositories: a mission branch is cut in each, the row is built into
//                    both with --base-of and joins both, and the mission lands as two mission pull requests naming each other
import { describe, expect, it } from 'vitest';
import { committeeLine } from 'omni-loop/kit/lib/committee/record.ts';
import { parseIssue, parseOutboxItemId, parsePr, parsePrd, parseProductPrdId, parseProductRoadmapId, type PrdNumber, type PrNumber } from 'omni-loop/kit/lib/ids.ts';
import { overturnSentence } from 'omni-loop/kit/lib/mission/overturn.ts';
import { fingerprint } from 'omni-loop/kit/lib/repair/fingerprint.ts';
import { repairRecordLine } from 'omni-loop/kit/lib/repair/line.ts';
import { reviewMarker } from 'omni-loop/kit/lib/review/verdict.ts';
import { learnedBlock } from 'omni-loop/kit/lib/session/fleet-learned.ts';
import type { ClaimedJob } from '../jobs/ledger.ts';
import type { JobResult } from '../jobs/worker.ts';
import type { MissionBranches } from './branch.ts';
import type { PullRead } from './gate.ts';
import { MISSION_KIND, missionHandler, type MissionRetests } from './job.ts';
import type { MissionJoins, TargetPull } from './join.ts';
import type { BranchCommit, MissionLandings, MissionPull } from './landing.ts';
import { learnedLines } from './notebook.ts';
import type { MissionAgrees, MissionAnswers } from './settle.ts';
import { fakeMissionStore } from './store.fake.ts';
import type { MissionRecord, StoredProduct } from './store.ts';
import { expandScope, type PrdFacts, type RoadmapRow } from './supervisor.ts';

const ID = '7a1d2c3b-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const START = Date.parse('2027-01-22T09:00:00Z');
const MINUTE = 60_000;
const BRANCH = 'mission/12-faster-quotes';
const HEAD = 'c'.repeat(40);
const GALAXY = 'https://omni.example.com';
const ITEM = 's1-02-keep-the-cap';
const p = (n: number): PrdNumber => parsePrd(n);
const pr = (n: number): PrNumber => parsePr(n);

const claimed = (): ClaimedJob => ({
  id: 'bg-1',
  kind: MISSION_KIND,
  key: `mission:${ID}`,
  subject: 'acme/widgets',
  payload: { mission: ID },
  tries: 1,
  claim: 'claim-1',
  claimedUntil: new Date(START + 5 * MINUTE).toISOString(),
  progress: {},
  lane: `mission:${ID}`,
});

/** A pull request into the mission branch: green, the Reviewer's pass on its head, no item open. */
const green = (repo: string, number: number): PullRead => ({
  number,
  url: `https://github.com/${repo}/pull/${String(number)}`,
  title: `PRD work (#${String(number)})`,
  state: 'open',
  draft: false,
  merged: false,
  base: BRANCH,
  defaultBranch: 'main',
  head: HEAD,
  runs: [{ id: 1, name: 'test', status: 'completed', conclusion: 'success', title: null }],
  statuses: [],
  reviews: [{ body: `${reviewMarker(1, 'pass')}\n**Round 1 of 2: pass**`, commit: HEAD }],
  items: { ranks: [], open: [] },
});

/**
 * A GitHub of several repositories: pull requests into the mission branch (squash-merged onto it), the mission branch's commits, the
 * mission pull requests, the App's settlements and a reader of each PRD's criteria and proofs.
 */
function fakeGithub(targets: Readonly<Record<string, TargetPull[]>> = {}) {
  const key = (repo: string, number: number): string => `${repo}#${String(number)}`;
  const pulls = new Map<string, PullRead>();
  const commits = new Map<string, BranchCommit[]>();
  const missionPulls = new Map<string, MissionPull[]>();
  const prepared: string[] = [];
  const merged: string[] = [];
  const writes: { repo: string; pull: PrNumber | null; body: string }[] = [];
  const settled: string[] = [];
  let opened = 60;
  const pullOf = (repo: string, number: number): PullRead => pulls.get(key(repo, number)) ?? green(repo, number);
  const listOf = <T>(map: Map<string, T[]>, repo: string): T[] => {
    const list = map.get(repo) ?? [];
    map.set(repo, list);
    return list;
  };
  const branches: MissionBranches = {
    prepare: ({ repo, branch }) => {
      prepared.push(`${repo}:${branch}`);
      return Promise.resolve({ ok: true, cut: true });
    },
  };
  const joins: MissionJoins = {
    read: ({ repo, pr: number }) => Promise.resolve({ ...pullOf(repo, number) }),
    merge: ({ repo, pr: number }) => {
      pulls.set(key(repo, number), { ...pullOf(repo, number), merged: true, state: 'closed' });
      merged.push(key(repo, number));
      listOf(commits, repo).push({ sha: String(number).repeat(40).slice(0, 40), pr: pr(number) });
      return Promise.resolve({ ok: true });
    },
    targets: ({ prd }) => Promise.resolve(targets[prd] ?? []),
  };
  const landings: MissionLandings = {
    landings: ({ repo }) => Promise.resolve({ defaultBranch: 'main', pulls: listOf(missionPulls, repo).map((one) => ({ ...one })).reverse() }),
    branch: ({ repo }) => Promise.resolve({ commits: listOf(commits, repo).map((one) => ({ ...one })), link: 'Closes #{prd}' }),
    write: ({ repo, pull, title, body }) => {
      writes.push({ repo, pull, body });
      const mine = listOf(missionPulls, repo);
      const open = mine.find((one) => one.number === pull);
      if (open) {
        Object.assign(open, { title, body });
        return Promise.resolve({ ok: true, number: open.number, url: open.url, created: false });
      }
      opened += 1;
      const url = `https://github.com/${repo}/pull/${String(opened)}`;
      mine.push({ number: pr(opened), url, open: true, merged: false, title, body, carried: [] });
      return Promise.resolve({ ok: true, number: pr(opened), url, created: true });
    },
  };
  const answers: MissionAnswers & MissionAgrees = {
    settle: ({ repo, pr: number, item }) => {
      settled.push(`${item} on ${key(repo, number)}`);
      pulls.set(key(repo, number), { ...pullOf(repo, number), items: { ranks: [], open: [] } });
      return Promise.resolve({ ok: true, settled: true });
    },
    agree: () => Promise.resolve({ ok: true, settled: true }),
  };
  const retests: MissionRetests = {
    read: ({ prd }) =>
      Promise.resolve({
        criteria: [{ number: 1, kind: 'test', scenario: `PRD ${String(prd)} does what its spec says`, steps: [{ keyword: 'Given', text: 'the mission branch' }, { keyword: 'Then', text: 'it works' }], lines: [] }],
        proofs: [{ ac: 1, kind: 'test', state: 'passed', title: 'AC-1: it works', proof: `tests/${String(prd)}.test.ts` }],
      }),
  };
  /** The open mission pull request of `repo`: there must be one. */
  const missionPull = (repo: string): MissionPull => {
    const open = listOf(missionPulls, repo).find((one) => one.open);
    if (open === undefined) throw new Error(`no mission pull request is open in ${repo}`);
    return open;
  };
  return { pulls, branches, joins, landings, answers, retests, prepared, merged, writes, settled, missionPull, key };
}

/** A mission's run, a minute after the last, with the person's own events (signed with their login) beside the fleet's. */
function fleetOf(mission: MissionRecord, store: ReturnType<typeof fakeMissionStore>, gh: ReturnType<typeof fakeGithub>) {
  const people: { kind: 'overturned'; prd: PrdNumber | null; sentence: string; actor: string; at: string }[] = [];
  const read = { ...store.store, fleetEvents: async (id: string) => [...(await store.store.fleetEvents(id)), ...people.map(({ kind, prd, sentence, actor }) => ({ kind, prd, sentence, actor, link: null }))] };
  const clock = { now: START };
  const handler = missionHandler({ store: read, branches: gh.branches, joins: gh.joins, landings: gh.landings, answers: gh.answers, retests: gh.retests, galaxyUrl: GALAXY, refresh: () => Promise.resolve('again'), now: () => clock.now, log: () => undefined });
  const run = (): Promise<JobResult> => {
    clock.now += MINUTE;
    return handler(claimed());
  };
  /** A person overturns a decision of the fleet, as the route records it. */
  const overturn = (prd: PrdNumber | null, sentence: string) => people.push({ kind: 'overturned', prd, sentence, actor: 'ada', at: new Date(clock.now).toISOString() });
  return { run, people, overturn, mission };
}

// ── One repository ──────────────────────────────────────────────────────────────

const ROADMAP: RoadmapRow[][] = [
  [
    { prd: p(10), rowId: 'r1', blockers: [] },
    { prd: p(11), rowId: 'r2', blockers: ['r1'] },
  ],
];

const alone: MissionRecord = {
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
  hardToRevert: 0.5,
  ownPrds: 0,
  scope: { prds: [], roadmaps: [parseIssue(40)] },
};

/** PRD 10 has no plan on its page (no territory read) and no approval; PRD 11's stands, and it waits for PRD 10. */
const roadmapFacts = (): PrdFacts[] =>
  expandScope([], ROADMAP).map(({ prd, blockers }) => (prd === p(10) ? { prd, approval: 'none', stage: 'open', blockers, territory: null } : { prd, approval: 'standing', stage: 'open', blockers, territory: ['apps/invoices/'] }));

/** The committee approves PRD 10's plan, the PM sitting out. */
const approved = committeeLine({
  v: 1, prd: p(10), kind: 'approve', author: 'pm', read: [{ kind: 'plan', sha256: 'b'.repeat(64) }], escalations: [], outcome: 'carried',
  verdicts: [{ role: 'architect', answer: 'yes', sentence: 'Thin slices.' }, { role: 'reviewer', answer: 'yes', sentence: 'Tested.' }],
});

/** Every member answers yes to the high item bearing on a business law: carried, on the escalation list. */
const carried = `12:00:00 Done: ok\n${committeeLine({
  v: 1, prd: p(10), kind: 'answer', item: parseOutboxItemId(ITEM), option: 'A', author: null, read: [{ kind: 'item', sha256: 'a'.repeat(64) }],
  escalations: ['it bears on business law BL-QUOTES-1'], outcome: 'carried',
  verdicts: [
    { role: 'pm', answer: 'yes', sentence: 'In scope.' },
    { role: 'architect', answer: 'yes', sentence: 'Reversible.' },
    { role: 'reviewer', answer: 'yes', sentence: 'Tested.' },
  ],
})}`;

/** What `/omni:repair` ends on for PRD 10: a code cause, its fix #51 into the mission branch, and a bug outside the mission named. */
function repaired(): string {
  const cause = { class: 'code' as const, place: 'apps/quotes/total.ts', signature: 'AssertionError: expected 10.01 to be 10' };
  const print = fingerprint(cause);
  const retro = { cause: 'The quote total is not rounded.', ...cause, evidence: ['The test compares an unrounded total.'], proposedFix: 'Round the total before it is compared.', fingerprint: print };
  const record = repairRecordLine({ v: 1, mission: 12, prd: p(10), fingerprint: print, class: 'code', retro, fix: parsePr(51), report: null });
  return `02:20:00 ${record}\n02:20:01 omni outside-bug: #44 on acme/widgets: The login page crashes on an empty email.`;
}

describe('a fake fleet takes a two-row roadmap of one repository to landing at alone (PRD omni-loop-21, AC-1 to AC-8)', () => {
  it('AC-7: plans, approves, resumes, repairs, carries a business-law item, joins both rows, lands with both lists, and remembers an overturn', async () => {
    const gh = fakeGithub();
    const fake = fakeMissionStore({ mission: alone, facts: roadmapFacts(), retros: { roadmaps: [] }, team: { bugs: [] } });
    const { run, overturn } = fleetOf(alone, fake, gh);
    const lines = () => fake.jobs().map((job) => job.line);
    const said = (kind: string) => fake.events().filter((event) => event.kind === kind).map((event) => event.sentence);

    // AC-3: PRD 10 has no plan on its page: the PM plans it before any approval; PRD 11 waits for it.
    await run();
    expect(fake.pms().map((one) => one.line)).toEqual(['/omni:plan 10']);
    expect(fake.committees()).toEqual([]);
    expect(lines()).toEqual([]);
    fake.endPm({ status: 'done' }, '12:00:00 Done');
    fake.set(p(10), { territory: ['apps/quotes/'] });
    await run();
    expect(fake.committees().map((one) => one.line)).toEqual(['/omni:committee 10 --approve --author pm']);
    fake.endCommittee(p(10), { status: 'done' }, approved);
    await run();
    expect(lines()).toEqual([`/omni:yolo 10 --for-review --base ${BRANCH}`]);

    // AC-6: its build ends without its result line: one fresh job of the same skill takes it on.
    fake.end(p(10), { status: 'done', outcome: null });
    await run();
    expect(fake.jobs().map((job) => job.key)).toEqual([`mission:${ID}:prd:10:run:1`, `mission:${ID}:prd:10:run:1:resume:1`]);
    expect(said('held')).toContain('PRD 10 ended without its result line: the mission sends it a fresh job (resume 1 of 3).');

    // It fails: a repair lands its fix on the branch and sends the step again; the bug it named outside the mission goes to the Engineer.
    fake.end(p(10), { status: 'failed', reason: 'exit code 1' });
    await run();
    expect(fake.repairJobs()).toHaveLength(1);
    fake.endRepairJob(p(10), { status: 'done' }, repaired());
    await run();
    expect(gh.merged).toContain('acme/widgets#51');
    expect(fake.bugJobs().map((job) => job.line)).toEqual([`/omni:bug-fix #44 --base ${BRANCH}`]);
    fake.endBug(44, { status: 'done', outcome: 'pr-opened', prUrl: 'https://github.com/acme/widgets/pull/77' });
    await run();
    expect(gh.merged).toContain('acme/widgets#77');
    expect(said('bug-fixed')).toEqual(['acme/widgets#44 is fixed on the mission branch by #77.']);

    // AC-5: the step ends waiting on a high item that bears on a business law: the members carry it, the App settles it for the
    // mission branch only, and PRD 10 goes on, built again.
    gh.pulls.set(gh.key('acme/widgets', 31), { ...green('acme/widgets', 31), items: { ranks: ['high'], open: [{ id: ITEM, rank: 'high' }] } });
    fake.end(p(10), { status: 'done', outcome: 'answers', prUrl: 'https://github.com/acme/widgets/pull/31' });
    await run();
    expect(fake.asks().map((one) => one.item)).toEqual([ITEM]);
    fake.endAsk(ITEM, { status: 'done' }, carried);
    await run();
    expect(gh.settled).toEqual([`${ITEM} on acme/widgets#31`]);
    expect((await fake.store.decisions(ID)).map(({ kind, item, outcome }) => [kind, item, outcome])).toEqual([['approve', null, 'carried'], ['answer', ITEM, 'carried']]);
    expect(said('escalated')).toEqual([]);

    // Both rows end Ready and join the branch through the merge gate, PRD 11 once PRD 10 is on it (AC-1: in wave order).
    fake.end(p(10), { status: 'done', outcome: 'ready', prUrl: 'https://github.com/acme/widgets/pull/31' });
    await run();
    expect(said('prd-joined')).toHaveLength(1);
    expect(gh.missionPull('acme/widgets').body).not.toContain('**Re-test**');
    expect(lines().at(-1)).toBe(`/omni:yolo 11 --for-review --base ${BRANCH}`);
    fake.end(p(11), { status: 'done', outcome: 'ready', prUrl: 'https://github.com/acme/widgets/pull/42' });
    await run();
    expect(said('prd-joined')).toHaveLength(2);

    // AC-7: every row joined: the mission lands. One mission pull request lists the carried decision with Agree and Overturn, and,
    // per PRD, its criteria with their proof and the steps by hand, then the bug fixed outside the mission.
    const landed = gh.missionPull('acme/widgets').body;
    expect(landed).toContain('**Deferred decisions**');
    expect(landed).toContain(`- ${ITEM} of PRD 10 · carried by the fleet, option A · on the escalation list`);
    expect(landed).toContain(`[Overturn](${GALAXY}/app/fleet?fleet=night-shift&tab=missions&mission=12&decision=10%2F${ITEM}&answer=overturn)`);
    expect(landed).toContain('*PRD 10*\n\n- AC-1 · test · PRD 10 does what its spec says: passed, `tests/10.test.ts`');
    expect(landed).toContain('*PRD 11*\n\n- AC-1 · test · PRD 11 does what its spec says: passed, `tests/11.test.ts`');
    expect(landed).toContain('- [ ] AC-1: Given the mission branch; Then it works');
    expect(landed).toContain('*Outside bugs*\n\n- Fixed by #77 · acme/widgets#44 (named by a repair): The login page crashes on an empty email');
    expect(landed).not.toContain('The others:');
    expect(fake.mission()).toMatchObject({ status: 'waiting' });

    // AC-8: a person overturns the carried item: the PRD is reworked on the mission branch, once, and the pull request says so.
    overturn(p(10), overturnSentence('ada', { prd: p(10), item: ITEM }, 'raise the cap instead'));
    await run();
    await run();
    expect(fake.cares().map((one) => one.line)).toEqual([`/omni:yolo-fix 10 --base ${BRANCH}`]);
    expect(gh.missionPull('acme/widgets').body).toContain(`- ${ITEM} of PRD 10 · carried by the fleet, option A · on the escalation list: it bears on business law BL-QUOTES-1. Overturned by ada: the fleet reworks PRD 10 on the mission branch.`);

    // The fleet notebook gains the overturn's line, and the resume's, which the next PM, committee and Engineer jobs print.
    const events = [
      ...fake.events().map((event, n) => ({ id: `e${String(n)}`, at: event.at, role: event.role, kind: event.kind, prd: typeof event.prd === 'number' ? event.prd : null, sentence: event.sentence })),
      { id: 'person-1', at: '2027-01-22T12:00:00.000Z', role: 'supervisor', kind: 'overturned', prd: p(10), sentence: overturnSentence('ada', { prd: p(10), item: ITEM }, 'raise the cap instead') },
    ];
    const learned = learnedLines({ events, kept: [] }).map((one) => one.line);
    expect(learned).toContain(`PRD 10: the fleet answered ${ITEM} with option A; ada overturned that answer.`);
    expect(learned).toContain('PRD 10 ended without its result line; a fresh job of the same skill took it on (resume 1 of 3).');
    const block = learnedBlock({ role: 'pm', lines: learned.map((line) => ({ day: '2027-01-22', line, events: [] })) });
    expect(block[0]).toBe('What this fleet learned');
    expect(block.join('\n')).toContain(`ada overturned that answer.`);

    // Nothing reached the default branch: every merge went into the mission branch, and no mission pull request was merged.
    expect(gh.writes.every((one) => one.repo === 'acme/widgets')).toBe(true);
    expect(gh.missionPull('acme/widgets').merged).toBe(false);
  });
});

// ── Two repositories ────────────────────────────────────────────────────────────

const R3 = parseProductRoadmapId('omni-loop-R3');
const P15 = parseProductPrdId('omni-loop-15');
const PRODUCT_ITEM = 's2-01-keep-the-shape';

describe('a fake fleet takes a product row over two repositories to two mission pull requests (PRD omni-loop-21, AC-1, AC-2, AC-7, AC-8)', () => {
  it('AC-2: cuts a mission branch in both, builds the row into both with --base-of, joins both, and lands two mission pull requests naming each other', async () => {
    const gh = fakeGithub({ [P15]: [{ repo: 'acme/widgets', pr: pr(31) }, { repo: 'acme/api', pr: pr(32) }] });
    const mission: MissionRecord = { ...alone, scope: { prds: [], roadmaps: [] }, products: { prds: [], roadmaps: [R3] } };
    const row: StoredProduct = { prd: P15, approval: 'standing', blockers: [], targets: ['acme/widgets', 'acme/api'], items: { ranks: [], open: [] } };
    const fake = fakeMissionStore({ mission, facts: [], products: [row] });
    const { run, overturn } = fleetOf(mission, fake, gh);

    // AC-1, AC-2: the roadmap's row is read, a mission branch is cut in each repository its plan names, and it is built into both.
    await run();
    expect(gh.prepared).toEqual([`acme/widgets:${BRANCH}`, `acme/api:${BRANCH}`]);
    expect(fake.productJobs().map((one) => one.line)).toEqual([`/omni:ultra-yolo omni-loop-15 --base-of acme/widgets=${BRANCH},acme/api=${BRANCH}`]);
    expect((await fake.store.branches(ID)).map((one) => `${one.repo}:${one.branch}`)).toEqual([`acme/widgets:${BRANCH}`, `acme/api:${BRANCH}`]);

    // The members defer an item of the row; the row ends Ready and its two target pull requests join their mission branches.
    await fake.store.decideItem(fake.mission(), { prd: P15, item: PRODUCT_ITEM, job: 'ask-1', verdicts: [], decision: { outcome: 'deferred', why: ['the Architect answered no'], option: 'A' } });
    fake.endProduct(P15, { status: 'done', outcome: 'ready' });
    await run();
    expect(gh.merged).toEqual(['acme/widgets#31', 'acme/api#32']);

    // AC-7: one mission pull request per repository, each naming the other, each with the deferred decision and the row's Re-test.
    const widgets = gh.missionPull('acme/widgets');
    const api = gh.missionPull('acme/api');
    expect(widgets.body).toContain(`The others: [acme/api#${String(api.number)}](${api.url}).`);
    expect(api.body).toContain(`The others: [acme/widgets#${String(widgets.number)}](${widgets.url}).`);
    for (const body of [widgets.body, api.body]) {
      expect(body).toContain(`- ${PRODUCT_ITEM} of PRD omni-loop-15 · deferred, option A taken meanwhile · the Architect answered no.`);
      expect(body).toContain('*PRD omni-loop-15*\n\n- AC-1 · test · PRD omni-loop-15 does what its spec says: passed');
    }
    const writes = gh.writes.length;
    await run();
    expect(gh.writes).toHaveLength(writes);

    // AC-8: an overturn reworks the row on both mission branches, once.
    overturn(null, `ada overturned fleet decision ${P15}/${PRODUCT_ITEM}: keep the old shape`);
    await run();
    await run();
    expect(fake.cares().map((one) => one.line)).toEqual([`/omni:ultra-yolo-fix omni-loop-15 --base-of acme/widgets=${BRANCH},acme/api=${BRANCH}`]);
    expect(gh.missionPull('acme/api').body).toContain('Overturned by ada: the fleet reworks PRD omni-loop-15 on the mission branch.');
  });
});
