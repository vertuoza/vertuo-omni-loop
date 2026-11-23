import { describe, expect, it } from 'vitest';
import { OLD_ADDRESSES, redirectTarget } from './redirects';

// The old addresses of Questions, Shared with me, Outbox, History and Waiting, and where each lands
// (PRD omni-loop-22, s6): the query is always kept.

describe('the Inbox redirects', () => {
  it('AC-7: each old address lands on its place in the Inbox', () => {
    expect(redirectTarget('/ask', {})).toBe('/app/inbox');
    expect(redirectTarget('/ask/for-me', {})).toBe('/app/inbox?from=shared');
    expect(redirectTarget('/ask/outbox', {})).toBe('/app/inbox?kind=outbox');
    expect(redirectTarget('/ask/history', {})).toBe('/app/inbox/done');
    expect(redirectTarget('/app/waiting', {})).toBe('/app/inbox/workspace');
  });

  it('AC-7: the query is kept, the waiting tab included', () => {
    expect(redirectTarget('/app/waiting', { tab: 'reviews' })).toBe('/app/inbox/workspace?tab=reviews');
    expect(redirectTarget('/ask/history', { q: 'why', who: 'a b' })).toBe('/app/inbox/done?q=why&who=a+b');
    expect(redirectTarget('/ask', { signin_error: 'nope' })).toBe('/app/inbox?signin_error=nope');
    expect(redirectTarget('/ask/outbox', { product: 'p' })).toBe('/app/inbox?kind=outbox&product=p');
  });

  it('keeps a repeated parameter in order and drops an empty one', () => {
    expect(redirectTarget('/ask/history', { repo: ['a', 'b'], skip: undefined })).toBe('/app/inbox/done?repo=a&repo=b');
  });

  it('the address the redirect sets wins over the same name in the query', () => {
    expect(redirectTarget('/ask/for-me', { from: 'x', a: '1' })).toBe('/app/inbox?from=shared&a=1');
    expect(redirectTarget('/ask/outbox', { kind: 'question' })).toBe('/app/inbox?kind=outbox');
  });

  it('names exactly the five old addresses', () => {
    expect([...OLD_ADDRESSES]).toEqual(['/ask', '/ask/for-me', '/ask/outbox', '/ask/history', '/app/waiting']);
  });
});
