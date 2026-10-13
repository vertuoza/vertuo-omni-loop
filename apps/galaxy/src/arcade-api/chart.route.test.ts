import { beforeEach, describe, expect, it, vi } from 'vitest';

// The star chart's route file (app/api/arcade/chart), called as Next calls it, with its real
// dependencies (./chart-live.ts) over a stubbed session, membership and knowledge (PRD 1808 s2): the
// crew gets the chart, the outsider and the signed-out visitor do not, and a build without a
// knowledge base answers 'none'. Nothing reads Supabase or the disk.

const given = vi.hoisted(() => ({
  database: true,
  user: null as { id: string } | null,
  workspace: null as { id: string } | null,
  root: '/checkout' as string | null,
}));
const loadKnowledge = vi.hoisted(() => vi.fn(() => ({ version: 1, repo: 'acme/widgets', domains: [], entries: [], links: [], loose: [], unserved: [] })));

vi.mock('server-only', () => ({}));
vi.mock('../data/supabase-server', () => ({
  supabaseEnv: () => (given.database ? { url: 'http://127.0.0.1:54321', key: 'anon' } : null),
  supabaseServer: () => Promise.resolve({ auth: { getUser: () => Promise.resolve({ data: { user: given.user } }) } }),
}));
vi.mock('../data/workspace', () => ({ memberWorkspace: () => Promise.resolve(given.workspace) }));
vi.mock('../data/load-knowledge', () => ({ checkoutRoot: () => given.root, loadKnowledge }));

const route = await import('../../app/api/arcade/chart/route');

beforeEach(() => {
  Object.assign(given, { database: true, user: null, workspace: null, root: '/checkout' });
  loadKnowledge.mockClear();
});

describe('GET /api/arcade/chart', () => {
  it.each([true, false])('answers 401 signed out, and reads no knowledge (database: %s)', async (database) => {
    given.database = database;
    const answer = await route.GET();
    expect(answer.status).toBe(401);
    expect(loadKnowledge).not.toHaveBeenCalled();
  });

  it('answers 403 to a signed-in person in no workspace', async () => {
    given.user = { id: 'u1' };
    const answer = await route.GET();
    expect(answer.status).toBe(403);
    expect(loadKnowledge).not.toHaveBeenCalled();
  });

  it('answers the crew the knowledge graph', async () => {
    given.user = { id: 'u1' };
    given.workspace = { id: 'w1' };
    const answer = await route.GET();
    expect(answer.status).toBe(200);
    expect(await answer.json()).toMatchObject({ chart: { version: 1, repo: 'acme/widgets' } });
  });

  it("answers 'none' to the crew in a build without a knowledge base", async () => {
    given.user = { id: 'u1' };
    given.workspace = { id: 'w1' };
    given.root = null;
    const answer = await route.GET();
    expect(await answer.json()).toEqual({ chart: 'none' });
    expect(loadKnowledge).not.toHaveBeenCalled();
  });
});
