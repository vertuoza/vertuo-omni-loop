import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readRoadmapRecord, readRoadmapVersions } from './RoadmapRecordRead';
import { versionPickOf } from './RoadmapRecord';

// What a product roadmap's page reads of its dossier (PRD 2011, s3), on a fake client: its versions (only the
// roadmap's four parts), its approval from the approvals table by dossier id, the text of the version asked
// for; a part that cannot be read leaves that part saying so, the versions' failure the whole record's.

const DOSSIER = '00000000-0000-4000-8000-0000000000e1';
const VERSIONS = [
  { id: 'd1', kind: 'roadmap', bytes: 3, source: 'kit', created_at: '2026-10-15T08:00:00Z' },
  { id: 'x1', kind: 'spec', bytes: 3, source: 'kit', created_at: '2026-10-15T08:01:00Z' },
  { id: 'd2', kind: 'roadmap', bytes: 4, source: 'kit', created_at: '2026-10-15T09:00:00Z' },
];
const APPROVAL = { id: 'a1', approver_login: 'ada', approved_at: '2026-10-15T09:30:00Z', files: [{ kind: 'roadmap', path: 'roadmap.md', version_id: 'd2' }] };

type Reply = { data: unknown; error: { message: string } | null };

/** A fake client whose `from(table)` answers what `tables` holds, a chain that ends wherever the reader ends it. */
function fake(tables: Record<string, Reply>): Pick<SupabaseClient, 'from'> {
  const chain = (reply: Reply): unknown => {
    const node: Record<string, unknown> = {};
    for (const name of ['select', 'eq', 'order', 'limit']) node[name] = () => node;
    node.maybeSingle = () => Promise.resolve(reply);
    node.then = (resolve: (r: Reply) => unknown) => resolve(reply);
    return node;
  };
  return { from: (table: string) => chain(tables[table] ?? { data: [], error: null }) } as unknown as Pick<SupabaseClient, 'from'>;
}

afterEach(() => { vi.restoreAllMocks(); });

describe('a product roadmap\'s record read', () => {
  it('keeps only the roadmap\'s own parts of the dossier\'s versions', async () => {
    const versions = await readRoadmapVersions(fake({ dossier_versions: { data: VERSIONS, error: null } }), DOSSIER);
    expect(versions.map((v) => v.id)).toEqual(['d1', 'd2']);
  });

  it('reads the versions, the approval in force by the dossier\'s id, and the text of the latest document', async () => {
    const db = fake({
      dossier_versions: { data: VERSIONS, error: null }, approvals: { data: APPROVAL, error: null },
      approval_voids: { data: [], error: null }, dossiers: { data: { product_id: null }, error: null },
    });
    const record = await readRoadmapRecord(db, DOSSIER, versionPickOf(null, null));
    expect(record).toMatchObject({ dossier: DOSSIER, approval: { id: 'a1' }, voids: [], asked: [] });
    expect(record?.versions.map((v) => v.id)).toEqual(['d1', 'd2']);
  });

  it('leaves the approval unread, never the page, when the approval cannot be read', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const record = await readRoadmapRecord(fake({
      dossier_versions: { data: VERSIONS, error: null }, approvals: { data: null, error: { message: 'down' } },
    }), DOSSIER, versionPickOf(null, null));
    expect(record).toMatchObject({ approval: 'unread' });
    expect(logged).toHaveBeenCalled();
  });

  it('is null when the versions cannot be read', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await readRoadmapRecord(fake({ dossier_versions: { data: null, error: { message: 'down' } } }), DOSSIER, versionPickOf(null, null))).toBeNull();
  });
});
