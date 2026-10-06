import { describe, expect, it } from 'vitest';
import {
  constituentOf, constituentsReadSchema, displayIdOf, eventOf, historyOf, liveOf,
  type StoredConstituent, type StoredConstituentEvent,
} from './model';

// A product's constituents (PRD 871 s1): the read agents get, checked by its schema, and the rows the
// panel reads, as the panel shows them.

const READ = {
  state: 'ok',
  product: { name: 'Vertuoza UX' },
  statement: { id: 'statement', text: 'The component workshop' },
  never: [{ id: 'never#1', text: 'Calls real Vertuoza APIs' }, { id: 'never#3', text: 'Holds business logic' }],
  latestEventId: '42',
};

const row = (over: Partial<StoredConstituent>): StoredConstituent => ({
  id: 'c-1', product_id: 'p-1', kind: 'never', seq: 1, body: 'Calls real Vertuoza APIs', created_by: 'u-1',
  created_at: '2026-10-01T09:00:00Z', updated_at: '2026-10-01T09:00:00Z', removed_at: null, removed_by: null, ...over,
});

const event = (over: Partial<StoredConstituentEvent>): StoredConstituentEvent => ({
  id: 1, product_id: 'p-1', constituent_id: 'c-1', action: 'added', before: null, after: 'Calls real Vertuoza APIs',
  note: null, claim_id: null, changed_by: 'u-1', changed_at: '2026-10-01T09:00:00Z', ...over,
});

describe('the read', () => {
  it('takes the Statement, the Never lines and the newest event id', () => {
    expect(constituentsReadSchema.parse(READ)).toEqual(READ);
  });

  it('takes a product with nothing yet, and a repository with no product', () => {
    const empty = { state: 'none', product: { name: 'Vertuoza' }, statement: null, never: [], latestEventId: null };
    expect(constituentsReadSchema.parse(empty)).toEqual(empty);
    expect(constituentsReadSchema.parse({ ...empty, product: null })).toEqual({ ...empty, product: null });
  });

  it('refuses a state that does not match, a malformed id, an unknown field', () => {
    for (const bad of [
      { ...READ, state: 'none' },
      { ...READ, state: 'ok', statement: null, never: [] },
      { ...READ, never: [{ id: 'never-1', text: 'x' }] },
      { ...READ, never: [{ id: 'never#0', text: 'x' }] },
      { ...READ, statement: { id: 'never#1', text: 'x' } },
      { ...READ, latestEventId: 42 },
      { ...READ, extra: true },
    ]) expect(constituentsReadSchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
  });
});

describe('the rows', () => {
  it('names a Statement `statement` and a Never line `never#<seq>`', () => {
    expect(displayIdOf({ kind: 'statement', seq: null })).toBe('statement');
    expect(displayIdOf({ kind: 'never', seq: 7 })).toBe('never#7');
    expect(constituentOf(row({ removed_at: '2026-10-01T10:00:00Z' }))).toEqual({
      id: 'c-1', product: 'p-1', kind: 'never', displayId: 'never#1', text: 'Calls real Vertuoza APIs', removed: true,
      updatedAt: '2026-10-01T09:00:00Z',
    });
  });

  it('shows a product\'s live Statement and Never lines in order, never a removed one or another product\'s', () => {
    const all = [
      row({ id: 'n3', seq: 3, body: 'third' }),
      row({ id: 's', kind: 'statement', seq: null, body: 'What it is' }),
      row({ id: 'n1', seq: 1, body: 'first' }),
      row({ id: 'n2', seq: 2, body: 'gone', removed_at: '2026-10-01T10:00:00Z' }),
      row({ id: 'n9', seq: 9, product_id: 'p-2' }),
      row({ id: 'n10', seq: 10, body: 'tenth' }),
    ].map(constituentOf);
    const live = liveOf(all, 'p-1');
    expect(live.statement?.text).toBe('What it is');
    expect(live.never.map((c) => c.displayId)).toEqual(['never#1', 'never#3', 'never#10']);
    expect(liveOf(all, 'p-3')).toEqual({ statement: null, never: [] });
  });

  it('lists a product\'s history newest first, with who, when, before and after', () => {
    const events = [
      event({ id: 1 }),
      event({ id: '3', action: 'removed', before: 'Calls real Vertuoza APIs', after: null }),
      event({ id: 2, action: 'edited', before: 'a', after: 'b' }),
      event({ id: 4, product_id: 'p-2' }),
      event({ id: 5, action: 'moved', note: 'moved from Business never#7', claim_id: 'cl-7', changed_by: null }),
    ].map(eventOf);
    const history = historyOf(events, 'p-1');
    expect(history.map((e) => [e.id, e.action])).toEqual([[5, 'moved'], [3, 'removed'], [2, 'edited'], [1, 'added']]);
    expect(history[0]).toEqual({
      id: 5, product: 'p-1', constituent: 'c-1', action: 'moved', before: null, after: 'Calls real Vertuoza APIs',
      note: 'moved from Business never#7', by: null, at: '2026-10-01T09:00:00Z',
    });
    expect(history[2]).toMatchObject({ before: 'a', after: 'b', by: 'u-1' });
  });
});
