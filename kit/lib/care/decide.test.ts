// @ts-nocheck
// PRD 790, slice s1: the pure decision that turns a feature PR's care state into a round's actions.
import { describe, expect, it } from 'vitest';
import { decideRound } from './decide.ts';

function state(over = {}) {
  return {
    pr: { number: 9, url: 'u', state: 'OPEN', isDraft: false, base: 'main', head: 'feat/widgets', labels: [] },
    checks: { state: 'green', failed: [], stuck: false, fixable: false },
    mergeable: 'MERGEABLE',
    threads: [],
    status: null,
    wave: { holdsClaims: false, claimed: [] },
    ...over,
  };
}

const RED = { state: 'red', failed: [{ name: 'test', url: 'https://ci/1' }], stuck: false, fixable: true };
const thread = (id, over = {}) => ({ id, resolved: false, verdict: null, reason: null, needs: 'judge', comments: [], ...over });
const kinds = (round) => round.actions.map((action) => action.kind);

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
