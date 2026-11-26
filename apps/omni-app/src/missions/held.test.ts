import { describe, expect, it } from 'vitest';
import { parsePrd, parseProductPrdId } from 'omni-loop/kit/lib/ids.ts';
import { endedOf, gateRedOf, heldBuildsOf, heldOnOf, specBlockersOf, withoutHeld } from './held.ts';
import { NO_REPAIRS, type RepairRow } from './repair.ts';

// Bug #3345: what a product PRD's build waits on, read from what its build ended on and from its spec, and which builds were sent
// before what they wait on joined the mission branch.

const P28 = parseProductPrdId('omni-loop-28');
const P27 = parseProductPrdId('omni-loop-27');
const P30 = parseProductPrdId('omni-loop-30');
const P31 = parseProductPrdId('omni-loop-31');

describe('heldOnOf: the PRDs a build ended held on', () => {
  it('reads the held line ultra-yolo ends on, its stamp, bold and page link left out', () => {
    expect(heldOnOf('12:16:48 **Held: PRD omni-loop-30 is blocked by omni-loop-28.** Nothing was cloned.\n12:16:48 /omni:ultra-yolo omni-loop-30', P30)).toEqual([P28]);
    expect(heldOnOf('12:17:57 Held: PRD omni-loop-31 waits on PRD omni-loop-28 and PRD omni-loop-27 · https://www.omni-loop.xyz/prd/3d57fb2d-4033-4b3f-ae42-a7fad36675e9', P31)).toEqual([P28, P27]);
    expect(heldOnOf('held: PRD omni-loop-31 waits on PRD omni-loop-28, PRD omni-loop-29', P31)).toEqual([P28, parseProductPrdId('omni-loop-29')]);
  });

  it('takes the last held line, and only one that names the PRD itself', () => {
    const log = ['Held: PRD omni-loop-31 waits on PRD omni-loop-28', 'Held: PRD omni-loop-31 waits on PRD omni-loop-27'].join('\n');
    expect(heldOnOf(log, P31)).toEqual([P27]);
    expect(heldOnOf('Held: PRD omni-loop-30 is blocked by omni-loop-28', P31)).toEqual([]);
  });

  it('names no PRD for a line that is no held line, another product\'s PRD, or the PRD itself', () => {
    expect(heldOnOf('**omni-loop-31 is held, nothing built.** PRD omni-loop-28 is not on the branch.', P31)).toEqual([]);
    expect(heldOnOf('I held PRD omni-loop-31 and built nothing.', P31)).toEqual([]);
    expect(heldOnOf('held: PRD omni-loop-31 still waits for approval after 60 min: https://x', P31)).toEqual([]);
    expect(heldOnOf('Held: PRD omni-loop-31 waits on PRD mobile-4 and PRD omni-loop-31', P31)).toEqual([]);
    expect(heldOnOf('', P31)).toEqual([]);
  });
});

describe('specBlockersOf: the PRDs a product PRD\'s spec says it is blocked by', () => {
  const spec = (blocked: string) => `---\nprd: omni-loop-30\ntitle: Business on the new parts\nblocked-by: ${blocked}\nspec: file\nphase0: server\n---\n\n## Problem\n`;

  it('reads blocked-by as PRDs of the same product', () => {
    expect(specBlockersOf(spec('[27, 28]'), P30)).toEqual([P27, P28]);
  });

  it('reads none for none, a missing spec, a spec with no front matter, or a field that does not read', () => {
    expect(specBlockersOf(spec('none'), P30)).toEqual([]);
    expect(specBlockersOf(null, P30)).toEqual([]);
    expect(specBlockersOf('## Problem\nblocked-by: [28]\n', P30)).toEqual([]);
    expect(specBlockersOf(spec('28'), P30)).toEqual([]);
    expect(specBlockersOf(spec('[30]'), P30)).toEqual([]);
  });
});

describe('heldBuildsOf: the builds sent before a PRD they wait on joined the mission branch, and those that ended held', () => {
  const run = (prd: typeof P30, job: string, heldOn?: (typeof P28)[]) => ({ prd, run: 1, job, attempts: [{ id: job, status: 'done' as const, outcome: null, reason: null, prUrl: null, ...(heldOn === undefined ? {} : { heldOn }) }] });
  const events = [
    { kind: 'dispatched', prd: null, product: P28, job: 'b28' },
    { kind: 'dispatched', prd: null, product: P30, job: 'b30' },
    { kind: 'dispatched', prd: null, product: P31, job: 'b31' },
    { kind: 'prd-joined', prd: null, product: P28, job: null },
    { kind: 'dispatched', prd: null, product: P30, job: 'b30-2' },
  ];
  const scope = new Set([P28, P30, P31]);

  it('names a build sent before a PRD its spec or its held line names joined, and none sent after', () => {
    const blockers = new Map([[P30, [P28]]]);
    const { early } = heldBuildsOf([run(P30, 'b30'), run(P31, 'b31', [P28, P27]), run(P30, 'b30-2')], events, { blockers, scope, done: new Set([P28]) });
    expect([...early]).toEqual(['b30', 'b31']);
  });

  it('names a build whose blocker has not joined yet, and none whose blocker is outside the scope', () => {
    const { early } = heldBuildsOf([run(P30, 'b30', [P28]), run(P31, 'b31', [P27])], events.slice(0, 3), { blockers: new Map(), scope, done: new Set() });
    expect([...early]).toEqual(['b30']);
  });

  it('a blocker on the branch with no join recorded (a repository PRD merged) and a build with no dispatch recorded are not early', () => {
    const merged = parsePrd(12);
    const { early } = heldBuildsOf([run(P30, 'b30'), run(P31, 'nowhere', [P28])], events.slice(0, 3), { blockers: new Map([[P30, [merged]]]), scope: new Set([...scope, merged]), done: new Set([merged, P28]) });
    expect([...early]).toEqual([]);
  });
});

