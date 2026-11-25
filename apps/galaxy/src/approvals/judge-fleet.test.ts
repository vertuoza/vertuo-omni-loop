import { describe, expect, it, vi } from 'vitest';
import { judgeRepository } from './judge.repository';
import { approvalInForce } from './judge.service';

vi.mock('server-only', () => ({}));

// Bug #3309: the judge the App's omni/approved check asks for a repository's PRD read a fleet's approval
// (BR-PRODUCT-144), whose `approved_by` is its mission's id, as a non-member's. As dossier_approval() reads
// it (supabase/migrations/20270124130000_mission_committee.sql), its approver is a member while its fleet is
// a live Virtual Fleet of the dossier's workspace; a person's keeps the member rule.

const DOSSIER = '11111111-1111-4111-8111-111111111111';
const WORKSPACE = '22222222-2222-4222-8222-222222222222';
const APPROVAL = '33333333-3333-4333-8333-333333333333';
const MISSION = '44444444-4444-4444-8444-444444444444';
const PERSON = '00000000-0000-4000-8000-0000000000a4';
const V_SPEC = '55555555-5555-4555-8555-555555555555';

type Row = Record<string, unknown>;

/** A service-role client whose every query answers the rows of its table its `eq` and `is` filters keep. */
function filteringDb(tables: Record<string, Row[]>) {
  const read: string[] = [];
  const db = {
    from(table: string) {
      read.push(table);
      const keep: Array<(row: Row) => boolean> = [];
      const chain: Record<string, unknown> = {
        then: (resolve: (raw: unknown) => unknown) =>
          Promise.resolve({ data: (tables[table] ?? []).filter((row) => keep.every((test) => test(row))), error: null }).then(resolve),
      };
      for (const op of ['select', 'in', 'order', 'limit']) chain[op] = () => chain;
      chain.eq = (column: string, value: unknown) => { keep.push((row) => !(column in row) || row[column] === value); return chain; };
      chain.is = (column: string, value: unknown) => { keep.push((row) => !(column in row) || row[column] === value); return chain; };
      return chain;
    },
  };
  return { read, db: db as unknown as Parameters<typeof judgeRepository>[0] };
}

const FLEET_ROW = {
  id: APPROVAL, approved_by: MISSION, approver_login: 'fleet invicibles', approved_at: '2026-11-25 08:50:54+00',
  files: [{ kind: 'spec', path: 'spec.md', sha256: 'a'.repeat(64), version_id: V_SPEC }],
  approval_kind: 'product', fleet: 'invicibles', mission_id: MISSION,
};
const INVICIBLES = { workspace_id: WORKSPACE, name: 'invicibles', kind: 'virtual', retired_at: null };

const approverOf = async (tables: Record<string, Row[]>) => {
  const stub = filteringDb({
    dossiers: [{ id: DOSSIER, workspace_id: WORKSPACE }],
    approval_voids: [],
    dossier_versions: [],
    workspace_members: [{ workspace_id: WORKSPACE, user_id: PERSON }],
    approvals: [FLEET_ROW],
    teams: [INVICIBLES],
    ...tables,
  });
  const read = await approvalInForce(judgeRepository(stub.db), 'acme/mobile', 7 as never);
  if (!read.ok) throw new Error('the record should read');
  return { approver: read.value?.approval?.approver, read: stub.read };
};

describe('bug #3309: the judge reads a fleet\'s approval as a member\'s while its fleet lives', () => {
  it('reads the approver a member while the fleet is a live Virtual Fleet of the dossier\'s workspace', async () => {
    expect((await approverOf({})).approver).toEqual({ login: 'fleet invicibles', member: true });
  });

  it('reads it no member once the fleet is retired, of another workspace, or gone', async () => {
    for (const teams of [[{ ...INVICIBLES, retired_at: '2026-11-25 09:00:00+00' }], [{ ...INVICIBLES, workspace_id: DOSSIER }], []]) {
      expect((await approverOf({ teams })).approver).toEqual({ login: 'fleet invicibles', member: false });
    }
  });

  it('keeps a person\'s approval to the member rule, never reading the fleets', async () => {
    const person = { ...FLEET_ROW, approved_by: PERSON, approver_login: 'irisa', fleet: null, mission_id: null };
    const { approver, read } = await approverOf({ approvals: [person] });
    expect(approver).toEqual({ login: 'irisa', member: true });
    expect(read).not.toContain('teams');
  });
});
