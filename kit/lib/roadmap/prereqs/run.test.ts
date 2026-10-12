// PRD 1218, slice s2: the runner — each check with a time limit, a crash or a timeout never ok, and a
// fix run only on an agent row and only when asked. Every check here is a fake.
import { describe, expect, it } from 'vitest';
import type { RoadmapPrerequisite } from '../parse.ts';
import { isMet, runPrerequisites } from './run.ts';
import type { Outcome, Probe, Probes } from './run.ts';

const row = (id: string, who: RoadmapPrerequisite['who'], over: Partial<RoadmapPrerequisite> = {}): RoadmapPrerequisite => ({
  id,
  category: 'local',
  need: `need ${id}`,
  check: who === 'person' ? null : 'base:docker',
  fix: who === 'agent' ? 'base:install' : null,
  blocks: 'all',
  who,
  repos: null,
  card: null,
  ...over,
});

const OK: Outcome = { ok: true };
const NOT_OK: Outcome = { ok: false, detail: 'exited 1' };
const answer = (outcome: Outcome): Probe => () => Promise.resolve(outcome);
const never: Probe = () => new Promise<Outcome>(() => undefined);

/** A fake check that answers each outcome in turn, counting its calls. */
function sequence(...outcomes: Outcome[]): Probe & { calls: number } {
  const probe = Object.assign(() => {
    const next = outcomes[Math.min(probe.calls, outcomes.length - 1)] ?? NOT_OK;
    probe.calls += 1;
    return Promise.resolve(next);
  }, { calls: 0 });
  return probe;
}

const probesOf = (map: Record<string, Probes>) => (prerequisite: RoadmapPrerequisite): Probes => map[prerequisite.id] ?? { check: null, fix: null };