describe('heldBuildsOf and withoutHeld: a held build\'s repairs count none', () => {
  it('names a build that ended on a held line as held, even sent after its blocker joined', () => {
    const one = { prd: P31, run: 2, job: 'b31-2', attempts: [{ id: 'b31-2', status: 'done' as const, outcome: null, reason: null, prUrl: null, heldOn: [P27] }] };
    const read = heldBuildsOf([one], [{ kind: 'dispatched', prd: null, product: P31, job: 'b31-2' }], { blockers: new Map(), scope: new Set([P31]), done: new Set() });
    expect([...read.early]).toEqual([]);
    expect([...read.held]).toEqual(['b31-2']);
  });

  it('drops the rows of the repairs sent for a held build, keeps every other, and keeps every job', () => {
    const row = (failedJob: string): RepairRow => ({ id: `r-${failedJob}`, prd: P30, fingerprint: 'a'.repeat(64), round: 1, number: 1, failedJob, job: `fix-${failedJob}`, retro: null, fixPr: null, outcome: 'not fixed' });
    const job = (failedJob: string) => ({ prd: P30, k: 1, job: `fix-${failedJob}`, failedJob, attempts: [] });
    const view = { ...NO_REPAIRS, budget: 9, rows: [row('held'), row('real')], jobs: [job('held'), job('real')] };
    const kept = withoutHeld(view, new Set(['held']));
    expect(kept.rows.map((one) => one.failedJob)).toEqual(['real']);
    expect(kept.jobs.map((one) => one.failedJob)).toEqual(['held', 'real']);
    expect(withoutHeld(view, new Set())).toBe(view);
  });
});

describe('gateRedOf: a build that ended on its red gate', () => {
  const ended = (last: string) => `12:54:10 **Red gate:** 1 open item waits on omni-loop › Questions.\n12:54:10 \n12:54:10 ${last}\nSessionEnd hook [node "x" heartbeat --end || true] failed: Hook cancelled`;

  it('reads the hand-off ultra-yolo ends on when open items hold its gate, with or without its flags and backticks', () => {
    expect(gateRedOf(ended('/omni:ultra-yolo-fix omni-loop-28'), P28)).toBe(true);
    expect(gateRedOf(ended('`/omni:ultra-yolo-fix omni-loop-28 --base-of demo-org/widgets=mission/19-settings`'), P28)).toBe(true);
  });

  it('reads no red gate on another last line, another PRD, or an empty log', () => {
    expect(gateRedOf(ended('/omni:ultra-yolo omni-loop-28'), P28)).toBe(false);
    expect(gateRedOf(ended('/omni:ultra-yolo-fix omni-loop-30'), P28)).toBe(false);
    expect(gateRedOf('/omni:ultra-yolo-fix omni-loop-28\nthen I stopped', P28)).toBe(false);
    expect(gateRedOf('', P28)).toBe(false);
  });
});

// Bug #3373: /omni:ultra-yolo ends a build that marked its target PRs ready on `/omni:mega-pr-care <id>`, and the runner sets no result
// word for an ultra-yolo job. The mission read that build as one that stopped mid-way and sent it again.
describe('endedOf: a build that ended ready on its hand-off', () => {
  const done = { id: 'job-5', status: 'done', outcome: null, reason: null, prUrl: null } as const;
  const ended = (last: string) => `20:31:02 Nothing is left held or stuck.\n20:31:02 \n20:31:02 ${last}\nSessionEnd hook [node "x" heartbeat --end || true] failed: Hook cancelled`;

  it('reads ready when the last line is /omni:mega-pr-care <id>, with or without backticks', () => {
    expect(endedOf(done, ended('/omni:mega-pr-care omni-loop-28'), P28)).toMatchObject({ outcome: 'ready' });
    expect(endedOf(done, ended('`/omni:mega-pr-care omni-loop-28`'), P28)).toMatchObject({ outcome: 'ready' });
  });

  it('reads no result word for another PRD, another last line, or an earlier hand-off', () => {
    expect(endedOf(done, ended('/omni:mega-pr-care omni-loop-30'), P28).outcome).toBeNull();
    expect(endedOf(done, ended('/omni:ultra-yolo omni-loop-28'), P28).outcome).toBeNull();
    expect(endedOf(done, '/omni:mega-pr-care omni-loop-28\nthen I stopped', P28).outcome).toBeNull();
    expect(endedOf(done, ended('/omni:ultra-yolo-fix omni-loop-28'), P28)).toMatchObject({ outcome: null, gateRed: true });
  });
});
