import { describe, expect, it } from 'vitest';
import { parsePr, parsePrd } from 'omni-loop/kit/lib/ids.ts';
import type { RewindFinding } from 'omni-loop/kit/lib/rewind/findings.ts';
import { brokenRows } from '../data/broken-rows.fake';
import { decisionRepository, findingsOf, rewindRepository, StoredDecidable, StoredDecider, StoredFinding, StoredWatchWorkspace } from './rewind.repository';

// The rewind's storage (PRD 2410, s5) on recording clients: reads as the caller with the repository in lower
// case, inserts as the service with only the columns the rewind writes. That members read and nobody else
// does is proved by supabase/checks/main_watch.sql.

const PRD = parsePrd(7);
const stored = { id: 'f1', check_name: 'ci', origin: 'repository', happened: 'x', evidence: ['https://a.test/1'], fix: 'y', state: 'proposed', reason: null, decided_by: null, decided_at: null, outcome: null, outcome_pr: null, outcome_note: null };

type Call = unknown[];

function recording(rows: Record<string, unknown[]>, insertError: { code?: string; message: string } | null = null) {
  const calls: Call[] = [];
  const from = (table: string) => ({
    select: (columns: string) => {
      const filters: Call = [];
      const chain = {
        eq: (column: string, value: unknown) => { filters.push([column, value]); return chain; },
        in: (column: string, values: unknown[]) => { filters.push([column, 'in', values]); return chain; },
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

type Answer = { data?: unknown; error?: { code?: string; message: string } | null };

/** A client that records each call, reads `rows` and answers each function from `answers`. */
function withRpc(rows: Record<string, unknown[]>, answers: Record<string, Answer> = {}) {
  const base = recording(rows);
  const rpc = (fn: string, args: unknown) => {
    base.calls.push(['rpc', fn, args]);
    const answer = answers[fn] ?? {};
    return Promise.resolve({ data: answer.data ?? null, error: answer.error ?? null });
  };
  return { calls: base.calls, db: { from: (base.db as { from: unknown }).from, rpc } as never };
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
      'select', 'rewind_findings', 'id, check_name, origin, happened, evidence, fix, state, reason, decided_by, decided_at, outcome, outcome_pr, outcome_note',
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

describe('who decided a finding (PRD 2410, s7)', () => {
  it('reads the deciders\' logins from the workspace\'s players, once each, and only when something was decided', async () => {
    const decided = { ...stored, id: 'f2', state: 'approved', decided_by: 'u-ada', decided_at: '2026-10-21T09:30:00Z' };
    const unknown = { ...stored, id: 'f3', state: 'rejected', reason: 'no', decided_by: 'u-gone', decided_at: '2026-10-22T09:30:00Z' };
    const { calls, db } = recording({ rewind_findings: [stored, decided, { ...decided, id: 'f4' }, unknown], players: [{ user_id: 'u-ada', github_login: 'ada-gh' }] });
    const found = await findingsOf(db, { workspace_id: 'w1', repository: 'acme/widgets', prd: PRD });
    expect(found.map((f) => [f.id, f.decidedBy, f.decidedAt])).toEqual([
      ['f1', null, null], ['f2', 'ada-gh', '2026-10-21T09:30:00Z'], ['f4', 'ada-gh', '2026-10-21T09:30:00Z'], ['f3', null, '2026-10-22T09:30:00Z'],
    ]);
    expect(calls.at(-1)).toEqual(['select', 'players', 'user_id, github_login', ['workspace_id', 'w1'], ['user_id', 'in', ['u-ada', 'u-gone']]]);
    const none = recording({ rewind_findings: [stored] });
    await findingsOf(none.db, { workspace_id: 'w1', repository: 'acme/widgets', prd: PRD });
    expect(none.calls.map((c) => c[1])).toEqual(['rewind_findings']);
  });
});

describe('the decision\'s storage (PRD 2410, s7)', () => {
  const ID = '6f1c1b1e-8a0e-4c1f-9d55-2c1f7b0e9a11';
  const row = { ...stored, id: ID, workspace_id: 'w1', repository: 'acme/widgets', prd: 7 };

  it('reads the finding to decide as the member, with whose it is', async () => {
    const { calls, db } = withRpc({ rewind_findings: [row] });
    expect(await decisionRepository(db).finding(ID)).toEqual({
      id: ID, check: 'ci', origin: 'repository', happened: 'x', evidence: ['https://a.test/1'], fix: 'y', state: 'proposed', reason: null,
      decidedBy: null, decidedAt: null, outcome: null, workspace: 'w1', repository: 'acme/widgets', prd: 7,
    });
    expect(calls).toEqual([['select', 'rewind_findings', 'workspace_id, repository, prd, id, check_name, origin, happened, evidence, fix, state, reason, decided_by, decided_at, outcome, outcome_pr, outcome_note', ['id', ID]]]);
    expect(await decisionRepository(withRpc({}).db).finding(ID)).toBeNull();
  });

  it('decides through the database\'s functions, as the member, the reason only when there is one', async () => {
    const { calls, db } = withRpc({});
    const repository = decisionRepository(db);
    expect(await repository.approve('w1', ID)).toBeNull();
    expect(await repository.reject('w1', ID, 'Not ours')).toBeNull();
    expect(await repository.reject('w1', ID, null)).toBeNull();
    expect(calls).toEqual([
      ['rpc', 'rewind_finding_approve', { p_workspace: 'w1', p_finding: ID }],
      ['rpc', 'rewind_finding_reject', { p_workspace: 'w1', p_finding: ID, p_reason: 'Not ours' }],
      ['rpc', 'rewind_finding_reject', { p_workspace: 'w1', p_finding: ID }],
    ]);
  });

  it('reads the database\'s refusals by their code, and throws on any other', async () => {
    const refusing = (error: { code?: string; message: string }) => decisionRepository(withRpc({}, { rewind_finding_approve: { error }, rewind_finding_reject: { error } }).db);
    expect(await refusing({ code: 'P0002', message: 'Finding: no such finding in this workspace.' }).approve('w1', ID)).toBe('missing');
    expect(await refusing({ code: '42501', message: 'Finding: already approved, and a decision is never rewritten.' }).reject('w1', ID, null)).toBe('decided');
    expect(await refusing({ code: '42501', message: 'Only a member of the workspace decides its rewind findings.' }).approve('w1', ID)).toBe('not-member');
    await expect(refusing({ code: '08006', message: 'connection lost' }).approve('w1', ID)).rejects.toThrow('connection lost');
    await expect(refusing({ code: '08006', message: 'connection lost' }).reject('w1', ID, null)).rejects.toThrow('connection lost');
  });

  it('files a proposal on the repository\'s product, as the member', async () => {
    const { calls, db } = withRpc({}, { knowledge_product_for_repo: { data: { id: 'p1', workspace: 'w1', name: 'Widgets' } } });
    const plan = { kind: 'proposal', knowledge: 'glossary', fields: { term: 'rewind', meaning: 'The walk back.' } } as const;
    expect(await decisionRepository(db).propose('Acme/Widgets', 'w1', plan)).toEqual({ ok: true, product: 'p1' });
    expect(calls).toEqual([
      ['rpc', 'knowledge_product_for_repo', { p_repo: 'acme/widgets' }],
      ['rpc', 'product_knowledge_propose', { p_workspace: 'w1', p_product: 'p1', p_kind: 'glossary', p_action: 'add', p_fields: { term: 'rewind', meaning: 'The walk back.' } }],
    ]);
  });

  it('answers the database\'s words when the product or the proposal is refused', async () => {
    const plan = { kind: 'proposal', knowledge: 'legal', fields: { code: 'GDPR', statement: 's', source: 'x' } } as const;
    const noProduct = withRpc({}, { knowledge_product_for_repo: { error: { code: 'P0002', message: 'acme/widgets is in no product.' } } });
    expect(await decisionRepository(noProduct.db).propose('acme/widgets', 'w1', plan)).toEqual({ ok: false, error: 'acme/widgets is in no product.' });
    expect(noProduct.calls).toHaveLength(1);
    const refused = withRpc({}, { knowledge_product_for_repo: { data: { id: 'p1' } }, product_knowledge_propose: { error: { code: '22023', message: 'Code: one word.' } } });
    expect(await decisionRepository(refused.db).propose('acme/widgets', 'w1', plan)).toEqual({ ok: false, error: 'Code: one word.' });
    const odd = withRpc({}, { knowledge_product_for_repo: { data: 'p1' } });
    await expect(decisionRepository(odd.db).propose('acme/widgets', 'w1', plan)).rejects.toThrow('out of shape');
  });
});

describe('an approved finding\'s outcome (PRD 2498, s2)', () => {
  const ID = '6f1c1b1e-8a0e-4c1f-9d55-2c1f7b0e9a11';
  const approved = { ...stored, state: 'approved', decided_by: null, decided_at: '2026-10-21T09:30:00Z' };
  const read = async (more: Record<string, unknown>) => (await findingsOf(recording({ rewind_findings: [{ ...approved, ...more }] }).db, { workspace_id: 'w1', repository: 'Acme/Widgets', prd: PRD }))[0]?.outcome;

  it('reads each outcome with the finding, the pull request linked on its repository', async () => {
    expect(await read({})).toBeNull();
    expect(await read({ outcome: 'proposed', outcome_pr: 42 })).toEqual({ kind: 'proposed', pr: 42, url: 'https://github.com/acme/widgets/pull/42' });
    expect(await read({ outcome: 'already', outcome_note: 'playbook/testing#where-tests-live' })).toEqual({ kind: 'already', rule: 'playbook/testing#where-tests-live' });
    expect(await read({ outcome: 'asks', outcome_note: 'Which form?' })).toEqual({ kind: 'asks', question: 'Which form?' });
  });

  it('reads an outcome this build does not know, or without its value, as none', async () => {
    expect(await read({ outcome: 'merged', outcome_pr: 4 })).toBeNull();
    expect(await read({ outcome: 'proposed' })).toBeNull();
    expect(await read({ outcome: 'asks' })).toBeNull();
  });

  it('reads the workspace of a finding as the caller, and none when they read none', async () => {
    const { calls, db } = withRpc({ rewind_findings: [{ ...stored, workspace_id: 'w1', repository: 'acme/widgets', prd: 7 }] });
    expect(await rewindRepository(db, () => db).workspaceOfFinding(ID)).toBe('w1');
    expect(calls).toHaveLength(1);
    expect(await rewindRepository(withRpc({}).db, () => db).workspaceOfFinding(ID)).toBeNull();
  });

  it('records through the database\'s function, as the caller, sending only what the outcome carries', async () => {
    const { calls, db } = withRpc({});
    const repository = rewindRepository(db, () => db);
    expect(await repository.recordOutcome('w1', ID, { outcome: 'proposed', pr: parsePr(42) })).toBeNull();
    expect(await repository.recordOutcome('w1', ID, { outcome: 'asks', note: 'Which form?' })).toBeNull();
    expect(calls).toEqual([
      ['rpc', 'rewind_finding_outcome', { p_workspace: 'w1', p_finding: ID, p_outcome: 'proposed', p_pr: 42 }],
      ['rpc', 'rewind_finding_outcome', { p_workspace: 'w1', p_finding: ID, p_outcome: 'asks', p_note: 'Which form?' }],
    ]);
  });

  it('reads the database\'s refusals by their code and hint, and throws on any other', async () => {
    const refusing = (error: { code?: string; hint?: string; message: string }) => rewindRepository(withRpc({}, { rewind_finding_outcome: { error } }).db, () => withRpc({}).db);
    const body = { outcome: 'already', note: 'x' } as const;
    expect(await refusing({ code: 'P0002', message: 'Finding: no such finding in this workspace.' }).recordOutcome('w1', ID, body)).toMatchObject({ kind: 'missing' });
    expect(await refusing({ code: '42501', hint: 'finding', message: 'Finding: proposed, and only an approved finding has an outcome.' }).recordOutcome('w1', ID, body))
      .toEqual({ kind: 'unapproved', error: 'Finding: proposed, and only an approved finding has an outcome.' });
    expect(await refusing({ code: '42501', hint: 'outcome', message: 'Outcome: already asks, and an outcome is never rewritten.' }).recordOutcome('w1', ID, body))
      .toEqual({ kind: 'recorded', error: 'Outcome: already asks, and an outcome is never rewritten.' });
    expect(await refusing({ code: '42501', message: 'Only the Omni App or a member of the workspace records a rewind finding\'s outcome.' }).recordOutcome('w1', ID, body)).toMatchObject({ kind: 'not-allowed' });
    expect(await refusing({ code: '22023', hint: 'pr', message: 'Pull request: only a proposed rule names one.' }).recordOutcome('w1', ID, body))
      .toEqual({ kind: 'malformed', error: 'Pull request: only a proposed rule names one.' });
    await expect(refusing({ code: '08006', message: 'connection lost' }).recordOutcome('w1', ID, body)).rejects.toThrow('connection lost');
  });

  it('parses the outcome columns, and refuses a broken copy', () => {
    const withOutcome = { ...approved, outcome: 'proposed', outcome_pr: 42 };
    expect(StoredFinding.safeParse(withOutcome).success).toBe(true);
    for (const [name, row] of brokenRows(withOutcome, { missing: 'outcome', wrongType: ['outcome_pr', 'forty-two'], notNull: 'happened' })) {
      expect(StoredFinding.safeParse(row).success, name).toBe(false);
    }
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

  it('parse a decided finding, a finding to decide and a decider, and refuse their broken copies (PRD 2410, s7)', () => {
    const decided = { ...stored, state: 'approved', decided_by: 'u-ada', decided_at: '2026-10-21T09:30:00Z' };
    expect(StoredFinding.safeParse(decided).success).toBe(true);
    for (const [name, row] of brokenRows(decided, { missing: 'decided_at', wrongType: ['decided_by', 7], notNull: 'state' })) {
      expect(StoredFinding.safeParse(row).success, name).toBe(false);
    }
    const decidable = { ...stored, workspace_id: 'w1', repository: 'acme/widgets', prd: 7 };
    expect(StoredDecidable.safeParse(decidable).success).toBe(true);
    for (const [name, row] of brokenRows(decidable, { missing: 'workspace_id', wrongType: ['prd', 0], notNull: 'repository' })) {
      expect(StoredDecidable.safeParse(row).success, name).toBe(false);
    }
    expect(StoredDecider.safeParse({ user_id: 'u-ada', github_login: null }).success).toBe(true);
    expect(StoredDecider.safeParse({ user_id: 'u-ada' }).success).toBe(false);
  });
});
