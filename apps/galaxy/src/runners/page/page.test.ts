import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RunnersPageProps } from './RunnersPage';

// /app/runners (app/app/runners/page.tsx), called as the server calls it, with its data sources stubbed
// (PRD 1830 s3): it decides the situation once.

const given = vi.hoisted((): { session: { kind: string; db?: unknown; user?: { id: string } }; reads: unknown } => ({
  session: { kind: 'sign-in' },
  reads: { reads: true },
}));
const demoRunnersPage = vi.hoisted(() => vi.fn(() => ({ kind: 'board', demo: true })));
const loadRunnersPage = vi.hoisted(() => vi.fn<(...args: unknown[]) => Promise<unknown>>(() => Promise.resolve({ kind: 'board', loaded: true })));
const runnersPageReads = vi.hoisted(() => vi.fn(() => given.reads));

vi.mock('server-only', () => ({}));
vi.mock('../../data/member-session', () => ({
  firstParam: (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null,
  memberSession: () => Promise.resolve(given.session),
}));
vi.mock('./demo', () => ({ demoRunnersPage }));
vi.mock('./live', () => ({ runnersPageReads, runnersPageSupabase: () => null }));
vi.mock('./load', () => ({ loadRunnersPage }));

const { default: RunnersRoute } = await import('../../../app/app/runners/page.tsx');

const props = async (query: Record<string, string> = {}) =>
  ((await RunnersRoute({ searchParams: Promise.resolve(query) })) as ReactElement<RunnersPageProps>).props;

describe('/app/runners', () => {
  beforeEach(() => {
    given.session = { kind: 'sign-in' };
    given.reads = { reads: true };
    vi.clearAllMocks();
  });

  it('draws the demo in development', async () => {
    given.session = { kind: 'demo' };
    expect((await props()).view).toEqual({ kind: 'board', demo: true });
    expect(loadRunnersPage).not.toHaveBeenCalled();
  });

  it('passes the gate\'s situations through, with the sign-in error', async () => {
    for (const kind of ['closed', 'sign-in']) {
      given.session = { kind };
      const seen = await props({ signin_error: 'denied' });
      expect(seen.view).toEqual({ kind });
      expect(seen.signinError).toBe('denied');
    }
  });

  it('passes the job ?terminal= names on, to open its Terminal panel (PRD 1904)', async () => {
    given.session = { kind: 'demo' };
    expect((await props({ terminal: 'job-1' })).terminal).toBe('job-1');
    expect((await props()).terminal).toBeNull();
  });

  it('passes the job ?answer= names on, to open its Need human drawer (PRD 2255)', async () => {
    given.session = { kind: 'demo' };
    expect((await props({ answer: 'job-2' })).answer).toBe('job-2');
    expect((await props()).answer).toBeNull();
  });

  it('loads the board as the signed-in person', async () => {
    given.session = { kind: 'signed-in', db: { db: true }, user: { id: 'u1' } };
    expect((await props()).view).toEqual({ kind: 'board', loaded: true });
    expect(runnersPageReads).toHaveBeenCalledWith({ db: true }, { id: 'u1' });
    expect(loadRunnersPage).toHaveBeenCalledWith({ reads: true }, expect.any(Date));
  });

  it('is closed when the deployment has no service role to read the runners with', async () => {
    given.session = { kind: 'signed-in', db: {}, user: { id: 'u1' } };
    given.reads = null;
    expect((await props()).view).toEqual({ kind: 'closed' });
    expect(loadRunnersPage).not.toHaveBeenCalled();
  });
});
