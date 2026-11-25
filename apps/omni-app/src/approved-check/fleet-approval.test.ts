import { describe, expect, it } from 'vitest';
import { recordReader } from './record.ts';
import { approvedVerdict } from './state.ts';

// Bug #3309: a fleet's approval of a mission's product PRD (BR-PRODUCT-144) is an approval row naming the
// fleet and the mission, its `approved_by` the mission's id, since a fleet has no account. The omni/approved
// check read that id in the workspace's members, found none, and refused the approval as a non-member's.
// As dossier_approval() reads it (supabase/migrations/20270124130000_mission_committee.sql), it counts while
// its fleet is a live Virtual Fleet of the PRD's workspace, and a person's approval keeps the member rule.

const hash = (c: string) => c.repeat(64);
const PRD = { key: 'acme', seq: 27, id: 'acme-27' };
const MISSION = 'm-3270';

type Seen = { table: string; query: URLSearchParams };

/** A fetch answering each table from `tables` (a table it names no answer for answers `[]`), filtering
 * `teams` by its `eq.` and `is.null` filters as the database would. */
function tablesFetch(tables: Record<string, Array<Record<string, unknown>>>) {
  const seen: Seen[] = [];
  const fetch: typeof globalThis.fetch = (input) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const table = url.pathname.replace('/rest/v1/', '');
    seen.push({ table, query: url.searchParams });
    const rows = (tables[table] ?? []).filter((row) => [...url.searchParams].every(([column, filter]) => {
      if (!(column in row)) return true;
      if (filter === 'is.null') return row[column] === null;
      return filter.startsWith('eq.') ? String(row[column]) === filter.slice(3) : true;
    }));
    return Promise.resolve(new Response(JSON.stringify(rows), { status: 200, headers: { 'content-type': 'application/json' } }));
  };
  return { fetch, seen };
}

const FILES = [
  { kind: 'spec', path: 'spec.md', sha256: hash('a'), version_id: 'v-spec' },
  { kind: 'plan', path: 'plan.md', sha256: hash('b'), version_id: 'v-plan' },
];
const VERSIONS = [
  { id: 'v-plan', kind: 'plan', sha256: hash('b'), commit_sha: null, created_at: '2026-11-25T08:00:00Z', content: 'text' },
  { id: 'v-spec', kind: 'spec', sha256: hash('a'), commit_sha: null, created_at: '2026-11-25T08:00:00Z', content: 'text' },
];
const FLEET_APPROVAL = {
  id: 'ap-fleet', approved_by: MISSION, approver_login: 'fleet invicibles', approved_at: '2026-11-25T08:50:54.127+00:00',
  files: FILES, approval_kind: 'product', fleet: 'invicibles', mission_id: MISSION,
};
const INVICIBLES = { workspace_id: 'w-acme', name: 'invicibles', kind: 'virtual', retired_at: null };

const tables = (over: Record<string, Array<Record<string, unknown>>> = {}) => ({
  product_repositories: [{ product_id: 'p-acme', workspace_id: 'w-acme', products: { key: 'acme' } }],
  dossiers: [{ id: 'd-27' }],
  dossier_versions: VERSIONS,
  approvals: [FLEET_APPROVAL],
  workspace_members: [{ user_id: 'u-pm' }],
  teams: [INVICIBLES],
  ...over,
});

const checkOf = async (db: ReturnType<typeof tablesFetch>) => {
  const record = await recordReader({ url: 'https://db.example', key: 'service-key', fetch: db.fetch })('demo-org/widgets', PRD);
  return approvedVerdict(PRD, { reachable: true, record });
};

describe('bug #3309: the omni/approved check reads a fleet\'s approval as its mission\'s, while the fleet lives', () => {
  it('passes a PRD the mission\'s fleet approved, its fleet a live Virtual Fleet of the PRD\'s workspace', async () => {
    const verdict = await checkOf(tablesFetch(tables()));
    expect(verdict.title).toBe('building · 2 of 2 pinned');
    expect(verdict.conclusion).toBe('success');
  });

  it('refuses it, saying why, once the fleet is retired or gone from the workspace', async () => {
    for (const teams of [[{ ...INVICIBLES, retired_at: '2026-11-25T09:00:00Z' }], [{ ...INVICIBLES, workspace_id: 'w-other' }], [{ ...INVICIBLES, kind: 'person' }], []]) {
      const verdict = await checkOf(tablesFetch(tables({ teams })));
      expect(verdict.conclusion).toBe('failure');
      expect(verdict.title).toBe('refused · fleet invicibles no longer exists in the workspace');
    }
  });

  it('keeps a person\'s approval to the member rule, never reading the fleets', async () => {
    const person = { ...FLEET_APPROVAL, approved_by: 'u-gone', approver_login: 'gone', fleet: null, mission_id: null };
    const db = tablesFetch(tables({ approvals: [person] }));
    const verdict = await checkOf(db);
    expect(verdict.title).toBe('refused · approver gone is not a workspace member');
    expect(db.seen.map((s) => s.table)).not.toContain('teams');
  });
});
