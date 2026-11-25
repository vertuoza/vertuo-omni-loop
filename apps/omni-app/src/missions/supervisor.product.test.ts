import { describe, expect, it } from 'vitest';
import { parseProductPrdId } from 'omni-loop/kit/lib/ids.ts';
import { productStateOf, type Attempt, type ProductFact, type ProductRun } from './supervisor.ts';

// Bug #3287, the supervisor's reading alone: a product PRD's build that ended halfway or held is sent again as its next run, within
// the resume step's cap at `alone` (a spend or rate limit counts none) and once below it, and any other end waits for a person.

const P = parseProductPrdId('omni-loop-27');
const OTHER = parseProductPrdId('omni-loop-28');
const fact: ProductFact = { prd: P, approval: 'standing', blockers: [], targets: ['acme/widgets'] };
const where = (resumes: number | null) => ({ joined: new Set<never>(), done: new Set<never>(), branch: 'mission/12-faster-quotes', resumes });

const attempt = (over: Partial<Attempt>): Attempt => ({ id: 'job', status: 'done', outcome: null, reason: null, prUrl: null, ...over });
const build = (run: number, over: Partial<Attempt> = {}, prd = P): ProductRun => ({ prd, run, job: `job-${String(run)}`, attempts: [attempt({ id: `job-${String(run)}`, ...over })] });
const halfway = (count: number, over: Partial<Attempt> = {}): ProductRun[] => Array.from({ length: count }, (_, k) => build(k + 1, over));

describe('productStateOf, a build that ended halfway (bug #3287)', () => {
  it('at alone, sends the next run while the halfway ends number at most mandate.resumes, then a person', () => {
    expect(productStateOf(fact, halfway(3), where(3))).toEqual({ state: 'startable', run: 4 });
    expect(productStateOf(fact, halfway(4), where(3))).toEqual({ state: 'waits', why: 'PRD omni-loop-27: its build ended without its result line 4 times; take it to ready by hand and the mission joins it' });
  });

  it('with mandate.resumes 0, a person at once, saying once', () => {
    expect(productStateOf(fact, halfway(1), where(0))).toEqual({ state: 'waits', why: 'PRD omni-loop-27: its build ended without its result line once; take it to ready by hand and the mission joins it' });
  });

  it('a build that ended on a spend or rate limit counts none, up to ten builds ended halfway', () => {
    const limited = { limitedUntil: '2027-01-30T10:00:00Z' };
    expect(productStateOf(fact, halfway(9, limited), where(1))).toEqual({ state: 'startable', run: 10 });
    expect(productStateOf(fact, halfway(10, limited), where(1))).toMatchObject({ state: 'waits', why: expect.stringContaining('ended without its result line 0 times') as string });
  });

  it('below alone, once', () => {
    expect(productStateOf(fact, halfway(1), where(null))).toEqual({ state: 'startable', run: 2 });
    expect(productStateOf(fact, halfway(2), where(null))).toMatchObject({ state: 'waits', why: expect.stringContaining('its build stopped mid-way twice') as string });
  });

  it('counts only its own builds, never another product PRD\'s', () => {
    const others = [build(1, {}, OTHER), build(2, {}, OTHER)];
    expect(productStateOf(fact, [...others, build(1)], where(null))).toEqual({ state: 'startable', run: 2 });
  });
});

describe('productStateOf, any other end', () => {
  it('held once is sent again, twice a person; a hold after a halfway end is its first', () => {
    expect(productStateOf(fact, [build(1, { outcome: 'held' })], where(3))).toEqual({ state: 'startable', run: 2 });
    expect(productStateOf(fact, [build(1), build(2, { outcome: 'held' })], where(3))).toEqual({ state: 'startable', run: 3 });
    expect(productStateOf(fact, [build(1, { outcome: 'held' }), build(2, { outcome: 'held' })], where(3))).toMatchObject({ state: 'waits', why: expect.stringContaining('its build was held twice') as string });
  });

  it('Ready joins, at work runs, and a question for a person, a failure or a cancel waits for a person', () => {
    expect(productStateOf(fact, [build(1), build(2, { outcome: 'ready' })], where(3))).toMatchObject({ state: 'ready', run: { run: 2 } });
    expect(productStateOf(fact, [build(1, { status: 'running' })], where(3))).toEqual({ state: 'running' });
    expect(productStateOf(fact, [build(1, { outcome: 'answers' })], where(3))).toMatchObject({ state: 'waits', why: expect.stringContaining('its job ended answers') as string });
    expect(productStateOf(fact, [build(1, { status: 'failed', reason: 'the runner crashed' })], where(3))).toMatchObject({ state: 'waits', why: expect.stringContaining('its job failed: the runner crashed') as string });
    expect(productStateOf(fact, [build(1, { status: 'failed' })], where(3))).toMatchObject({ state: 'waits', why: expect.stringContaining('its job ended failed') as string });
    expect(productStateOf(fact, [build(1, { status: 'cancelled' })], where(3))).toMatchObject({ state: 'waits', why: expect.stringContaining('its job ended cancelled') as string });
  });
});
