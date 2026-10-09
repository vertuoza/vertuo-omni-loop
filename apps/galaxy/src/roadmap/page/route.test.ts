import { describe, expect, it, vi } from 'vitest';

// The Roadmaps pages' one decision (PRD 1162), with the session stubbed: the demo in development and
// signed out (marked so the page shows its sign-in card), closed with no database, the workspace's
// roadmaps signed in, and not found for a roadmap the demo does not hold.

const given = vi.hoisted((): { session: { kind: string; db?: unknown; user?: { id: string } }; open: boolean } => ({ session: { kind: 'sign-in' }, open: false }));
const loadRoadmapPage = vi.hoisted(() => vi.fn(() => Promise.resolve({ kind: 'no-workspace' })));

vi.mock('server-only', () => ({}));
vi.mock('../../data/member-session', () => ({ memberSession: () => Promise.resolve(given.session) }));
vi.mock('../../outbox/open', () => ({ sendOpen: () => given.open }));
vi.mock('./load', async (actual) => ({ ...(await actual<typeof import('./load')>()), loadRoadmapPage }));

const { roadmapPageView } = await import('./route');
const { DEMO_ROADMAP } = await import('./demo');
const NOW = new Date('2026-10-20T12:00:00Z');
const LIST = { id: null, product: null };

describe('roadmapPageView', () => {
  it('shows the demo to a person signed out, marked signed out', async () => {
    given.session = { kind: 'sign-in' };
    expect(await roadmapPageView(LIST, NOW)).toMatchObject({ kind: 'list', demo: 'signed-out' });
  });

  it('shows the demo in development, marked so', async () => {
    given.session = { kind: 'demo' };
    expect(await roadmapPageView({ id: DEMO_ROADMAP, product: null }, NOW)).toMatchObject({ kind: 'roadmap', demo: 'development' });
  });

  it('finds no roadmap the demo does not hold', async () => {
    given.session = { kind: 'demo' };
    expect(await roadmapPageView({ id: '00000000-0000-4000-8000-000000000000', product: null }, NOW)).toEqual({ kind: 'not-found' });
  });

  it('is closed with no database', async () => {
    given.session = { kind: 'closed' };
    expect(await roadmapPageView(LIST, NOW)).toEqual({ kind: 'closed' });
  });

  it('reads the workspace\'s roadmaps as the person signed in', async () => {
    given.session = { kind: 'signed-in', db: { from: () => null, rpc: () => null }, user: { id: 'u-1' } };
    expect(await roadmapPageView(LIST, NOW)).toEqual({ kind: 'no-workspace' });
    expect(loadRoadmapPage).toHaveBeenCalledWith(expect.anything(), { ...LIST, tickable: false }, NOW);
  });

  it('offers Mark as done to the person signed in only where marking is open (s7)', async () => {
    given.session = { kind: 'signed-in', db: { from: () => null, rpc: () => null }, user: { id: 'u-1' } };
    given.open = true;
    await roadmapPageView({ id: DEMO_ROADMAP, product: null, ticked: 'p6' }, NOW);
    expect(loadRoadmapPage).toHaveBeenLastCalledWith(expect.anything(), { id: DEMO_ROADMAP, product: null, ticked: 'p6', tickable: true }, NOW);
    given.open = false;
  });

  it('never offers it on the demo', async () => {
    given.session = { kind: 'demo' };
    given.open = true;
    const view = await roadmapPageView({ id: DEMO_ROADMAP, product: null, tab: 'prerequisites' }, NOW);
    const rows = view.kind === 'roadmap' ? view.roadmap.prerequisites.groups.flatMap((g) => g.rows) : [];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((r) => r.tickable)).toBe(false);
    given.open = false;
  });
});
