import { describe, expect, it } from 'vitest';
import { parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { attestationRepository, type AttestationDb } from './attestation.repository';

// The Attestation page's storage (PRD 1612 s4), on a stubbed client: what the member reads of a ◆ PRD's
// approval record, through the PRD page's approval code and beside it; not found for anything but a
// numbered PRD; a ◇ PRD named by its number; a failed read throws.

const DOSSIER = '11111111-1111-4111-8111-111111111111';
const WORKSPACE = '22222222-2222-4222-8222-222222222222';
const PRODUCT = '33333333-3333-4333-8333-333333333333';

type Tables = Record<string, unknown[] | { error: string }>;

/** A client whose every query on a table answers its rows (`maybeSingle`, the first or null), and
 * every rpc the `rpc:<name>` rows; it records each table read. */
function stubDb(tables: Tables): AttestationDb & { reads: string[] } {
  const reads: string[] = [];
  const answer = (name: string) => {
    const rows = tables[name] ?? [];
    return Array.isArray(rows) ? { data: rows, error: null } : { data: null, error: { message: rows.error } };
  };
  const query = (name: string) => {
    const result = answer(name);
    const builder: Record<string, unknown> = {
      then: (ok: (value: unknown) => unknown, ko?: (error: unknown) => unknown) => Promise.resolve(result).then(ok, ko),
      maybeSingle: () => Promise.resolve(result.error ? result : { data: (result.data ?? [])[0] ?? null, error: null }),
    };
    for (const method of ['select', 'eq', 'in', 'order', 'limit']) builder[method] = () => builder;
    return builder;
  };
  const db = {
    reads,
    from: (table: string) => {
      reads.push(table);
      return query(table);
    },
    rpc: (name: string) => query(`rpc:${name}`),
  };
  return db as unknown as AttestationDb & { reads: string[] };
}

const dossier = (over: Record<string, unknown> = {}) => ({
  id: DOSSIER, workspace_id: WORKSPACE, home_repo: 'vertuoza/mobile-plan', prd: 918, kind: 'prd', birthplace: 'server', product_id: PRODUCT, ...over,
});
const approval = {
  id: 'approval-1', approved_by: 'user-irisa', approver_login: 'irisa', approved_at: '2026-10-08T14:02:00Z',
  files: [{ kind: 'spec', path: 'spec.md', version_id: 'v-spec', sha256: 'a'.repeat(64) }],
};

const full = (over: Tables = {}): Tables => ({
  dossiers: [dossier()],
  approvals: [approval],
  approval_voids: [],
  product_approvers: [{ user_id: 'user-irisa' }],
  'rpc:ask_members': [{ user_id: 'user-irisa', email: 'i@x', name: 'Irisa' }, { user_id: 'user-ada' }],
  workspaces: [{ name: 'vertuoza' }],
  products: [{ name: 'Mobile' }],
  product_repositories: [{ repository: 'vertuoza/mobile-plan' }, { repository: 'vertuoza/vertuo-api' }],
  dossier_versions: [{ id: 'v-spec', content: '# Spec\n' }],
  ...over,
});

describe('the attestation\'s reads', () => {
  it('reads the approval in force, its approver, the approved texts, the members, the workspace and the product', async () => {
    const facts = await attestationRepository(stubDb(full())).facts(DOSSIER);
    expect(facts).toEqual({
      dossier: { id: DOSSIER, home_repo: 'vertuoza/mobile-plan', prd: parsePrd(918) },
      approval: { id: 'approval-1', approver_login: 'irisa', approved_at: '2026-10-08T14:02:00Z', files: approval.files },
      approvedBy: 'user-irisa',
      contents: new Map([['v-spec', '# Spec\n']]),
      voids: [],
      members: ['user-irisa', 'user-ada'],
      asked: ['user-irisa'],
      workspace: 'vertuoza',
      product: { name: 'Mobile', repos: ['vertuoza/mobile-plan', 'vertuoza/vertuo-api'] },
    });
  });

  it('reads no approver nor text before any approval, and no product when the PRD has none', async () => {
    const db = stubDb(full({ approvals: [], dossiers: [dossier({ product_id: null })] }));
    const facts = await attestationRepository(db).facts(DOSSIER);
    expect(facts).toMatchObject({ approval: null, approvedBy: null, contents: new Map(), product: null, asked: [] });
    expect(db.reads).not.toContain('dossier_versions');
    expect(db.reads).not.toContain('products');
  });

  it('leaves the product\'s approvers unread when they cannot be read', async () => {
    const facts = await attestationRepository(stubDb(full({ product_approvers: { error: 'denied' } }))).facts(DOSSIER);
    expect(facts).toMatchObject({ asked: 'unread' });
  });

  it('is not found for no dossier, a draft or a fix, and names a PRD approved in its repository', async () => {
    expect(await attestationRepository(stubDb(full({ dossiers: [] }))).facts(DOSSIER)).toBe('not-found');
    expect(await attestationRepository(stubDb(full({ dossiers: [dossier({ prd: null })] }))).facts(DOSSIER)).toBe('not-found');
    expect(await attestationRepository(stubDb(full({ dossiers: [dossier({ kind: 'bug' })] }))).facts(DOSSIER)).toBe('not-found');
    expect(await attestationRepository(stubDb(full({ dossiers: [dossier({ birthplace: 'repo' })] }))).facts(DOSSIER)).toEqual({ repoBorn: parsePrd(918) });
  });

  it('throws when a read fails', async () => {
    await expect(attestationRepository(stubDb(full({ workspaces: { error: 'down' } }))).facts(DOSSIER)).rejects.toThrow(/the workspace \(down\)/);
    await expect(attestationRepository(stubDb(full({ dossiers: { error: 'down' } }))).facts(DOSSIER)).rejects.toThrow(/the dossier/);
  });
});
