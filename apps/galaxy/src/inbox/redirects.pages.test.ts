import { describe, expect, it, vi } from 'vitest';

// The five old pages, called as the server calls them (PRD omni-loop-22, s6): each redirects, the query
// kept, to its place in the Inbox. `redirect` throws, as Next's does, with the address it was given.

vi.mock('next/navigation', () => ({
  redirect: (to: string): never => {
    throw new Error(`redirect:${to}`);
  },
}));

const { default: AskHome } = await import('../../app/ask/(shell)/page.tsx');
const { default: ForMePage } = await import('../../app/ask/(shell)/for-me/page.tsx');
const { default: OutboxPage } = await import('../../app/ask/(shell)/outbox/page.tsx');
const { default: HistoryPage } = await import('../../app/ask/(shell)/history/page.tsx');
const { default: WaitingPage } = await import('../../app/app/waiting/page.tsx');

type Page = (props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) => Promise<never>;
const landing = async (page: Page, query: Record<string, string | string[] | undefined> = {}) => {
  const error = await page({ searchParams: Promise.resolve(query) }).then(() => null, (thrown: unknown) => thrown);
  return error instanceof Error ? error.message.replace(/^redirect:/, '') : null;
};

describe('the old Questions and Waiting pages', () => {
  it('AC-7: each lands in the Inbox', async () => {
    expect(await landing(AskHome)).toBe('/app/inbox');
    expect(await landing(ForMePage)).toBe('/app/inbox?from=shared');
    expect(await landing(OutboxPage)).toBe('/app/inbox?kind=outbox');
    expect(await landing(HistoryPage)).toBe('/app/inbox/done');
    expect(await landing(WaitingPage)).toBe('/app/inbox/workspace');
  });

  it('AC-7: each keeps its query', async () => {
    expect(await landing(AskHome, { signin_error: 'nope' })).toBe('/app/inbox?signin_error=nope');
    expect(await landing(ForMePage, { signin_error: 'nope' })).toBe('/app/inbox?from=shared&signin_error=nope');
    expect(await landing(OutboxPage, { product: 'p' })).toBe('/app/inbox?kind=outbox&product=p');
    expect(await landing(HistoryPage, { q: 'why' })).toBe('/app/inbox/done?q=why');
    expect(await landing(WaitingPage, { tab: 'reviews' })).toBe('/app/inbox/workspace?tab=reviews');
  });
});
