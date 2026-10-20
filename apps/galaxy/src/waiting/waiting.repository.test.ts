import { describe, expect, it } from 'vitest';
import { JobStateRead, OpenQuestionRead, WaitingRound } from './waiting.repository';

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

// The Runners part's two reads (PRD 2255, s4), parsed where they come in: a job's open questions, and the
// state of the jobs that asked. Both are registered for `pnpm schemas:verify` (runners.boundary.ts).

describe('an open question row of a runner job, as the database answers it', () => {
  it('parses the row the read answers, its other columns left out', () => {
    expect(OpenQuestionRead.parse({ job_id: 'j1', lead: 'Why?' })).toEqual({ job_id: 'j1' });
  });

  it('refuses a missing column, a wrong type and a forbidden null', () => {
    expect(OpenQuestionRead.safeParse({}).success).toBe(false);
    expect(OpenQuestionRead.safeParse({ job_id: 7 }).success).toBe(false);
    expect(OpenQuestionRead.safeParse({ job_id: null }).success).toBe(false);
  });
});

describe('a runner job\'s state, as the database answers it', () => {
  const state = { id: 'j1', status: 'done', outcome: 'human' };

  it('parses the row the read answers, a job with no outcome included', () => {
    expect(JobStateRead.parse({ ...state, workspace_id: 'w1' })).toEqual(state);
    expect(JobStateRead.parse({ ...state, outcome: null })).toEqual({ ...state, outcome: null });
  });

  it('refuses a missing column, a wrong type and a forbidden null', () => {
    expect(JobStateRead.safeParse({ id: 'j1', outcome: null }).success).toBe(false);
    expect(JobStateRead.safeParse({ ...state, outcome: 3 }).success).toBe(false);
    expect(JobStateRead.safeParse({ ...state, status: null }).success).toBe(false);
  });
});
