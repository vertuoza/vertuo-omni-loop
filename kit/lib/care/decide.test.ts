// PRD 790, slice s1: the pure decision that turns a feature PR's care state into a round's actions.
import { describe, expect, it } from 'vitest';
import { decideRound, decideSubPrRound } from './decide.ts';
import type { Round, RoundState, SubPrRoundState } from './decide.ts';

function state(over: Record<string, unknown> = {}): RoundState {
  return {
    pr: { number: 9, url: 'u', state: 'OPEN', isDraft: false, base: 'main', head: 'feat/widgets', labels: [] },
    checks: { state: 'green', failed: [], stuck: false, fixable: false },
    mergeable: 'MERGEABLE',
    threads: [],
    status: null,
    wave: { holdsClaims: false, claimed: [] },
    ...over,
  } as RoundState;
}

const RED = { state: 'red', failed: [{ name: 'test', url: 'https://ci/1' }], stuck: false, fixable: true };
const thread = (id: string, over: Record<string, unknown> = {}) => ({ id, resolved: false, verdict: null, reason: null, needs: 'judge', comments: [], ...over });
const kinds = (round: Round) => round.actions.map((action) => action.kind);

describe('decideRound', () => {
  it('only reports on a green, conflict-free PR with nothing to handle', () => {
    expect(decideRound(state())).toEqual({ mode: 'act', actions: [{ kind: 'status' }] });
  });

  it('puts a conflict before red CI, and red CI before reviews', () => {
    const round = decideRound(state({ mergeable: 'CONFLICTING', checks: RED, threads: [thread('T1')] }));
    expect(kinds(round)).toEqual(['merge-base', 'fix-ci', 'judge', 'status']);
    expect(round.actions[0]).toEqual({ kind: 'merge-base', base: 'main' });
    expect(round.actions[1]).toEqual({ kind: 'fix-ci', failed: RED.failed });
    expect(round.actions[2]).toEqual({ kind: 'judge', thread: 'T1' });
  });

  it('only reads and reports while a wave holds claims', () => {
    const round = decideRound(state({ mergeable: 'CONFLICTING', checks: RED, threads: [thread('T1')], wave: { holdsClaims: true, claimed: ['s2'] } }));
    expect(round).toEqual({ mode: 'report-only', actions: [{ kind: 'status' }] });
  });

  it('only reports when it could not tell whether a wave holds claims', () => {
    expect(decideRound(state({ checks: RED, wave: { holdsClaims: null, claimed: [] } })).mode).toBe('report-only');
  });

  it('skips a handled thread', () => {
    const threads = [
      thread('T1', { resolved: true, verdict: 'fixed', needs: null }),
      thread('T2', { resolved: true, verdict: 'pushed-back', needs: null }),
      thread('T3', { verdict: 'asked', needs: null }),
      thread('T4'),
    ];
    expect(decideRound(state({ threads })).actions).toEqual([{ kind: 'judge', thread: 'T4' }, { kind: 'status' }]);
  });

  it('marks a thread asked when a person replied after a care reply, and never judges it again', () => {
    const threads = [thread('T1', { resolved: true, verdict: 'asked', needs: 'mark-asked' })];
    expect(decideRound(state({ threads })).actions).toEqual([{ kind: 'mark-asked', thread: 'T1' }, { kind: 'status' }]);
  });

  it('still handles reviews when CI is stuck, without another fix attempt', () => {
    const round = decideRound(state({ checks: { ...RED, stuck: true }, threads: [thread('T1')] }));
    expect(kinds(round)).toEqual(['judge', 'status']);
  });

  it('does not fix CI that is running, green, or red only on a gate', () => {
    expect(kinds(decideRound(state({ checks: { state: 'running', failed: [], stuck: false, fixable: false } })))).toEqual(['status']);
    expect(kinds(decideRound(state({ checks: { ...RED, fixable: false } })))).toEqual(['status']);
  });

  it.each(['MERGED', 'CLOSED'])('stops once the PR is %s', (prState) => {
    expect(decideRound(state({ pr: { ...state().pr, state: prState }, threads: [thread('T1')] }))).toEqual({ mode: 'stop', actions: [] });
  });
});

