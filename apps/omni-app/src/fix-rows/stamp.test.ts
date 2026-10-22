import { describe, expect, it } from 'vitest';
import { parsePr, parseProductBugId } from 'omni-loop/kit/lib/ids.ts';
import { fixRowStamper } from './stamp.ts';

type Call = { path: string; body: unknown; key: string | null };

/** A fetch answering every call with `answer`, or a refusal when `answer` is null. */
function rpcFetch(answer: unknown) {
  const calls: Call[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(String(input), init);
    calls.push({ path: new URL(request.url).pathname, body: await request.json(), key: request.headers.get('apikey') });
    return answer === null
      ? new Response(JSON.stringify({ message: 'A stamp is merged, closed or reopened.', code: '22023' }), { status: 400, headers: { 'content-type': 'application/json' } })
      : new Response(JSON.stringify(answer), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  return { fetch, calls };
}

const stamper = (fetch: typeof globalThis.fetch) => fixRowStamper({ url: 'https://db.example', key: 'service-key', fetch });

const STAMP = { repository: 'acme/api', prNumber: parsePr(446), kind: 'merged' as const, at: '2026-10-16T09:00:00Z', bug: parseProductBugId('mobile-B74') };

describe('fixRowStamper — fix_row_stamp() as the service role (PRD 2011 s7)', () => {
  it('calls fix_row_stamp with the repository, the pull request, what happened, when, and the record the body names', async () => {
    const answer = { rows: [{ bug: 'mobile-B74', dossierId: 'd-1', position: 2, state: 'merged' }], shipped: ['mobile-B74'], unmatched: null };
    const db = rpcFetch(answer);
    expect(await stamper(db.fetch)(STAMP)).toEqual(answer);
    expect(db.calls).toEqual([{
      path: '/rest/v1/rpc/fix_row_stamp',
      body: { p_repo: 'acme/api', p_pull: 446, p_event: 'merged', p_at: '2026-10-16T09:00:00Z', p_bug: 'mobile-B74' },
      key: 'service-key',
    }]);
  });

  it('passes no record when the body names none', async () => {
    const db = rpcFetch({ rows: [], shipped: [], unmatched: null });
    await stamper(db.fetch)({ ...STAMP, kind: 'closed', bug: null });
    expect(db.calls[0]?.body).toEqual({ p_repo: 'acme/api', p_pull: 446, p_event: 'closed', p_at: '2026-10-16T09:00:00Z' });
  });

  it('reads a merge that matched no row as kept on the record it names', async () => {
    const db = rpcFetch({ rows: [], shipped: [], unmatched: 'mobile-B74' });
    expect(await stamper(db.fetch)(STAMP)).toEqual({ rows: [], shipped: [], unmatched: 'mobile-B74' });
  });

  it('throws the database\'s refusal with its code', async () => {
    await expect(stamper(rpcFetch(null).fetch)(STAMP)).rejects.toThrow('the database refused: A stamp is merged, closed or reopened. (22023)');
  });

  it('throws on an answer out of shape', async () => {
    for (const answer of ['nothing', {}, { rows: [{ bug: 'mobile-B74', position: 1, state: 'gone' }], shipped: [], unmatched: null }, { rows: [], shipped: ['mobile-74'], unmatched: null }]) {
      const db = rpcFetch(answer);
      await expect(stamper(db.fetch)(STAMP)).rejects.toThrow();
    }
  });
});
