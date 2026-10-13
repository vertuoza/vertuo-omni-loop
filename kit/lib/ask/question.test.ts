// The CLI adapter's wait (PRD 1831): cut into calls of at most 50 s, up to the wait asked for, on a
// clock of its own so that 110 seconds take no real time.
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.ts';
import { askClient, AskCallError } from './client.ts';
import { askQuestion, CALL_MS, failureReason, WAIT_DEFAULT_S, WAIT_MAX_S, WAIT_MIN_S } from './question.ts';

const QUESTION = { question: 'Which theme?', header: 'Theme', multiSelect: false, options: [{ label: 'Dark', description: 'always dark' }] };

/** A client whose `wait` notes each call's limit and lets that much time pass on `clock`. */
function stubClient(clock: { now: number }, timeouts: number[]) {
  const base = askClient({ baseUrl: 'https://omni.example.com', host: 'omni.example.com', tokens: { read: () => null, write: () => undefined } });
  return {
    ...base,
    openSession: () => Promise.resolve({ id: 'sess-1' }),
    openRound: () => Promise.resolve({ roundId: 'round-1' }),
    wait: (_roundId: string, { timeoutMs = 0 }: { timeoutMs?: number } = {}) => {
      timeouts.push(timeoutMs);
      clock.now += timeoutMs;
      return Promise.resolve({ status: 'open' });
    },
  };
}

describe('askQuestion', () => {
  it('waits in calls of at most 50 s, up to the wait asked, and leaves the round open', async () => {
    const { root } = makeRepo({ files: { '.omni-loop/config.yml': 'kit: 1\n' } });
    const clock = { now: 1_000_000 };
    const timeouts: number[] = [];
    const outcome = await askQuestion({
      root,
      host: 'omni.example.com',
      client: stubClient(clock, timeouts),
      terminalId: 'term-a',
      title: () => 'acme/widgets · main',
      file: { questions: [QUESTION] },
      waitMs: WAIT_DEFAULT_S * 1000,
      now: () => clock.now,
    });
    expect(outcome).toEqual({ kind: 'open', round: 'round-1' });
    expect(timeouts).toEqual([CALL_MS, CALL_MS, 10_000]);
  });

  it('takes 110 s by default, from 10 to 540', () => {
    expect([WAIT_DEFAULT_S, WAIT_MIN_S, WAIT_MAX_S, CALL_MS]).toEqual([110, 10, 540, 50_000]);
  });
});

describe('failureReason', () => {
  it('says in one line why the page was not used', () => {
    expect(failureReason(new AskCallError('GET /x: unreachable'), 'omni.example.com')).toBe(
      "cannot reach omni.example.com: allow it in your environment's network access",
    );
    expect(failureReason(new AskCallError('OMNI_TOKEN was revoked: make a new one', { status: 401 }), 'h')).toBe('OMNI_TOKEN was revoked: make a new one');
    expect(failureReason(new AskCallError('no', { status: 401 }), 'h')).toBe('h refused this sign-in: run omni signin, or set OMNI_TOKEN');
    expect(failureReason(new AskCallError('no', { status: 403, reason: 'not a member' }), 'h')).toBe('h refused the question (403: not a member)');
    expect(failureReason(new Error('a\n  b'), 'h')).toBe('a b');
  });
});
