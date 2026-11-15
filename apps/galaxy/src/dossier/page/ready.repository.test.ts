import { describe, expect, it } from 'vitest';
import { readLatestVerdict, type ReadyDb } from './ready.repository';

// The Ready panel's read (PRD 2898 s9) against a fake table: the latest row of the PRD in its repository
// (lower-cased), none when the App saved none, a failure named, a row out of shape refused. Fictional data.

const CHECK = { id: 'ci', title: 'CI green on the latest commit', state: 'pass', why: '', evidence: null, excused: [] };
const ROW = {
  repo: 'acme/widgets', prd: 2803, pr_number: 2817, head_sha: 'a'.repeat(40), state: 'ready', passed: 5, headline: 'Ready for review · 5 of 5',
  checks: [CHECK, CHECK, CHECK, CHECK, CHECK], criteria: [], decided_at: '2026-11-15T07:00:00Z',
};

/** A table that records the filters it was given and answers `answer`. */
function fake(answer: { data: unknown; error: { message: string } | null }) {
  const seen: Record<string, unknown> = {};
  const query = {
    select: () => query,
    eq: (column: string, value: unknown) => { seen[column] = value; return query; },
    order: () => query,
    limit: () => Promise.resolve(answer),
  };
  return { db: { from: () => query } as unknown as ReadyDb, seen };
}

describe('the latest ready verdict', () => {
  it('reads the PRD\'s row in its repository, lower-cased', async () => {
    const { db, seen } = fake({ data: [ROW], error: null });
    expect((await readLatestVerdict(db, 'Acme/Widgets', 2803))?.pr_number).toBe(2817);
    expect(seen).toEqual({ repo: 'acme/widgets', prd: 2803 });
  });

  it('is null when the App saved none', async () => {
    expect(await readLatestVerdict(fake({ data: [], error: null }).db, 'acme/widgets', 1)).toBeNull();
    expect(await readLatestVerdict(fake({ data: null, error: null }).db, 'acme/widgets', 1)).toBeNull();
  });

  it('throws when the database fails or answers out of shape', async () => {
    await expect(readLatestVerdict(fake({ data: null, error: { message: 'down' } }).db, 'acme/widgets', 1)).rejects.toThrow('down');
    await expect(readLatestVerdict(fake({ data: [{ ...ROW, checks: [] }], error: null }).db, 'acme/widgets', 1)).rejects.toThrow('out of shape');
  });
});
