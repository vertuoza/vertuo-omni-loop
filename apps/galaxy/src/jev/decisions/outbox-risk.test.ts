import { describe, expect, it } from 'vitest';
import { outboxRisk } from './outbox-risk';
import { sure } from '../../arcade/sure';

// The outbox item risk's registry entry (PRD 812 s3): a Noul "hard to revert?", mapped with the
// decision's threshold; what it sends Jev (decision 10: the item's decision text and options, the
// slice's title, the paths it touches); and the state and old answer a terminal may send.

const STATE = {
  decision: 'Keep the sessions in Postgres rather than Redis.',
  options: ['A: Postgres, row-level security per owner', 'B: Redis with a TTL'],
  slice: 's3: sessions',
  paths: ['apps/galaxy/src/ask/store.ts', 'supabase/migrations/'],
};

/** The state as the decision reads it: the file's `slice` key, read as the label it holds. */
const { slice, ...rest } = STATE;
const INPUT = { ...rest, sliceLabel: slice };

describe('outbox-risk', () => {
  it('asks a Noul whether the decision is hard to revert', () => {
    const q = outboxRisk.question;
    expect(q.type).toBe('noul');
    if (q.type !== 'noul') return;
    expect(q.statement).toMatch(/hard to revert/i);
  });

  it('maps a Noul at or above the threshold to true, under it to false', () => {
    expect(outboxRisk.value(0.5, { threshold: 0.5 })).toBe(true);
    expect(outboxRisk.value(0.82, { threshold: 0.5 })).toBe(true);
    expect(outboxRisk.value(0.49, { threshold: 0.5 })).toBe(false);
    expect(outboxRisk.value(0.6, { threshold: 0.65 })).toBe(false);
    expect(outboxRisk.value(0.65, { threshold: 0.65 })).toBe(true);
  });

  it('refuses an answer that is not a number from 0 to 1', () => {
    expect(outboxRisk.value('true', { threshold: 0.5 })).toBeNull();
    expect(outboxRisk.value(1.2, { threshold: 0.5 })).toBeNull();
    expect(outboxRisk.value(-0.1, { threshold: 0.5 })).toBeNull();
  });

  it('shows a value as the record keeps it', () => {
    expect(outboxRisk.show(true)).toBe('true');
    expect(outboxRisk.show(false)).toBe('false');
  });

  it('gives Jev the decision, its options, the slice and the paths it touches', () => {
    const state = outboxRisk.state(INPUT);
    expect(typeof state).toBe('string');
    expect(state).toContain('Decision: Keep the sessions in Postgres rather than Redis.');
    expect(state).toContain('- A: Postgres, row-level security per owner');
    expect(state).toContain('Slice: s3: sessions');
    expect(state).toContain('- supabase/migrations/');
  });

  it('reads a state from a terminal, and refuses a malformed one', () => {
    const terminal = sure(outboxRisk.terminal, 'outboxRisk.terminal');
    expect(terminal.input(STATE)).toEqual(INPUT);
    expect(terminal.input({ decision: 'Only the decision.' })).toEqual({ decision: 'Only the decision.', options: [], sliceLabel: null, paths: [] });
    expect(terminal.input({ ...STATE, decision: '' })).toBeNull();
    expect(terminal.input({ ...STATE, paths: 'one/path' })).toBeNull();
    expect(terminal.input({ ...STATE, options: [1, 2] })).toBeNull();
    expect(terminal.input({ ...STATE, secret: 'x' })).toBeNull();
    expect(terminal.input('text')).toBeNull();
    expect(terminal.input(null)).toBeNull();
  });

  it('reads the agent\'s own hardToRevert as the old answer', () => {
    const terminal = sure(outboxRisk.terminal, 'outboxRisk.terminal');
    expect(terminal.old('true')).toBe(true);
    expect(terminal.old('false')).toBe(false);
    expect(terminal.old('yes')).toBeNull();
  });
});
