import { describe, expect, it } from 'vitest';
import { recordReader } from './record.ts';

type Recorded = { path: string; query: URLSearchParams; apikey: string | null };

const hash = (c: string) => c.repeat(64);
const MOBILE_12 = { key: 'mobile', seq: 12, id: 'mobile-12' };

/**
 * A fetch answering each table's requests, in order, from `tables` (`dossier_versions` is read twice:
 * its versions, then their texts); a table it names no answer for answers `[]`, a `null` answer a refusal.
 */
function tablesFetch(tables: Record<string, (unknown[] | null)[]>) {
  const requests: Recorded[] = [];
  const fetch: typeof globalThis.fetch = (input, init = {}) =>
    new Promise((resolve) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      requests.push({ path: url.pathname, query: url.searchParams, apikey: new Headers(init.headers).get('apikey') });
      const table = url.pathname.replace('/rest/v1/', '');
      const queue = tables[table] ?? [];
      const answer = queue.length > 0 ? queue.shift() : [];
      resolve(answer === null
        ? new Response(JSON.stringify({ message: 'permission denied', code: '42501' }), { status: 403, headers: { 'content-type': 'application/json' } })
        : new Response(JSON.stringify(answer), { status: 200, headers: { 'content-type': 'application/json' } }));
    });
  return { fetch, requests };
}

const HOLDER = [{ product_id: 'p-1', workspace_id: 'w-1', products: { key: 'mobile' } }];
const FILES = [{ kind: 'spec', path: 'spec.md', sha256: hash('a'), version_id: 'v-spec' }, { kind: 'plan', path: 'plan.md', sha256: hash('b'), version_id: 'v-plan-1' }];
const VERSIONS = [
  { id: 'v-plan-2', kind: 'plan', sha256: hash('e'), commit_sha: 'abcdef1234', created_at: '2026-10-11T09:00:00Z' },
  { id: 'v-plan-1', kind: 'plan', sha256: hash('b'), commit_sha: null, created_at: '2026-10-11T07:00:00Z' },
  { id: 'v-spec', kind: 'spec', sha256: hash('a'), commit_sha: null, created_at: '2026-10-11T07:00:00Z' },
];
const APPROVAL = { id: 'ap-1', approved_by: 'u-pm', approver_login: 'pm', approved_at: '2026-10-11T08:00:00+00:00', files: FILES };

const read = (fetch: typeof globalThis.fetch) => recordReader({ url: 'https://db.example', key: 'service-key', fetch });

describe('recordReader — a product PRD\'s record, as the service role, never calling Supabase', () => {
  it('reads the approval in force, its member tick, its voids and the latest version of each kind with the texts the drift test needs', async () => {
    const db = tablesFetch({
      product_repositories: [HOLDER],
      dossiers: [[{ id: 'd-1' }]],
      dossier_versions: [VERSIONS, [{ id: 'v-spec', content: 'spec' }, { id: 'v-plan-1', content: 'plan' }, { id: 'v-plan-2', content: 'plan 2' }]],
      approvals: [[APPROVAL]],
      workspace_members: [[{ user_id: 'u-pm' }]],
      approval_voids: [[{ kind: 'plan', from_sha256: hash('b'), to_sha256: hash('e'), pusher_login: 'dev', voided_at: '2026-10-11T09:00:00+00:00' }]],
    });

    expect(await read(db.fetch)('Acme/Widgets', MOBILE_12)).toEqual({
      dossierId: 'd-1',
      approval: {
        approver: { login: 'pm', member: true },
        approvedAt: '2026-10-11T08:00:00.000Z',
        files: [
          { kind: 'spec', path: 'spec.md', sha256: hash('a'), versionId: 'v-spec', content: 'spec' },
          { kind: 'plan', path: 'plan.md', sha256: hash('b'), versionId: 'v-plan-1', content: 'plan' },
        ],
        voids: [{ pusher: 'dev', kind: 'plan', from: hash('b'), to: hash('e'), voidedAt: '2026-10-11T09:00:00.000Z' }],
      },
      latest: [
        { kind: 'plan', sha256: hash('e'), versionId: 'v-plan-2', commitSha: 'abcdef1234', content: 'plan 2' },
        { kind: 'spec', sha256: hash('a'), versionId: 'v-spec', commitSha: null, content: 'spec' },
      ],
    });
    const [holder, dossier, , , member, , texts] = db.requests;
    expect(holder?.query.get('repository')).toBe('eq.acme/widgets');
    expect(holder?.query.get('products.key')).toBe('eq.mobile');
    expect(holder?.query.get('select')).toContain('products!inner(key)');
    expect(holder?.apikey).toBe('service-key');
    expect([dossier?.query.get('product_id'), dossier?.query.get('product_seq'), dossier?.query.get('kind')]).toEqual(['eq.p-1', 'eq.12', 'eq.prd']);
    expect([member?.query.get('workspace_id'), member?.query.get('user_id')]).toEqual(['eq.w-1', 'eq.u-pm']);
    expect(texts?.query.get('id')).toBe('in.(v-spec,v-plan-1,v-plan-2)');
  });

  it('reads an approver who left as no member, and a PRD nobody approved as no approval', async () => {
    const left = tablesFetch({ product_repositories: [HOLDER], dossiers: [[{ id: 'd-1' }]], dossier_versions: [VERSIONS, []], approvals: [[APPROVAL]], workspace_members: [[]] });
    expect((await read(left.fetch)('acme/widgets', MOBILE_12))?.approval?.approver).toEqual({ login: 'pm', member: false });

    const none = tablesFetch({ product_repositories: [HOLDER], dossiers: [[{ id: 'd-1' }]], dossier_versions: [VERSIONS], approvals: [[]] });
    expect(await read(none.fetch)('acme/widgets', MOBILE_12)).toMatchObject({ dossierId: 'd-1', approval: null });
    expect(none.requests.map((r) => r.path.replace('/rest/v1/', ''))).toEqual(['product_repositories', 'dossiers', 'dossier_versions', 'approvals']);
  });

  it('reads no PRD when no product of that key holds the repository, or it has no PRD of that number', async () => {
    const elsewhere = tablesFetch({ product_repositories: [[]] });
    expect(await read(elsewhere.fetch)('acme/widgets', MOBILE_12)).toBeNull();
    expect(elsewhere.requests).toHaveLength(1);
    const unnumbered = tablesFetch({ product_repositories: [HOLDER], dossiers: [[]] });
    expect(await read(unnumbered.fetch)('acme/widgets', MOBILE_12)).toBeNull();
  });

  it('throws when the database refuses or answers out of shape', async () => {
    await expect(read(tablesFetch({ product_repositories: [null] }).fetch)('acme/widgets', MOBILE_12)).rejects.toThrow(/the database refused: permission denied \(42501\)/);
    await expect(read(tablesFetch({ product_repositories: [[{ product_id: 1 }]] }).fetch)('acme/widgets', MOBILE_12)).rejects.toThrow();
  });
});