describe('runPrerequisites', () => {
  it('says ok for a check that holds and waits for one that does not', async () => {
    const results = await runPrerequisites([row('p1', 'check'), row('p2', 'check')], {
      probes: probesOf({ p1: { check: answer(OK), fix: null }, p2: { check: answer(NOT_OK), fix: null } }),
      ticks: new Set(),
      fix: false,
    });
    expect(results.map(({ prerequisite, state, detail }) => [prerequisite.id, state, detail])).toEqual([
      ['p1', 'ok', null],
      ['p2', 'waits', 'exited 1'],
    ]);
  });

  it('never counts a check that times out as ok', async () => {
    const [result] = await runPrerequisites([row('p1', 'check')], {
      probes: probesOf({ p1: { check: never, fix: null } }),
      ticks: new Set(),
      fix: false,
      limitMs: 20,
    });
    expect(result).toMatchObject({ state: 'waits', detail: 'timed out after 0.02 s' });
  });

  it('never counts a check that throws or rejects as ok', async () => {
    const throws: Probe = () => {
      throw new Error('spawn docker ENOENT');
    };
    const rejects: Probe = () => Promise.reject(new Error('boom'));
    const results = await runPrerequisites([row('p1', 'check'), row('p2', 'check')], {
      probes: probesOf({ p1: { check: throws, fix: null }, p2: { check: rejects, fix: null } }),
      ticks: new Set(),
      fix: false,
    });
    expect(results.map((result) => [result.state, result.detail])).toEqual([
      ['waits', 'crashed: spawn docker ENOENT'],
      ['waits', 'crashed: boom'],
    ]);
  });

  it('has a 30-second limit by default', async () => {
    const [result] = await runPrerequisites([row('p1', 'check')], {
      probes: probesOf({ p1: { check: never, fix: null } }),
      ticks: new Set(),
      fix: false,
      timer: (ms) => {
        expect(ms).toBe(30_000);
        return Promise.resolve();
      },
    });
    expect(result).toMatchObject({ state: 'waits', detail: 'timed out after 30 s' });
  });

  it('with --fix, fixes an agent row then checks it again: fixed when it now holds', async () => {
    const check = sequence(NOT_OK, OK);
    const fix = sequence(OK);
    const [result] = await runPrerequisites([row('p1', 'agent')], {
      probes: probesOf({ p1: { check, fix } }),
      ticks: new Set(),
      fix: true,
    });
    expect(result).toMatchObject({ state: 'fixed', detail: null });
    expect([check.calls, fix.calls]).toEqual([2, 1]);
  });

  it('a fix that fails, or one after which the check still fails, leaves the row waiting', async () => {
    const results = await runPrerequisites([row('p1', 'agent'), row('p2', 'agent')], {
      probes: probesOf({
        p1: { check: answer(NOT_OK), fix: answer({ ok: false, detail: 'labels.autoCreate is off' }) },
        p2: { check: sequence(NOT_OK, { ok: false, detail: 'exited 2' }), fix: answer(OK) },
      }),
      ticks: new Set(),
      fix: true,
    });
    expect(results.map((result) => [result.state, result.detail])).toEqual([
      ['waits', 'the fix did not work: labels.autoCreate is off'],
      ['waits', 'still not ok after the fix: exited 2'],
    ]);
  });

  it('a fix that times out or crashes leaves the row waiting', async () => {
    const results = await runPrerequisites([row('p1', 'agent'), row('p2', 'agent')], {
      probes: probesOf({
        p1: { check: answer(NOT_OK), fix: never },
        p2: { check: answer(NOT_OK), fix: () => Promise.reject(new Error('install died')) },
      }),
      ticks: new Set(),
      fix: true,
      fixLimitMs: 20,
    });
    expect(results.map((result) => [result.state, result.detail])).toEqual([
      ['waits', 'the fix did not work: timed out after 0.02 s'],
      ['waits', 'the fix did not work: crashed: install died'],
    ]);
  });

  it('never runs a fix without --fix', async () => {
    const fix = sequence(OK);
    const [result] = await runPrerequisites([row('p1', 'agent')], {
      probes: probesOf({ p1: { check: answer(NOT_OK), fix } }),
      ticks: new Set(),
      fix: false,
    });
    expect(result?.state).toBe('waits');
    expect(fix.calls).toBe(0);
  });

  it('never runs a fix on a row that is not agent, even with --fix', async () => {
    const fix = sequence(OK);
    const results = await runPrerequisites([row('p1', 'check'), row('p2', 'person')], {
      probes: probesOf({ p1: { check: answer(NOT_OK), fix }, p2: { check: answer(NOT_OK), fix } }),
      ticks: new Set(),
      fix: true,
    });
    expect(results.map((result) => result.state)).toEqual(['waits', 'waits']);
    expect(fix.calls).toBe(0);
  });

  it('never runs the fix of an agent row whose check holds', async () => {
    const fix = sequence(OK);
    const [result] = await runPrerequisites([row('p1', 'agent')], {
      probes: probesOf({ p1: { check: answer(OK), fix } }),
      ticks: new Set(),
      fix: true,
    });
    expect(result?.state).toBe('ok');
    expect(fix.calls).toBe(0);
  });

  it('a person row is ticked once a person ticked it, and waits until then; nothing is run for it', async () => {
    const check = sequence(OK);
    const results = await runPrerequisites([row('p3', 'person'), row('p4', 'person')], {
      probes: probesOf({ p3: { check, fix: null }, p4: { check, fix: null } }),
      ticks: new Set(['p3']),
      fix: true,
    });
    expect(results.map((result) => [result.state, result.detail])).toEqual([
      ['ticked', null],
      ['waits', 'nobody has marked it done'],
    ]);
    expect(check.calls).toBe(0);
  });

  it('a tick never frees a row a check verifies', async () => {
    const [result] = await runPrerequisites([row('p1', 'check')], {
      probes: probesOf({ p1: { check: answer(NOT_OK), fix: null } }),
      ticks: new Set(['p1']),
      fix: false,
    });
    expect(result?.state).toBe('waits');
  });

  it('a check row with nothing to check waits on a person', async () => {
    const [result] = await runPrerequisites([row('p1', 'check', { check: null })], {
      probes: probesOf({}),
      ticks: new Set(),
      fix: false,
    });
    expect(result).toMatchObject({ state: 'waits', detail: 'nothing checks it' });
  });

  it('runs the rows one after the other, in table order', async () => {
    const order: string[] = [];
    const track = (id: string): Probe => async () => {
      order.push(`${id}:start`);
      await new Promise((resolve) => setTimeout(resolve, id === 'p1' ? 15 : 1));
      order.push(`${id}:end`);
      return OK;
    };
    await runPrerequisites([row('p1', 'check'), row('p2', 'check')], {
      probes: probesOf({ p1: { check: track('p1'), fix: null }, p2: { check: track('p2'), fix: null } }),
      ticks: new Set(),
      fix: false,
    });
    expect(order).toEqual(['p1:start', 'p1:end', 'p2:start', 'p2:end']);
  });
});

describe('isMet', () => {
  it('is true of ok, fixed and ticked, and false of a row that waits', () => {
    expect([isMet('ok'), isMet('fixed'), isMet('ticked'), isMet('waits')]).toEqual([true, true, true, false]);
  });
});
