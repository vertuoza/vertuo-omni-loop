import { describe, expect, it, vi } from 'vitest';
import type { GithubSummary } from '../github/summary';
import type { DossierPulse } from '../store';
import {
  FAILURES_BEFORE_PROBLEM, LIVE_PROBLEM, githubPulse, pulseOf, signature, watchChanges,
} from './live';
import type { DossierRead } from './view';
import { parseIssue, parsePr, parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';

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

  it('moves when a new User voice version is pushed (PRD 822)', () => {
    const voiced = { ...PULSE, latest: { ...PULSE.latest, voice: 1 } };
    expect(signature(voiced)).not.toBe(signature(PULSE));
    expect(signature({ ...voiced, latest: { ...voiced.latest, voice: 2 } })).not.toBe(signature(voiced));
  });

  it('reads a dossier that is gone as a signature of its own', () => {
    expect(signature(null)).not.toBe(signature({ asked: 0, answered: 0, latest: {} }));
  });
});

// PRD 426, part 5: the signature also covers the stage and the number of open outbox items, read
// from the GitHub summary the server caches 60 s.
const FEATURE = { number: parsePr(20), url: 'https://github.com/acme/widgets/pull/20', state: 'open', draft: true } as const;
const OUTBOX: GithubSummary = {
  repo: 'acme/widgets', prd: parsePrd(7), folder: '0007-team-inbox', topic: 'team-inbox',
  issue: { number: parseIssue(7), url: 'https://github.com/acme/widgets/issues/7', state: 'open' },
  phase0: { number: parsePr(12), url: 'https://github.com/acme/widgets/pull/12', state: 'merged', draft: false },
  feature: FEATURE,
  retro: null, mergedSlices: 2,
  outbox: { open: [{ id: 'o1', rank: 'high', question: 'Which?', decision: 'This.', options: [], personSteps: null }], settled: [] },
  outboxComment: 'https://github.com/acme/widgets/pull/20#issuecomment-1',
};

describe('the GitHub part of the signature', () => {
  it('reads the stage and the open outbox count from the summary', () => {
    expect(githubPulse(parsePrd(7), OUTBOX)).toEqual({ stage: 'outbox', open: 1, answers: null });
    expect(githubPulse(parsePrd(7), { ...OUTBOX, mergedSlices: 0 })).toEqual({ stage: 'inbox', open: 1, answers: null });
    expect(githubPulse(parsePrd(7), { ...OUTBOX, outbox: 'unread' })).toEqual({ stage: 'unknown', open: null, answers: null });
    expect(githubPulse(parsePrd(7), null)).toEqual({ stage: 'unknown', open: null, answers: null });
  });

  it('reads the pending answers (PRD 251, s9), so a reply typed on GitHub moves the signature', () => {
    const answer = (at: string) => ({ number: 1, id: 'o1', text: 'B', by: 'ada', at, url: null, counted: true, door: 'github' as const });
    const replies = (pending: ReturnType<typeof answer>[]) => ({ ...OUTBOX, replies: { numbering: [{ number: 1, id: 'o1' }], pending } });
    expect(githubPulse(parsePrd(7), replies([]))?.answers).toBe('0@');
    expect(githubPulse(parsePrd(7), replies([answer('2026-09-28T09:00:00Z')]))?.answers).toBe('1@2026-09-28T09:00:00Z');
    expect(githubPulse(parsePrd(7), { ...OUTBOX, replies: 'unread' })?.answers).toBeNull();
    const at = (time: string) => signature({ ...PULSE, github: githubPulse(parsePrd(7), replies([answer(time)])) });
    expect(at('2026-09-28T09:00:00Z')).not.toBe(at('2026-09-28T09:05:00Z'));
    expect(signature({ ...PULSE, github: { stage: 'outbox', open: 1 } })).toMatch(/#outbox:1$/);
  });

  it('is left out for a draft, and for a summary that was not asked for', () => {
    expect(githubPulse(null, OUTBOX)).toBeUndefined();
    expect(githubPulse(parsePrd(7), undefined)).toBeUndefined();
  });

  it('moves the signature when the stage or the open outbox count changes, and not otherwise', () => {
    const at = (github: GithubSummary | null) => signature({ ...PULSE, github: githubPulse(parsePrd(7), github) });
    const base = at(OUTBOX);
    expect(at({ ...OUTBOX })).toBe(base);
    expect(at({ ...OUTBOX, feature: { ...FEATURE, draft: false } })).toBe(base);
    expect(at({ ...OUTBOX, mergedSlices: 3 })).toBe(base);
    expect(at({ ...OUTBOX, feature: { ...FEATURE, state: 'merged' } })).not.toBe(base);
    expect(at({ ...OUTBOX, outbox: { open: [], settled: [] } })).not.toBe(base);
    expect(at(null)).not.toBe(base);
  });

  it('keeps the counts\' signature as it was when there is no GitHub part', () => {
    expect(signature({ ...PULSE, github: undefined })).toBe(signature(PULSE));
    expect(signature({ ...PULSE, github: githubPulse(parsePrd(7), OUTBOX) })).not.toBe(signature(PULSE));
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

  it('counts the User voice versions too, as dossier_list() pulses them (PRD 822)', () => {
    const voiced: DossierRead = { ...read([]), versions: [version('spec', 1), version('voice', 1), version('voice', 2)] };
    expect(pulseOf(voiced)?.latest).toEqual({ spec: 1, voice: 2 });
  });

  it('is null when the rounds could not be read: the first check then sets the baseline', () => {
    expect(pulseOf(read(null))).toBeNull();
  });

  it('carries the stage and the open outbox count when the page read the GitHub summary', () => {
    const numbered = (github?: GithubSummary | null): DossierRead => ({ ...read([]), dossier: { prd: parsePrd(7) } as never, github });
    expect(pulseOf(numbered(OUTBOX))?.github).toEqual({ stage: 'outbox', open: 1, answers: null });
    expect(pulseOf(numbered(null))?.github).toEqual({ stage: 'unknown', open: null, answers: null });
    expect(pulseOf(numbered())?.github).toBeUndefined();
  });
});

describe('watching for changes', () => {
  function watcher(initial: string | null, reads: Array<DossierPulse | null | Error>) {
    const onChange = vi.fn();
    const onProblem = vi.fn();
    const read = vi.fn(() => {
      const next = reads.shift();
      if (next instanceof Error) return Promise.reject(next);
      return Promise.resolve(next ?? null);
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

  it('compares the GitHub part only when both sides have one, the last one known, so a page rendered without it does not refresh for nothing', async () => {
    const outbox = { ...PULSE, github: { stage: 'outbox' as const, open: 1 } };
    const w = watcher(signature(PULSE), [outbox, outbox, { ...outbox, github: { stage: 'outbox' as const, open: 0 } }, PULSE, outbox]);
    await w.tick();
    await w.tick();
    expect(w.onChange).not.toHaveBeenCalled();
    await w.tick();
    expect(w.onChange).toHaveBeenCalledTimes(1);
    await w.tick();
    expect(w.onChange).toHaveBeenCalledTimes(1);
    await w.tick();
    expect(w.onChange).toHaveBeenCalledTimes(2);
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
