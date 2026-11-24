// A fake fleet takes a mission from a goal alone to its mission pull request (PRD omni-loop-24 s7, AC-3, AC-4, AC-6 end to end).
// The real job handler runs against the in-memory store, a fake GitHub of one repository (the mission branch, the pull requests
// into it, the mission pull request) and runner outcomes the test hands out. No database, no runner, no model call, no page: the
// App imports nothing from the arcade (./boundary.ts), so the New mission box's side is read through the kit's own pieces, the
// request the page answers, the runner's line and the brief the skill writes, and the brief's mission is started as mission_push()
// starts it, running.
//
//   from the box     a request holds the goal word for word; its job `/omni:mission --request <id>` is taken by a runner, a goal in
//                    the line is not; the brief the skill writes names the request and reads goal-only, at alone, ownPrds 10
//   the PM writes    its first job is the roadmap at the cap, the mission running and never delivered while it writes; its record
//                    adds PRDs 50 and 51, each `added by the fleet`
//   the fleet builds the committee approves each, the PM sitting out; each is built for review on the mission branch and joins it;
//                    the mission pull request opens, listing what the fleet approved, and waits for the person who merges it
//   nothing written  a PM job that names no PRD is sent once more; when that one writes none either, the mission waits with
//                    `the PM wrote no PRD for the goal: <why>`, no PRD built, no mission pull request, never delivered
import { describe, expect, it } from 'vitest';
import { committeeLine } from 'omni-loop/kit/lib/committee/record.ts';
import { parseIssue, parsePr, parsePrd, type PrdNumber, type PrNumber } from 'omni-loop/kit/lib/ids.ts';
import { parseBrief } from 'omni-loop/kit/lib/mission/brief.ts';
import { readRequest } from 'omni-loop/kit/lib/mission/request.ts';
import { reviewMarker } from 'omni-loop/kit/lib/review/verdict.ts';
import { checkRunnerLine } from 'omni-loop/kit/lib/runner/line.ts';
import { pmLine } from 'omni-loop/kit/lib/virtual-fleet/pm.ts';
import type { ClaimedJob } from '../jobs/ledger.ts';
import type { MissionBranches } from './branch.ts';
import type { PullRead } from './gate.ts';
import { MISSION_KIND, missionHandler } from './job.ts';
import type { MissionJoins } from './join.ts';
import type { BranchCommit, MissionLandings, MissionPull } from './landing.ts';
import { fakeMissionStore } from './store.fake.ts';
import type { MissionRecord } from './store.ts';
import { missionBranch, type PrdFacts } from './supervisor.ts';

const ID = '9c4e2b7a-1d3f-4a5b-8e6c-0f1a2b3c4d5e';
const REQUEST = '3f2a9c1e-7b4d-4e8a-9c2f-1a2b3c4d5e6f';
const REPO = 'acme/widgets';
const GOAL = 'Every quote can be paid online, by card or transfer.';
const START = Date.parse('2027-01-29T09:00:00Z');
const MINUTE = 60_000;
const HEAD = 'd'.repeat(40);
const p = (n: number): PrdNumber => parsePrd(n);
const pr = (n: number): PrNumber => parsePr(n);

/** The page's answer to `GET /api/missions/requests/<id>`: the goal word for word, the fleet, who pressed Start. */
const answered = { request: { id: REQUEST, fleet: 'night-shift', goal: GOAL, requestedBy: 'ada' } };

/** The mission.md `/omni:mission --request` writes from the request, under OMNI_UNATTENDED: no scope, no measure, at alone. */
const written = (goal: string, fleet: string): string =>
  ['---', 'mission: 12', 'title: Quotes paid online', `fleet: ${fleet}`, `goal: ${JSON.stringify(goal)}`, `request: ${REQUEST}`, 'mandate:', '  level: alone', '---', '', '# Quotes paid online', ''].join('\n');

/** The mission mission_push() starts from that brief, as the request's person: running at once, its PM's cap the brief's. */
function started(source: string): MissionRecord {
  const read = parseBrief(source);
  if (!read.ok) throw new Error(read.errors.join(' '));
  const { brief } = read;
  if (brief.scope.prds.length + brief.scope.roadmaps.length > 0) throw new Error('the brief is not goal-only');
  return {
    id: ID,
    workspace: 'ws-1',
    repo: REPO,
    fleet: brief.fleet,
    number: parseIssue(brief.mission),
    title: brief.title,
    level: brief.mandate.level,
    status: 'running',
    waitingOn: null,
    parallel: brief.mandate.parallel,
    hardToRevert: brief.mandate.hardToRevert,
    ownPrds: brief.mandate.ownPrds,
    resumes: brief.mandate.resumes,
    scope: { prds: [], roadmaps: [] },
  };
}

