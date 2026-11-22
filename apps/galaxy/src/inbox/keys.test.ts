import { describe, expect, it } from 'vitest';
import type { PrNumber } from 'omni-loop/kit/lib/ids.ts';
import type { WaitingQuestion, WaitingReview } from '../waiting/waiting';
import { EMPTY_INBOX_INPUT, inboxOf } from './inbox';
import { actionOf, CLEAR_REFUSED, listKey, moveFrom } from './keys';

// The Inbox list's keys (PRD omni-loop-22, s5), as pure functions: what a key press means on the list,
// where the focus moves, and what `e` does to the row in focus.

const key = (k: string, mods: Partial<{ metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean }> = {}) => ({ key: k, ...mods });

describe('a key on the list', () => {
  it('j and the down arrow move down, k and the up arrow move up', () => {
    expect(listKey(key('j'), false)).toEqual({ kind: 'move', by: 1 });
    expect(listKey(key('ArrowDown'), false)).toEqual({ kind: 'move', by: 1 });
    expect(listKey(key('k'), false)).toEqual({ kind: 'move', by: -1 });
    expect(listKey(key('ArrowUp'), false)).toEqual({ kind: 'move', by: -1 });
  });

  it('o opens the item’s own page, e clears', () => {
    expect(listKey(key('o'), false)).toEqual({ kind: 'page' });
    expect(listKey(key('e'), false)).toEqual({ kind: 'clear' });
  });

  it('is off while a text field has the focus', () => {
    for (const k of ['j', 'k', 'o', 'e', 'ArrowDown']) expect(listKey(key(k), true)).toBeNull();
  });

  it('leaves a key with a modifier, and every other key, to the page', () => {
    expect(listKey(key('j', { ctrlKey: true }), false)).toBeNull();
    expect(listKey(key('e', { metaKey: true }), false)).toBeNull();
    expect(listKey(key('1'), false)).toBeNull();
    expect(listKey(key('Enter'), false)).toBeNull();
  });

  it('command-enter or control-enter sends, even from the Other field', () => {
    expect(listKey(key('Enter', { metaKey: true }), false)).toEqual({ kind: 'send' });
    expect(listKey(key('Enter', { ctrlKey: true }), true)).toEqual({ kind: 'send' });
    expect(listKey(key('Enter', { metaKey: true, shiftKey: true }), false)).toBeNull();
  });
});

describe('moving the focus', () => {
  const keys = ['question:a', 'question:b', 'approval:c'];

  it('moves one row, and stops at either end', () => {
    expect(moveFrom(keys, 'question:a', 1)).toBe('question:b');
    expect(moveFrom(keys, 'approval:c', 1)).toBe('approval:c');
    expect(moveFrom(keys, 'question:a', -1)).toBe('question:a');
  });

  it('starts at the first row when nothing has the focus, or the row in focus left', () => {
    expect(moveFrom(keys, null, 1)).toBe('question:a');
    expect(moveFrom(keys, 'question:gone', -1)).toBe('question:a');
    expect(moveFrom([], null, 1)).toBeNull();
  });
});

describe('what a key does to the rows', () => {
  const NOW = Date.parse('2026-11-22T10:00:00Z');
  const question: WaitingQuestion = { kind: 'question', id: 'r1', sessionTitle: 's', question: 'q?', askedAt: NOW, sharedBy: null };
  const review: WaitingReview = { kind: 'review', id: 'w1', prd: null, pr: 310 as PrNumber, repo: 'acme/widgets', since: NOW };
  const { rows } = inboxOf({
    ...EMPTY_INBOX_INPUT, questions: [question], reviews: [review], runnerJobs: [{ id: 'runners', title: 'jobs', since: NOW }],
    updates: [{ id: 'docs-d1', title: 'PRD 44', detail: 'New plan', since: NOW, href: '/prd/d1' }],
  });
  const e = listKey(key('e'), false);

  it('AC-11: e on a question refuses to clear it, saying Answer it to clear it', () => {
    expect(actionOf(e, rows, 'question:r1', null)).toEqual({ kind: 'refuse', words: CLEAR_REFUSED });
    expect(CLEAR_REFUSED).toBe('Answer it to clear it');
  });

  it('e refuses every counted wait and a runner job, and clears an update only', () => {
    expect(actionOf(e, rows, 'review:w1', null)?.kind).toBe('refuse');
    expect(actionOf(e, rows, 'runner:runners', null)?.kind).toBe('refuse');
    expect(actionOf(e, rows, 'update:docs-d1', null)).toMatchObject({ kind: 'clear', row: { key: 'update:docs-d1' } });
  });

  it('acts on the row in focus, else on the open one, else on none', () => {
    expect(actionOf(e, rows, null, 'question:r1')?.kind).toBe('refuse');
    expect(actionOf(e, rows, 'question:gone', 'update:docs-d1')?.kind).toBe('clear');
    expect(actionOf(e, rows, null, null)).toBeNull();
  });

  it('o opens the row’s own page, a pull request on GitHub in a new tab', () => {
    const o = listKey(key('o'), false);
    expect(actionOf(o, rows, 'question:r1', null)).toEqual({ kind: 'page', href: '/ask/q/r1', external: false });
    expect(actionOf(o, rows, 'review:w1', null)).toEqual({ kind: 'page', href: 'https://github.com/acme/widgets/pull/310', external: true });
  });

  it('j moves the focus from the row in focus, or from the open one', () => {
    expect(actionOf(listKey(key('j'), false), rows, null, 'question:r1')).toEqual({ kind: 'focus', key: 'review:w1' });
  });

  it('leaves command-enter and the keys it does not know to the form', () => {
    expect(actionOf(listKey(key('Enter', { metaKey: true }), false), rows, null, 'question:r1')).toBeNull();
    expect(actionOf(null, rows, null, 'question:r1')).toBeNull();
  });
});
