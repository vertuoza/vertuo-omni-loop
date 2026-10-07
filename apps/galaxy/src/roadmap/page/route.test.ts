import { describe, expect, it, vi } from 'vitest';

// The Roadmaps pages' one decision (PRD 1162), with the session stubbed: the demo in development and
// signed out (marked so the page shows its sign-in card), closed with no database, the workspace's
// roadmaps signed in, and not found for a roadmap the demo does not hold.

const given = vi.hoisted((): { session: { kind: string; db?: unknown; user?: { id: string } } } => ({ session: { kind: 'sign-in' } }));
const loadRoadmapPage = vi.hoisted(() => vi.fn(() => Promise.resolve({ kind: 'no-workspace' })));

vi.mock('server-only', () => ({}));
vi.mock('../../data/member-session', () => ({ memberSession: () => Promise.resolve(given.session) }));
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
    expect(loadRoadmapPage).toHaveBeenCalledWith(expect.anything(), LIST, NOW);
  });
});
