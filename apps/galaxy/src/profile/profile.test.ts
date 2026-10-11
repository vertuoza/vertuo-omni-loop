import type { SupabaseClient } from '@supabase/supabase-js';
import { parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { describe, expect, it, vi } from 'vitest';
import type { Database } from '../../../../supabase/database.types.ts';
import type { BoardReads } from '../dashboard/board/load';
import type { DossierListRow } from '../dossier/store';

// The profile's server reads (PRD 698 s5) on fakes: the viewer belongs to two workspaces, and the
// person whose profile it is opened PRDs and asked for fixes in both.

const dossier = (id: string, workspace: string, prd: number, kind: DossierListRow['kind']): DossierListRow => ({
  id, workspace_id: workspace, home_repo: 'acme/widgets', prd: parsePrd(prd), kind, title: id, opened_by: 'u-ada', created_at: '2026-09-01T08:00:00Z',
  numbered_at: null, repos: ['acme/widgets'], latest: {}, asked: 0, answered: 0, last_activity: '2026-09-25T08:00:00Z',
});
// What dossier_list() returns the viewer: every dossier of every workspace they belong to.
const EVERY_WORKSPACE = [
  dossier('p7-home', 'w-home', 7, 'prd'),
  dossier('p8-other', 'w-other', 8, 'prd'),
  dossier('b3-home', 'w-home', 3, 'bug'),
  dossier('b4-other', 'w-other', 4, 'bug'),
  dossier('v5-other', 'w-other', 5, 'visual'),
];

const board: BoardReads = {
  roster: () => Promise.resolve([{ userId: 'u-ada', name: 'ADA', login: 'ada-gh', avatarUrl: null, fleet: null }]),
  activity: () => Promise.resolve([]),
  answered: () => Promise.resolve([]),
  galaxy: () => Promise.resolve({ heroes: [], teams: [] }),
  prds: () => Promise.resolve([]),
};

vi.mock('server-only', () => ({}));
vi.mock('../data/workspace', async (actual) => ({
  ...(await actual<typeof import('../data/workspace')>()),
  memberWorkspace: () => Promise.resolve({ id: 'w-home', slug: 'home', name: 'Home', theme: null }),
}));
vi.mock('../dashboard/board/load', async (actual) => ({
  ...(await actual<typeof import('../dashboard/board/load')>()),
  supabaseReads: () => board,
}));
vi.mock('../data/load-galaxy', async (actual) => ({
  ...(await actual<typeof import('../data/load-galaxy')>()),
  loadGalaxy: () => Promise.resolve({ heroes: [], teams: [] }),
}));
vi.mock('./stored', async (actual) => ({ ...(await actual<typeof import('./stored')>()), readTracked: () => Promise.resolve([]) }));
vi.mock('../dossier/page/source', async (actual) => ({
  ...(await actual<typeof import('../dossier/page/source')>()),
  readHistory: () => Promise.resolve(EVERY_WORKSPACE),
}));
vi.mock('../dossier/page/history', async (actual) => ({
  ...(await actual<typeof import('../dossier/page/history')>()),
  readCurrentStages: () => Promise.resolve(new Map()),
}));
vi.mock('../fixes/facts/store', async (actual) => ({
  ...(await actual<typeof import('../fixes/facts/store')>()),
  fixFactsStore: () => ({ readFacts: () => Promise.resolve(new Map()) }),
}));

const { loadProfileBoard } = await import('./profile');

describe('a person\'s PRDs and fixes on their profile', () => {
  // Law BR-PRODUCT-55 (.omni-loop/knowledge/product/rules.md, #1516).
  it('law BR-PRODUCT-55: lists only the profile\'s workspace\'s PRDs and fixes; see all opens the full list across workspaces', async () => {
    const db = {} as SupabaseClient<Database>;
    const value = await loadProfileBoard(db, { id: 'u-bob', email: 'bob@example.com' }, 'ada-gh', '30d', new Date('2026-09-26T10:00:00Z'));
    if (value.kind !== 'profile' || value.lists === 'unreadable') throw new Error(`no lists: ${value.kind}`);
    expect(value.lists.prd.rows.map((row) => row.id)).toEqual(['p7-home']);
    expect(value.lists.bug.rows.map((row) => row.id)).toEqual(['b3-home']);
    expect(value.lists.visual.rows).toEqual([]);
    // See all names the person only, no workspace: the lists it opens span every shared workspace.
    expect(value.lists.prd.moreHref).toBe('/prd?who=ada-gh');
    expect(value.lists.bug.moreHref).toBe('/bugs?who=ada-gh');
    expect(value.lists.visual.moreHref).toBe('/visual?who=ada-gh');
  });
});