const claimed = (): ClaimedJob => ({
  id: 'bg-1',
  kind: MISSION_KIND,
  key: `mission:${ID}`,
  subject: REPO,
  payload: { mission: ID },
  tries: 1,
  claim: 'claim-1',
  claimedUntil: new Date(START + 5 * MINUTE).toISOString(),
  progress: {},
  lane: `mission:${ID}`,
});

/** The PRDs the PM's roadmap writes: each on its page with no approval yet, its plan's territory its own. */
const written50 = (): PrdFacts => ({ prd: p(50), approval: 'none', stage: 'open', blockers: [], territory: ['apps/quotes/pay/'] });
const written51 = (): PrdFacts => ({ prd: p(51), approval: 'none', stage: 'open', blockers: [], territory: ['apps/invoices/transfer/'] });

/** One repository's GitHub as the mission sees it: its mission branch, the pull requests into it, and its mission pull request. */
function oneRepository(branch: string) {
  const prepared: string[] = [];
  const merged: number[] = [];
  const commits: BranchCommit[] = [];
  const opened: MissionPull[] = [];
  const read = (number: number): PullRead => ({
    number, url: `https://github.com/${REPO}/pull/${String(number)}`, title: `PRD work (#${String(number)})`, state: merged.includes(number) ? 'closed' : 'open',
    draft: false, merged: merged.includes(number), base: branch, defaultBranch: 'main', head: HEAD,
    runs: [{ id: 1, name: 'test', status: 'completed', conclusion: 'success', title: null }], statuses: [],
    reviews: [{ body: `${reviewMarker(1, 'pass')}\n**Round 1 of 2: pass**`, commit: HEAD }], items: { ranks: [], open: [] },
  });
  const branches: MissionBranches = {
    prepare: (at) => {
      prepared.push(`${at.repo}:${at.branch}`);
      return Promise.resolve({ ok: true, cut: true });
    },
  };
  const joins: MissionJoins = {
    read: (at) => Promise.resolve(read(at.pr)),
    merge: (at) => {
      merged.push(at.pr);
      commits.push({ sha: String(at.pr).padEnd(40, '0'), pr: pr(at.pr) });
      return Promise.resolve({ ok: true });
    },
  };
  const landings: MissionLandings = {
    landings: () => Promise.resolve({ defaultBranch: 'main', pulls: opened.map((one) => ({ ...one })) }),
    branch: () => Promise.resolve({ commits: commits.map((one) => ({ ...one })), link: 'Closes #{prd}' }),
    write: ({ pull, title, body }) => {
      const open = opened.find((one) => one.number === pull);
      if (open !== undefined) {
        Object.assign(open, { title, body });
        return Promise.resolve({ ok: true, number: open.number, url: open.url, created: false });
      }
      const number = pr(90 + opened.length);
      const url = `https://github.com/${REPO}/pull/${String(number)}`;
      opened.unshift({ number, url, open: true, merged: false, title, body, carried: [] });
      return Promise.resolve({ ok: true, number, url, created: true });
    },
  };
  return { branches, joins, landings, prepared, merged, opened };
}

/**
 * The mission's run, a minute after the last, over the fake store and the one repository. The PRDs the PM writes are on their pages,
 * `written`; once the committee carries one, its approval stands for the mission, as mission_decide_approval() keeps it (the fake
 * store does so for the PRDs it was seeded with only).
 */
function fleetOf(mission: MissionRecord, written: readonly PrdFacts[]) {
  const github = oneRepository(missionBranch(mission.number, mission.title));
  const standing = new Set<PrdNumber>();
  const pages = written.map((fact) => Object.defineProperty({ ...fact }, 'approval', { enumerable: true, get: () => (standing.has(fact.prd) ? 'standing' : fact.approval) }));
  const fake = fakeMissionStore({ mission, facts: [], pages });
  const store = {
    ...fake.store,
    decide: async (...args: Parameters<typeof fake.store.decide>) => {
      const decision = await fake.store.decide(...args);
      if (decision.outcome === 'carried') standing.add(args[1].prd);
      return decision;
    },
  };
  const clock = { now: START };
  const handler = missionHandler({ store, branches: github.branches, joins: github.joins, landings: github.landings, refresh: () => Promise.resolve('again'), now: () => clock.now, log: () => undefined });
  const run = async (): Promise<void> => {
    clock.now += MINUTE;
    await handler(claimed());
  };
  const said = (kind: string): string[] => fake.events().filter((event) => event.kind === kind).map((event) => event.sentence);
  return { fake, github, run, said };
}

