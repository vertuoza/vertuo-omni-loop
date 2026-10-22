import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WaitingScreenProps } from './WaitingScreen';

// /app/waiting (app/app/waiting/page.tsx), called as the server calls it, with its data sources stubbed
// (PRD 2377 s3): it reads the tab and the sign-in refusal from the query and hands the session and the
// query to the controller, which decides the situation.
const session = vi.hoisted(() => ({ kind: 'sign-in' as const }));
const waitingViewOf = vi.hoisted(() => vi.fn<(...args: unknown[]) => Promise<unknown>>(() => Promise.resolve({ kind: 'sign-in' })));

vi.mock('server-only', () => ({}));
vi.mock('../data/member-session', () => ({
  memberSession: () => Promise.resolve(session),
  firstParam: (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null,
}));
vi.mock('./waiting-board.controller', () => ({ waitingViewOf }));

const { default: Page } = await import('../../app/app/waiting/page.tsx');

const propsOf = async (query: Record<string, string> = {}) =>
  ((await Page({ searchParams: Promise.resolve(query) })) as ReactElement<WaitingScreenProps>).props;

beforeEach(() => { waitingViewOf.mockClear(); });

describe('/app/waiting', () => {
  it('hands the session and the whole query to the controller, with the time', async () => {
    const query = { product: 'none', tab: 'workspace' };
    const props = await propsOf(query);
    expect(waitingViewOf).toHaveBeenCalledWith(session, query, expect.any(Date));
    expect(props.view).toEqual({ kind: 'sign-in' });
  });

  it('shows the tab the query names, Workspace for anything else, and carries the sign-in refusal', async () => {
    expect((await propsOf({ tab: 'nonsense' })).tab).toBe('workspace');
    expect((await propsOf({ tab: 'mine' })).tab).toBe('mine');
    expect((await propsOf({ tab: 'reviews' })).tab).toBe('reviews');
    expect((await propsOf({ signin_error: 'nope' })).signinError).toBe('nope');
    expect((await propsOf()).signinError).toBeNull();
  });
});
