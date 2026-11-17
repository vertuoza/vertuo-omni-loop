// A fake fleet hands each build to the Reviewer (PRD 2871 s5). The real supervisor and the real job handler run
// against the ledger's in-memory store and runner ends the test hands out: no database, no runner, no model call,
// no GitHub. Two PRDs named alone, on ground of their own: PRD 30 passes in round 1, PRD 31 goes changes, fix,
// pass; a third, PRD 32, runs out of rounds and waits on a person. Beside `mission.e2e.test.ts`, which proves
// BR-PRODUCT-139. Since PRD 3001 QA checks each build first, and passes it here (`qa.e2e.test.ts` follows its bugs).
import { describe, expect, it } from 'vitest';
import { parseIssue, parsePrd, type PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import { qaLine } from 'omni-loop/kit/lib/qa/verdict.ts';
import type { ClaimedJob } from '../jobs/ledger.ts';
import { MISSION_KIND, missionHandler } from './job.ts';
import { fakeMissionStore } from './store.fake.ts';
import type { MissionRecord } from './store.ts';
import type { PrdFacts } from './supervisor.ts';

const ID = '9e1d4b7c-0a26-4c3f-b5e8-6d7f8a9b0c12';
const T0 = Date.parse('2027-01-23T08:00:00Z');
const prd = (n: number): PrdNumber => parsePrd(n);
const pr = (n: number) => `https://github.com/acme/gadgets/pull/${String(n)}`;
const review = (n: number, id: number) => `${pr(n)}#pullrequestreview-${String(id)}`;

/** A mission of the PRDs `prds`, each on ground of its own, three at once. */
function reviewed(prds: number[]) {
  const record: MissionRecord = { id: ID, workspace: 'ws-2', repo: 'acme/gadgets', fleet: 'day-shift', number: parseIssue(12), title: 'Faster quotes', level: 'with-you', status: 'running', waitingOn: null, parallel: 3, scope: { prds: prds.map(prd), roadmaps: [] } };
  const facts: PrdFacts[] = prds.map((n) => ({ prd: prd(n), approval: 'standing', stage: 'open', blockers: [], territory: [`packages/part-${String(n)}/`] }));
  const fake = fakeMissionStore({ mission: record, facts });
  let now = T0;
  const handler = missionHandler({ store: fake.store, refresh: () => Promise.resolve('again'), now: () => now, log: () => undefined });
  const job: ClaimedJob = { id: 'bg-9', kind: MISSION_KIND, key: `mission:${ID}`, subject: 'acme/gadgets', payload: { mission: ID }, tries: 1, claim: 'claim-9', claimedUntil: new Date(T0 + 600_000).toISOString(), progress: {}, lane: `mission:${ID}` };
  /** One run of the mission, a minute after the last. */
  const tick = async () => {
    now += 60_000;
    await handler(job);
  };
  /** Two runs of the mission at once, reading the same state. */
  const twice = async () => {
    fake.together(2);
    await Promise.all([handler(job), handler(job)]);
  };
  const linesOf = (n: number) => fake.jobs().filter((one) => one.prd === prd(n)).map((one) => one.line);
  return { fake, tick, twice, linesOf };
}

/** QA passes PRD `n` in round 1 on its feature pull request `on` (PRD 3001): its job ends on the line `/omni:qa` prints. */
function qaPasses(fake: ReturnType<typeof reviewed>['fake'], n: number, on: number) {
  fake.end(prd(n), { status: 'done', prUrl: pr(on), checked: qaLine(`omni qa: posted round 1 (pass) on PR #${String(on)}: ${pr(on)}#issuecomment-1`) });
}

describe('a fake fleet hands each build to the Reviewer (PRD 2871 s5)', () => {
  it('PRD 30 passes in round 1; PRD 31 goes changes, fix, pass; nothing is sent twice', async () => {
    const { fake, tick, twice, linesOf } = reviewed([30, 31]);
    await tick();
    expect(fake.jobs().map((one) => one.line)).toEqual(['/omni:yolo 30 --for-review', '/omni:yolo 31 --for-review']);

    // Both builds ship and leave their PR a draft: QA checks each first (PRD 3001), then, on its pass, the Reviewer's round 1
    // goes for each, under its own key.
    fake.end(prd(30), { status: 'done', outcome: 'review', prUrl: pr(70) });
    fake.end(prd(31), { status: 'done', outcome: 'review', prUrl: pr(71) });
    await tick();
    qaPasses(fake, 30, 70);
    qaPasses(fake, 31, 71);
    await tick();
    expect(fake.jobs().slice(4).map((one) => [one.line, one.key])).toEqual([
      ['/omni:review 30', `mission:${ID}:prd:30:run:1:review:1`],
      ['/omni:review 31', `mission:${ID}:prd:31:run:1:review:1`],
    ]);

    // PRD 30 passes: the Reviewer marked it ready, it waits for a merge. PRD 31 gets two findings: the fix goes.
    fake.end(prd(30), { status: 'done', outcome: 'ready', prUrl: pr(70), posted: { findings: 0, url: review(70, 1) } });
    fake.end(prd(31), { status: 'done', outcome: 'changes', prUrl: pr(71), posted: { findings: 2, url: review(71, 2) } });
    await tick();
    expect(fake.jobs().at(-1)).toMatchObject({ line: '/omni:yolo-fix 31 --for-review', key: `mission:${ID}:prd:31:run:1:fix:1` });
    expect(fake.mission().waitingOn).toBe('PRD 30: merge it');

    // A replay, and two runs at once, send nothing twice.
    await tick();
    await twice();
    expect(fake.jobs()).toHaveLength(7);

    // The fix ships for review: round 2 goes once, even from two runs at once, and passes.
    fake.end(prd(31), { status: 'done', outcome: 'review', prUrl: pr(71) });
    await twice();
    expect(fake.jobs().at(-1)).toMatchObject({ line: '/omni:review 31', key: `mission:${ID}:prd:31:run:1:review:2` });
    expect(fake.jobs()).toHaveLength(8);
    fake.end(prd(31), { status: 'done', outcome: 'ready', prUrl: pr(71), posted: { findings: 0, url: review(71, 3) } });
    await tick();
    expect(fake.mission()).toMatchObject({ status: 'waiting', waitingOn: 'PRD 30: merge it · PRD 31: merge it' });

    expect(linesOf(30)).toEqual(['/omni:yolo 30 --for-review', '/omni:qa 30', '/omni:review 30']);
    expect(linesOf(31)).toEqual(['/omni:yolo 31 --for-review', '/omni:qa 31', '/omni:review 31', '/omni:yolo-fix 31 --for-review', '/omni:review 31']);
    // Each verdict is one reviewed row, the Reviewer's, as an agent, linking its review, in the order the jobs were sent.
    expect(fake.events().filter((event) => event.kind === 'reviewed').map(({ role, actor, prd: n, link, sentence }) => [role, actor, n, link, sentence])).toEqual([
      ['reviewer', 'agent', prd(30), review(70, 1), 'Passed, round 1 of 2: marked ready.'],
      ['reviewer', 'agent', prd(31), review(71, 2), 'Changes asked: 2 findings, round 1/2.'],
      ['reviewer', 'agent', prd(31), review(71, 3), 'Passed, round 2 of 2: marked ready.'],
    ]);
    // Every key once (the mission's lane keeps its runs one at a time in production).
    expect(new Set(fake.jobs().map((one) => one.key)).size).toBe(fake.jobs().length);

    // Both merged: delivered.
    fake.set(prd(30), { stage: 'merged' });
    fake.set(prd(31), { stage: 'merged' });
    await tick();
    expect(fake.mission().status).toBe('delivered');
  });

  it('waits on a person after round 2\'s changes, never sends round 3, and waits for the merge once the PR is ready', async () => {
    const { fake, tick, linesOf } = reviewed([32]);
    await tick();
    for (const outcome of ['review', 'qa', 'changes', 'review', 'changes'] as const) {
      if (outcome === 'qa') qaPasses(fake, 32, 2817);
      else fake.end(prd(32), { status: 'done', outcome, prUrl: pr(2817) });
      await tick();
    }
    const sent = ['/omni:yolo 32 --for-review', '/omni:qa 32', '/omni:review 32', '/omni:yolo-fix 32 --for-review', '/omni:review 32'];
    expect(linesOf(32)).toEqual(sent);
    expect(fake.mission()).toMatchObject({ status: 'waiting', waitingOn: 'PRD 32: decide the Reviewer\'s findings on PR #2817' });
    await tick();
    await tick();
    expect(linesOf(32)).toEqual(sent);
    // The person takes it to ready: it waits for the merge, and still nothing more is sent.
    fake.set(prd(32), { stage: 'ready' });
    await tick();
    expect(fake.mission().waitingOn).toBe('PRD 32: merge it');
    expect(linesOf(32)).toEqual(sent);
  });
});
