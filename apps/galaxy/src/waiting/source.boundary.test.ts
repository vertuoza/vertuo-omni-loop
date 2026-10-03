import { describe, expect, it } from 'vitest';
import { boundaries } from './source.boundary';
import { WaitingRound } from './source';

// The waiting rounds' questions the Questions part reads, parsed where they come in (PRD 1030).

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

  it('is registered for schemas:verify with the schema the reader parses with', () => {
    expect(boundaries.map((b) => [b.name, b.schema, b.shape])).toEqual([['waiting/source: ask_rounds', WaitingRound, 'rows']]);
  });
});
