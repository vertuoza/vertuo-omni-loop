import { describe, expect, it } from 'vitest';
import { parsePrd } from 'omni-loop/kit/lib/ids.ts';
import type { RewindFinding } from 'omni-loop/kit/lib/rewind/findings.ts';
import { brokenRows } from '../data/broken-rows.fake';
import { findingsOf, rewindRepository, StoredFinding, StoredWatchWorkspace } from './rewind.repository';

// The rewind's storage (PRD 2410, s5) on recording clients: reads as the caller with the repository in lower
// case, inserts as the service with only the columns the rewind writes. That members read and nobody else
// does is proved by supabase/checks/main_watch.sql.

const PRD = parsePrd(7);
const stored = { id: 'f1', check_name: 'ci', origin: 'repository', happened: 'x', evidence: ['https://a.test/1'], fix: 'y', state: 'proposed', reason: null };

type Call = unknown[];

function recording(rows: Record<string, unknown[]>, insertError: { code?: string; message: string } | null = null) {
  const calls: Call[] = [];
  const from = (table: string) => ({
    select: (columns: string) => {
      const filters: Call = [];
      const chain = {
        eq: (column: string, value: unknown) => { filters.push([column, value]); return chain; },
        order: (column: string) => { filters.push(['order', column]); return chain; },
        then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
          calls.push(['select', table, columns, ...filters]);
          return Promise.resolve({ data: rows[table] ?? [], error: null }).then(resolve, reject);
        },
      };
      return chain;
    },
    insert: (values: unknown) => {
      calls.push(['insert', table, values]);
      return Promise.resolve({ error: insertError });
    },
  });
  return { calls, db: { from } as never };
}

describe('the repository, on Supabase', () => {
  it('reads the workspace of a PRD\'s watch as the caller, the repository in lower case', async () => {
    const { calls, db } = recording({ prd_main_watch: [{ workspace_id: 'w1' }, { workspace_id: 'w1' }] });
    expect(await rewindRepository(db, () => db).workspaceOf('Acme/Widgets', PRD)).toBe('w1');
    expect(calls).toEqual([['select', 'prd_main_watch', 'workspace_id', ['repository', 'acme/widgets'], ['prd', 7]]]);
    expect(await rewindRepository(recording({}).db, () => db).workspaceOf('acme/widgets', PRD)).toBeNull();
  });

  it('reads a PRD\'s findings oldest first, and leaves out a state it does not know', async () => {
    const { calls, db } = recording({ rewind_findings: [stored, { ...stored, id: 'f2', state: 'paused' }, { ...stored, id: 'f3', state: 'rejected', reason: 'no' }] });
    const found = await findingsOf(db, { workspace_id: 'w1', repository: 'Acme/Widgets', prd: PRD });
    expect(found.map((f) => [f.id, f.state, f.reason])).toEqual([['f1', 'proposed', null], ['f3', 'rejected', 'no']]);
    expect(calls).toEqual([[
      'select', 'rewind_findings', 'id, check_name, origin, happened, evidence, fix, state, reason',
      ['workspace_id', 'w1'], ['repository', 'acme/widgets'], ['prd', 7], ['order', 'proposed_at'],
    ]]);
  });

  it('inserts findings as the service, with only the columns the rewind writes', async () => {
    const caller = recording({});
    const service = recording({});
    const done = await rewindRepository(caller.db, () => service.db).insert('w1', 'Acme/Widgets', PRD, [
      { check: 'ci', origin: 'repository', happened: 'x', evidence: ['https://a.test/1'], fix: 'y' },
    ]);
    expect(done).toBe('ok');
    expect(caller.calls).toEqual([]);
    expect(service.calls).toEqual([['insert', 'rewind_findings', [
      { workspace_id: 'w1', repository: 'acme/widgets', prd: 7, check_name: 'ci', origin: 'repository', happened: 'x', evidence: ['https://a.test/1'], fix: 'y' },
    ]]]);
  });

  it('answers duplicate on the unique key, and throws on any other refusal', async () => {
    const one: RewindFinding[] = [{ check: 'ci', origin: 'repository', happened: 'x', evidence: ['https://a.test/1'], fix: 'y' }];
    const twice = recording({}, { code: '23505', message: 'duplicate key' });
    expect(await rewindRepository(twice.db, () => twice.db).insert('w1', 'a/b', PRD, one)).toBe('duplicate');
    const refused = recording({}, { code: '42501', message: 'denied' });
    await expect(rewindRepository(refused.db, () => refused.db).insert('w1', 'a/b', PRD, one)).rejects.toThrow('denied');
  });
});

describe('the rows\' schemas', () => {
  it('parse the rows as read, and refuse each broken copy', () => {
    expect(StoredFinding.safeParse(stored).success).toBe(true);
    for (const [name, row] of brokenRows(stored, { missing: 'fix', wrongType: ['evidence', 'a link'], notNull: 'happened' })) {
      expect(StoredFinding.safeParse(row).success, name).toBe(false);
    }
    expect(StoredWatchWorkspace.safeParse({ workspace_id: 'w1' }).success).toBe(true);
    expect(StoredWatchWorkspace.safeParse({}).success).toBe(false);
  });
});
