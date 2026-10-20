import { describe, expect, it } from 'vitest';
import { boundaries } from './runners.boundary';
import { JobStateRead, OpenQuestionRead } from './waiting.repository';

// The reads the Runners part makes (PRD 2255, s4), registered for `pnpm schemas:verify` with the schemas
// the repository parses them with.

describe('the Runners part\'s boundaries', () => {
  it('are registered for schemas:verify with the schemas the repository parses with', () => {
    expect(boundaries.map((b) => [b.name, b.schema, b.shape])).toEqual([
      ['waiting/runners: runner_job_questions', OpenQuestionRead, 'rows'],
      ['waiting/runners: runner_jobs', JobStateRead, 'rows'],
    ]);
  });

  it('read the tables the repository reads', () => {
    const tablesRead: string[] = [];
    const chain: Record<string, unknown> = {};
    for (const name of ['select', 'is', 'not', 'limit']) chain[name] = () => chain;
    chain.then = (ok: (r: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(ok);
    const db = { from: (table: string) => { tablesRead.push(table); return chain; } };
    for (const b of boundaries) void b.read(db as never);
    expect(tablesRead).toEqual(['runner_job_questions', 'runner_jobs']);
  });
});