describe('decideRound — a landing chain', () => {
  const LINK = {
    landing: 2,
    pr: 12,
    branch: 'feat/w-2of2-code',
    base: 'feat/w-1of2-expand',
    retarget: true,
    after: { landing: 1, pr: 11, branch: 'feat/w-1of2-expand' },
    later: [],
  };

  it('restacks first, before a conflict, red CI and reviews', () => {
    const round = decideRound(state({ chain: [LINK], mergeable: 'CONFLICTING', checks: RED }));
    expect(kinds(round)).toEqual(['restack', 'merge-base', 'fix-ci', 'status']);
    expect(round.actions[0]).toEqual({ kind: 'restack', ...LINK });
  });

  it('restacks nothing while a wave holds claims', () => {
    expect(decideRound(state({ chain: [LINK], wave: { holdsClaims: true, claimed: ['s3'] } }))).toEqual({ mode: 'report-only', actions: [{ kind: 'status' }] });
  });
});

describe('decideRound — waits on another repository (PRD 1118)', () => {
  const waiting = (state: string) => ({ slug: 'acme/backend', pr: 41, state });

  it('lists no fix-ci while the named PR is open, and says what it waits on', () => {
    const round = decideRound(state({ checks: RED, threads: [thread('T1')], waitsOn: waiting('open') }));
    expect(round).toEqual({ mode: 'act', actions: [{ kind: 'judge', thread: 'T1' }, { kind: 'status' }], waitsOn: 'acme/backend#41' });
  });

  it('holds as open when the named PR could not be read', () => {
    expect(kinds(decideRound(state({ checks: RED, waitsOn: waiting('unreadable') })))).toEqual(['status']);
  });

  it('lists one rerun of the failed checks once the named PR merged', () => {
    const round = decideRound(state({ checks: RED, waitsOn: waiting('merged') }));
    expect(round).toEqual({ mode: 'act', actions: [{ kind: 'rerun', failed: RED.failed }, { kind: 'status' }] });
  });

  it('reruns nothing once merged when CI is not red', () => {
    expect(kinds(decideRound(state({ waitsOn: waiting('merged') })))).toEqual(['status']);
  });

  it('fixes CI as without the line once the named PR was closed unmerged', () => {
    expect(kinds(decideRound(state({ checks: RED, waitsOn: waiting('closed') })))).toEqual(['fix-ci', 'status']);
  });

  it('decides as today without the line', () => {
    expect(decideRound(state({ checks: RED, waitsOn: null }))).toEqual({ mode: 'act', actions: [{ kind: 'fix-ci', failed: RED.failed }, { kind: 'status' }] });
  });
});

// Issue #1178: a sub-PR's round, which `/omni:wave` runs before it merges the sub-PR.
const subState = (over: Record<string, unknown> = {}) => state(over) as unknown as SubPrRoundState;

describe('decideSubPrRound', () => {
  it('judges and marks threads whatever the CI, the conflict and the wave claims say, and writes no status', () => {
    const round = decideSubPrRound(subState({
      mergeable: 'CONFLICTING',
      checks: RED,
      wave: { holdsClaims: true, claimed: ['s2'] },
      threads: [thread('T1'), thread('T2', { verdict: 'asked', needs: 'mark-asked' }), thread('T3', { verdict: 'fixed', needs: null })],
    }));
    expect(round).toEqual({ mode: 'act', actions: [{ kind: 'judge', thread: 'T1' }, { kind: 'mark-asked', thread: 'T2' }] });
  });

  it('holds the sub-PR on a thread left asked once nothing is left to do', () => {
    const threads = [thread('T1', { verdict: 'asked', needs: null }), thread('T2', { verdict: 'pushed-back', needs: null }), thread('T3', { verdict: 'asked', needs: null })];
    expect(decideSubPrRound(subState({ threads }))).toEqual({ mode: 'hold', actions: [], held: ['T1', 'T3'] });
  });

  it('acts before it holds: an asked thread waits until every other thread is judged', () => {
    const round = decideSubPrRound(subState({ threads: [thread('T1', { verdict: 'asked', needs: null }), thread('T2')] }));
    expect(round).toEqual({ mode: 'act', actions: [{ kind: 'judge', thread: 'T2' }] });
  });

  it('clears a sub-PR with no thread, or only handled ones', () => {
    expect(decideSubPrRound(subState())).toEqual({ mode: 'clear', actions: [] });
    expect(decideSubPrRound(subState({ threads: [thread('T1', { verdict: 'fixed', needs: null })] }))).toEqual({ mode: 'clear', actions: [] });
  });

  it('stops on a sub-PR merged or closed', () => {
    expect(decideSubPrRound(subState({ pr: { state: 'MERGED', base: 'feat/widgets' }, threads: [thread('T1')] }))).toEqual({ mode: 'stop', actions: [] });
  });
});
