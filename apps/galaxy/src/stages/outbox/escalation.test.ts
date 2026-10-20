import { describe, expect, it } from 'vitest';
import { renderRecord, type RecordLine } from 'vertuo-omni-plan/kit/lib/escalation/comments.ts';
import { lawQuestion, recordIn, withEscalation } from './escalation';
import type { WaitingQuestion } from './store';

// PRD 1794, s5: what the Omni page keeps of the escalation record (kit/lib/escalation, s2): who each
// waiting item asks, and each held law as a waiting item of its own. The record is read, never written.

const line = (thing: string, kind: RecordLine['kind'], asked: string[], step: RecordLine['step'] = 1): RecordLine => ({
  thing, kind, firstHeld: '2026-10-09T15:00:00Z', step, asked, nextDue: step === 2 ? null : '2026-10-15T15:00:00Z',
});

const q = (id: string, rank: WaitingQuestion['rank'] = 'high'): WaitingQuestion => ({ id, rank, question: `Question of ${id}?` });

describe('recordIn', () => {
  it('reads the record among a pull request\'s comments, whichever comes first', () => {
    const record = renderRecord([line('N-PRODUCT-4', 'law', ['jdoe'])]);
    expect(recordIn([{ body: 'an outbox comment' }, { body: null }, { body: record }])).toEqual([line('N-PRODUCT-4', 'law', ['jdoe'])]);
  });

  it('is null when no comment carries the record\'s marker', () => {
    expect(recordIn([])).toBeNull();
    expect(recordIn([{ body: 'mentions omni:escalation, but is no record' }, {}])).toBeNull();
  });
});

describe('withEscalation', () => {
  it('stores who each held item asks, in lower case, without @ or a repeat', () => {
    const record = [line('s1-01-a', 'item', ['PierreDerval', '@jdoe', 'jdoe'])];
    expect(withEscalation([q('s1-01-a'), q('s2-01-c', 'human-action')], record)).toEqual([
      { ...q('s1-01-a'), asked: ['pierrederval', 'jdoe'] },
      q('s2-01-c', 'human-action'),
    ]);
  });

  it('adds each held law as a human-action item that asks for the approval on GitHub', () => {
    expect(withEscalation([q('s1-01-a')], [line('N-PRODUCT-4', 'law', ['jdoe'])])).toEqual([
      q('s1-01-a'),
      { id: 'N-PRODUCT-4', rank: 'human-action', question: 'Approve the change to N-PRODUCT-4 on GitHub, or ask for changes.', asked: ['jdoe'] },
    ]);
    expect(lawQuestion('BR-PRODUCT-6')).toBe('Approve the change to BR-PRODUCT-6 on GitHub, or ask for changes.');
  });

  it('keeps a held law at step 0 with nobody asked yet, and no asked field', () => {
    expect(withEscalation([], [line('N-PRODUCT-4', 'law', [], 0)])).toEqual([
      { id: 'N-PRODUCT-4', rank: 'human-action', question: lawQuestion('N-PRODUCT-4') },
    ]);
  });

  it('leaves the items as they are with no record, and ignores a record line whose item is no longer open', () => {
    expect(withEscalation([q('a')], null)).toEqual([q('a')]);
    expect(withEscalation([q('a')], [line('gone', 'item', ['jdoe'])])).toEqual([q('a')]);
  });
});
