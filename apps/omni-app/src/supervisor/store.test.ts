// The watch's store (PRD omni-loop-34 s2): the pure readings it makes of the rows. The database itself is read by
// ./store.boundary.ts under `pnpm schemas:verify`.
import { describe, expect, it } from 'vitest';
import { failingKinds, lastLineOf } from './store.ts';

describe('lastLineOf — a log tail\'s last line, masked', () => {
  it('reads the last line that is not blank, masking a token', () => {
    const token = `ghp_${'b'.repeat(36)}`;
    expect(lastLineOf(`step 1\nstep 2 with ${token}\n\n  \n`)).toBe('step 2 with [masked]');
  });

  it('reads none from an empty tail', () => {
    expect(lastLineOf('\n \n')).toBeNull();
  });
});

describe('failingKinds — the scheduled kinds whose last 3 runs failed', () => {
  it('names a kind whose 3 newest runs failed, not one with a done among them or fewer than 3', () => {
    expect(failingKinds([
      { kind: 'pr-stats', state: 'failed' }, { kind: 'escalation', state: 'failed' }, { kind: 'pr-stats', state: 'failed' },
      { kind: 'escalation', state: 'done' }, { kind: 'pr-stats', state: 'failed' }, { kind: 'escalation', state: 'failed' },
      { kind: 'pr-stats', state: 'done' }, { kind: 'checkpoints-forget', state: 'failed' },
    ])).toEqual(['pr-stats']);
  });
});