/** The PM's record: the PRDs its roadmap wrote for mission 12 at the cap. */
const roadmapWrote = (prds: number[]): string => `12:00:00 Done\n${pmLine({ v: 1, mission: 12, skill: 'roadmap', cap: 10, prds: prds.map(p), unwritten: [] })}`;

/** The committee approves the PRD the PM wrote: the Architect and the Reviewer, the PM sitting out. */
const approvedBy = (prd: PrdNumber): string =>
  committeeLine({
    v: 1, prd, kind: 'approve', author: 'pm', read: [{ kind: 'spec', sha256: 'a'.repeat(64) }, { kind: 'plan', sha256: 'b'.repeat(64) }], escalations: [], outcome: 'carried',
    verdicts: [{ role: 'architect', answer: 'yes', sentence: 'Thin slices.' }, { role: 'reviewer', answer: 'yes', sentence: 'Each criterion has its test.' }],
  });

describe('a mission from a goal alone, from the New mission box to the mission pull request (PRD omni-loop-24)', () => {
  it('AC-6: the request\'s job is taken by a runner, and the brief it writes is goal-only at alone, the goal word for word', () => {
    const request = readRequest(answered);
    expect(request).toEqual({ fleet: 'night-shift', goal: GOAL });
    expect(checkRunnerLine(`/omni:mission --request ${REQUEST}`)).toMatchObject({ ok: true, skill: 'mission' });
    expect(checkRunnerLine('/omni:mission --goal dark-mode')).toEqual({ ok: false, reason: '/omni:mission runs on a runner from the New mission box only' });
    const brief = parseBrief(written(GOAL, 'night-shift'));
    expect(brief.ok && brief.brief).toMatchObject({ goal: GOAL, request: REQUEST, measures: [], scope: { prds: [], roadmaps: [] }, mandate: { level: 'alone', ownPrds: 10 } });
  });

  it('AC-3: the PM\'s roadmap writes two PRDs, the committee approves them, each joins the mission branch, and the mission pull request opens', async () => {
    const request = readRequest(answered);
    if (request === null) throw new Error('the page answered no request');
    const mission = started(written(request.goal, request.fleet));
    const branch = missionBranch(mission.number, mission.title);
    const { fake, github, run, said } = fleetOf(mission, [written50(), written51()]);

    // The PM's first job is the roadmap at the cap, sent to the fleet; a runner takes its line at alone. The mission runs meanwhile.
    await run();
    expect(fake.pms().map(({ line, toFleet }) => [line, toFleet])).toEqual([['/omni:roadmap --mission 12 --cap 10', 'night-shift']]);
    expect(checkRunnerLine('/omni:roadmap --mission 12 --cap 10')).toMatchObject({ ok: true, skill: 'roadmap' });
    expect(said('dispatched')).toContain('Sent the PM /omni:roadmap for the mission\'s goal: 10 PRDs at most.');
    await run();
    expect(fake.mission()).toMatchObject({ status: 'running' });
    expect(fake.jobs()).toEqual([]);

    // Its record names PRDs 50 and 51: both join the scope, added by the fleet, and go to the committee, the PM sitting out.
    fake.endPm({ status: 'done' }, roadmapWrote([50, 51]));
    await run();
    await run();
    expect(said('prd-added')).toEqual(['PRD 50 added by the fleet.', 'PRD 51 added by the fleet.']);
    expect(fake.committees().map((one) => one.line)).toEqual(['/omni:committee 50 --approve --author pm', '/omni:committee 51 --approve --author pm']);
    expect(fake.jobs()).toEqual([]);
    fake.endCommittee(p(50), { status: 'done' }, approvedBy(p(50)));
    fake.endCommittee(p(51), { status: 'done' }, approvedBy(p(51)));
    await run();
    expect(fake.committees().map((one) => one.decision?.outcome)).toEqual(['carried', 'carried']);

    // Approved, each is built for review on the mission branch, the one branch the mission prepares.
    await run();
    expect(new Set(github.prepared)).toEqual(new Set([`${REPO}:${branch}`]));
    expect(fake.jobs().map((job) => job.line)).toEqual([`/omni:yolo 50 --for-review --base ${branch}`, `/omni:yolo 51 --for-review --base ${branch}`]);
    expect(fake.mission().status).toBe('running');

    // Both builds end Ready: each pull request joins the mission branch through the merge gate, and the mission pull request opens.
    fake.end(p(50), { status: 'done', outcome: 'ready', prUrl: `https://github.com/${REPO}/pull/31` });
    fake.end(p(51), { status: 'done', outcome: 'ready', prUrl: `https://github.com/${REPO}/pull/32` });
    await run();
    await run();
    expect(github.merged).toEqual([31, 32]);
    expect(said('prd-joined')).toHaveLength(2);
    expect(github.opened).toHaveLength(1);
    const landed = github.opened[0];
    expect(landed).toMatchObject({ open: true, merged: false, title: 'Mission #12: Quotes paid online' });
    expect(landed?.body.startsWith('**Approved by the fleet**\n\n- PRD 50: architect yes, reviewer yes.')).toBe(true);
    expect(landed?.body).toContain('- PRD 51: architect yes, reviewer yes.');
    expect(landed?.body).toContain('**Re-test**');
    expect(landed?.body).toContain('Closes #50\nCloses #51');

    // Only a person merges it (N-PRODUCT-15): the mission waits to land, never delivered, and no PM job was sent again.
    expect(fake.mission()).toMatchObject({ status: 'waiting', waitingOn: `on ${branch}, to land: PRD 50, PRD 51` });
    expect(fake.pms()).toHaveLength(1);
  });

  it('AC-4: a PM that writes no PRD is sent once more, then the mission waits with its line, nothing built and nothing landed', async () => {
    const { fake, github, run, said } = fleetOf(started(written(GOAL, 'night-shift')), [written50()]);
    await run();
    fake.endPm({ status: 'done' }, roadmapWrote([]));
    await run();
    expect(fake.pms().map((one) => one.line)).toEqual(['/omni:roadmap --mission 12 --cap 10', '/omni:roadmap --mission 12 --cap 10']);
    expect(said('dispatched')).toContain('Sent the PM /omni:roadmap once more for the mission\'s goal: its last job wrote no PRD.');
    expect(fake.mission().status).toBe('running');

    fake.endPm({ status: 'done' }, '12:00:00 Done');
    await run();
    await run();
    expect(fake.pms()).toHaveLength(2);
    expect(fake.mission()).toMatchObject({ status: 'waiting', waitingOn: 'the PM wrote no PRD for the goal: /omni:roadmap ended with no PRD in its record, sent twice.' });
    expect(said('prd-added')).toEqual([]);
    expect(fake.committees()).toEqual([]);
    expect(fake.jobs()).toEqual([]);
    expect(github.opened).toEqual([]);
    expect(fake.mission().status).not.toBe('delivered');
  });

  it('#3203: a person\'s Resume of the mission waiting on no PRD sends the PM\'s roadmap once more, then it waits again with its reason', async () => {
    const { fake, run, said } = fleetOf(started(written(GOAL, 'night-shift')), [written50()]);
    await run();
    fake.endPm({ status: 'done' }, roadmapWrote([]));
    await run();
    fake.endPm({ status: 'done' }, '12:00:00 Done');
    await run();
    await run();
    expect(fake.mission()).toMatchObject({ status: 'waiting', waitingOn: 'the PM wrote no PRD for the goal: /omni:roadmap ended with no PRD in its record, sent twice.' });

    // The person presses Resume on the row: one more round of the same roadmap line, the mission running while the PM writes.
    fake.resume();
    await run();
    expect(fake.pms().map((one) => one.line)).toEqual(['/omni:roadmap --mission 12 --cap 10', '/omni:roadmap --mission 12 --cap 10', '/omni:roadmap --mission 12 --cap 10']);
    expect(said('dispatched').filter((one) => one.includes('once more'))).toHaveLength(2);
    expect(fake.mission().status).toBe('running');

    // It writes none again: the mission waits again with its reason, and nothing more is sent until a person resumes it again.
    fake.endPm({ status: 'done' }, roadmapWrote([]));
    await run();
    await run();
    expect(fake.pms()).toHaveLength(3);
    expect(fake.mission()).toMatchObject({ status: 'waiting', waitingOn: 'the PM wrote no PRD for the goal: /omni:roadmap ended with no PRD in its record, sent 3 times.' });
  });
});
