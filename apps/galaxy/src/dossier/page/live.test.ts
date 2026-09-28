import { describe, expect, it, vi } from 'vitest';
import type { DossierPulse } from '../store';
import { FAILURES_BEFORE_PROBLEM, LIVE_PROBLEM, pulseOf, signature, watchChanges } from './live';
import type { DossierRead } from './view';

// The page refreshes itself (PRD 384, part 5): a signature of the dossier's counts compared tick to
// tick, and a watcher that asks for a refresh only when it moves, saying so only after three failed
// reads in a row.

const PULSE: DossierPulse = { asked: 2, answered: 1, latest: { spec: 3, 'before-after': 1 } };

describe('the signature', () => {
  it('is equal for the same counts and versions, whatever order the versions come in', () => {
    expect(signature({ ...PULSE })).toBe(signature(PULSE));
    expect(signature({ asked: 2, answered: 1, latest: { 'before-after': 1, spec: 3 } })).toBe(signature(PULSE));
  });

  it('moves when a round is asked, a round answered or a version added', () => {
    const base = signature(PULSE);
    expect(signature({ ...PULSE, asked: 3 })).not.toBe(base);
    expect(signature({ ...PULSE, answered: 2 })).not.toBe(base);
    expect(signature({ ...PULSE, latest: { ...PULSE.latest, spec: 4 } })).not.toBe(base);
    expect(signature({ ...PULSE, latest: { ...PULSE.latest, plan: 1 } })).not.toBe(base);
  });

  it('reads a dossier that is gone as a signature of its own', () => {
    expect(signature(null)).not.toBe(signature({ asked: 0, answered: 0, latest: {} }));
  });
});

describe('the pulse of what the page rendered', () => {
  const version = (kind: string, n: number) => ({ id: `${kind}-${n}`, kind }) as never;
  const round = (status: string) => ({ status }) as never;
  const read = (rounds: DossierRead['rounds']): DossierRead => ({
    dossier: {} as never, members: [], rounds,
    versions: [version('spec', 1), version('before-after', 1), version('spec', 2)],
  });

  it('counts the rounds, those answered, and each kind\'s versions', () => {
    expect(pulseOf(read([round('answered'), round('open'), round('abandoned')]))).toEqual({
      asked: 3, answered: 1, latest: { spec: 2, 'before-after': 1 },
    });
  });

  it('is null when the rounds could not be read: the first check then sets the baseline', () => {
    expect(pulseOf(read(null))).toBeNull();
  });
});

describe('watching for changes', () => {
  function watcher(initial: string | null, reads: Array<DossierPulse | null | Error>) {
    const onChange = vi.fn();
    const onProblem = vi.fn();
    const read = vi.fn(async () => {
      const next = reads.shift();
      if (next instanceof Error) throw next;
      return next ?? null;
    });
    return { tick: watchChanges({ initial, read, onChange, onProblem }), onChange, onProblem, read };
  }

  it('asks for a refresh only when the signature moved, and keeps polling', async () => {
    const w = watcher(signature(PULSE), [PULSE, { ...PULSE, asked: 3 }, { ...PULSE, asked: 3 }]);
    expect(await w.tick()).toBe(true);
    expect(w.onChange).not.toHaveBeenCalled();
    expect(await w.tick()).toBe(true);
    expect(w.onChange).toHaveBeenCalledTimes(1);
    expect(await w.tick()).toBe(true);
    expect(w.onChange).toHaveBeenCalledTimes(1);
  });

  it('takes its first read as the baseline when the page gave none', async () => {
    const w = watcher(null, [PULSE, PULSE, { ...PULSE, answered: 2 }]);
    await w.tick();
    await w.tick();
    expect(w.onChange).not.toHaveBeenCalled();
    await w.tick();
    expect(w.onChange).toHaveBeenCalledTimes(1);
  });

  it('shows nothing for one or two failed reads, the problem at the third in a row, and clears it once a read works', async () => {
    expect(FAILURES_BEFORE_PROBLEM).toBe(3);
    expect(LIVE_PROBLEM).toBe('Cannot reach the server. Trying again every few seconds.');
    const down = new Error('down');
    const w = watcher(signature(PULSE), [down, down, PULSE, down, down, down, down, PULSE]);
    await w.tick();
    await w.tick();
    await w.tick();
    await w.tick();
    await w.tick();
    expect(w.onProblem).not.toHaveBeenCalledWith(LIVE_PROBLEM);
    expect(await w.tick()).toBe(true);
    expect(w.onProblem).toHaveBeenLastCalledWith(LIVE_PROBLEM);
    await w.tick();
    expect(w.onProblem).toHaveBeenLastCalledWith(LIVE_PROBLEM);
    await w.tick();
    expect(w.onProblem).toHaveBeenLastCalledWith(null);
    expect(w.onChange).not.toHaveBeenCalled();
  });
});
