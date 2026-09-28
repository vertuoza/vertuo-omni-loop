import { describe, expect, it } from 'vitest';
import { answered, answers, dropPicks, keepKnown, pickable, recommend, readPicks, type Pickable, type Picks } from './outbox-picks';

// The person's picks on the Outbox tab (PRD 251, s9): what each counts as, Select every recommendation, and
// what a reload keeps.

const DECISION: Pickable = { number: 2, kind: 'decision', adopted: false, letters: ['A', 'B', 'C'] };
const ACTION: Pickable = { number: 1, kind: 'action', adopted: false, letters: [] };
const ADOPTED: Pickable = { number: 3, kind: 'decision', adopted: true, letters: ['A', 'B'] };
const UNREADABLE: Pickable = { number: 4, kind: 'decision', adopted: false, letters: [] };
const ALL = [ACTION, DECISION, ADOPTED, UNREADABLE];

describe('Select every recommendation', () => {
  it('picks A on every open decision, and nothing else', () => {
    expect(recommend(ALL, {})).toEqual({ 2: { pick: 'A', reason: '' } });
  });

  it('never marks a human action, done or not, and leaves one already answered as it was', () => {
    expect(recommend(ALL, {})[1]).toBeUndefined();
    const picks: Picks = { 1: { pick: 'not-done', reason: 'no access' } };
    expect(recommend(ALL, picks)[1]).toEqual({ pick: 'not-done', reason: 'no access' });
  });

  it('never objects to an adopted medium, and keeps an objection already made', () => {
    expect(recommend(ALL, {})[3]).toBeUndefined();
    expect(recommend(ALL, { 3: { pick: 'B', reason: 'too big' } })[3]).toEqual({ pick: 'B', reason: 'too big' });
  });

  it('turns another letter back to A, keeping the reason only on A', () => {
    expect(recommend(ALL, { 2: { pick: 'B', reason: 'softer' } })[2]).toEqual({ pick: 'A', reason: '' });
    expect(recommend(ALL, { 2: { pick: 'A', reason: 'fine' } })[2]).toEqual({ pick: 'A', reason: 'fine' });
  });
});

describe('what a pick counts as', () => {
  it('a letter the decision offers is an answer', () => {
    expect(answered(ALL, { 2: { pick: 'B', reason: '' } })).toBe(1);
    expect(answered(ALL, { 2: { pick: 'D', reason: '' } })).toBe(0);
  });

  it('done is an answer; not done is one only with a reason', () => {
    expect(answered(ALL, { 1: { pick: 'done', reason: '' } })).toBe(1);
    expect(answered(ALL, { 1: { pick: 'not-done', reason: '  ' } })).toBe(0);
    expect(answered(ALL, { 1: { pick: 'not-done', reason: 'no access' } })).toBe(1);
    expect(answered(ALL, { 1: { pick: 'A', reason: '' } })).toBe(0);
  });

  it('on an adopted medium, only another letter is an answer: an objection', () => {
    expect(answered(ALL, { 3: { pick: 'A', reason: '' } })).toBe(0);
    expect(answered(ALL, { 3: { pick: 'B', reason: '' } })).toBe(1);
  });

  it('counts every answer', () => {
    expect(answered(ALL, recommend(ALL, { 1: { pick: 'done', reason: '' }, 3: { pick: 'B', reason: '' } }))).toBe(3);
  });
});

describe('what a reload keeps', () => {
  it('reads stored picks, dropping anything malformed', () => {
    expect(readPicks(JSON.stringify({ 2: { pick: 'B', reason: 'x' }, 9: 'nope', 1: { pick: 3 } }))).toEqual({ 2: { pick: 'B', reason: 'x' } });
    expect(readPicks('not json')).toEqual({});
    expect(readPicks(null)).toEqual({});
    expect(readPicks('[1,2]')).toEqual({});
  });

  it('keeps only picks on questions still shown', () => {
    expect(keepKnown(ALL, { 2: { pick: 'B', reason: '' }, 9: { pick: 'A', reason: '' } })).toEqual({ 2: { pick: 'B', reason: '' } });
  });

  it('reads the questions a card list offers', () => {
    expect(pickable([{ number: 2, kind: 'decision', adopted: false, options: [{ letter: 'A' }, { letter: 'B' }] }]))
      .toEqual([{ number: 2, kind: 'decision', adopted: false, letters: ['A', 'B'] }]);
  });

  it('offers nothing on a card the outbox comment has not numbered yet', () => {
    expect(pickable([{ number: null, kind: 'decision', adopted: false, options: [{ letter: 'A' }] }])).toEqual([]);
  });
});

describe('what Send posts', () => {
  it('each pick that answers its question, in number order, with a reason only when one was given', () => {
    const picks: Picks = {
      2: { pick: 'B', reason: 'softer' }, 1: { pick: 'done', reason: '  ' }, 3: { pick: 'A', reason: '' }, 4: { pick: 'A', reason: '' },
    };
    expect(answers(ALL, picks)).toEqual([{ number: 1, pick: 'done' }, { number: 2, pick: 'B', reason: 'softer' }]);
  });

  it('never a not done without its reason', () => {
    expect(answers(ALL, { 1: { pick: 'not-done', reason: '' } })).toEqual([]);
  });

  it('drops the picks on questions settled meanwhile, keeping the rest', () => {
    expect(dropPicks({ 1: { pick: 'done', reason: '' }, 2: { pick: 'B', reason: '' } }, [2])).toEqual({ 1: { pick: 'done', reason: '' } });
  });
});
