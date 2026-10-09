import { describe, expect, it } from 'vitest';
import { WaitingRound } from './waiting.repository';

// The waiting rounds' questions the Questions part reads, parsed where they come in (PRD 1030). No
// boundary registers this read: `pnpm schemas:verify` reads with the service role, which is granted
// nothing on ask_rounds (only a signed-in person reads a round).

const row = { id: 'r1', questions: [{ question: 'Which colour?', options: [{ label: 'Blue' }] }] };

describe('a waiting round, as the database answers it', () => {
  it('parses the row the read answers, its questions left to readQuestions', () => {
    expect(WaitingRound.parse({ ...row, status: 'open' })).toEqual(row);
  });

  it('refuses a missing column, a wrong type and a forbidden null', () => {
    expect(WaitingRound.safeParse({ questions: row.questions }).success).toBe(false);
    expect(WaitingRound.safeParse({ ...row, id: 1 }).success).toBe(false);
    expect(WaitingRound.safeParse({ ...row, id: null }).success).toBe(false);
  });
});
