// The agents' registry (PRD 2537, s1): an agent by the name an account gives, and the fallback a
// runner with no accounts file runs every job with, on its one account.
import { describe, expect, it } from 'vitest';
import { agentNamed, fallbackAccount, fallbackAgent } from './index.ts';

describe('the agents', () => {
  it('finds claude and t3 by their names, and no agent by a name nobody gave', () => {
    expect(agentNamed('claude')?.name).toBe('claude');
    expect(agentNamed('t3')?.name).toBe('t3');
    expect(agentNamed('codex')).toBeNull();
    expect(agentNamed('toString')).toBeNull();
  });

  it('falls back to claude run directly, on one account with no model and no secret of its own', () => {
    expect(fallbackAgent().name).toBe('claude');
    expect(fallbackAccount()).toEqual({ id: 'claude', model: null, secret: null });
  });
});
