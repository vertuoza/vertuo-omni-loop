// The Omni Loop bug report store (PRD 2980 s4) against a stubbed PostgREST: no test calls Supabase.
import { parseIssue, parsePr } from 'omni-loop/kit/lib/ids.ts';
import { describe, expect, it } from 'vitest';
import { bugReportStore, bugTeamStore } from './store.ts';

type Call = { method: string; path: string; search: string; body: unknown };

const FINGERPRINT = 'd'.repeat(64);
const ROW = { fingerprint: FINGERPRINT, repo: 'vertuoza/vertuo-omni-loop', issue: parseIssue(12), count: 2 };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function dbFetch(answer: (call: Call) => Response) {
  const calls: Call[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(String(input), init);
    const url = new URL(request.url);
    const text = request.method === 'GET' ? '' : await request.text();
    const call = { method: request.method, path: url.pathname.replace('/rest/v1/', ''), search: decodeURIComponent(url.search), body: text ? (JSON.parse(text) as unknown) : null };
    calls.push(call);
    return answer(call);
  };
  return { fetch, calls };
}

const store = (fetch: typeof globalThis.fetch) => bugReportStore({ url: 'https://db.example', key: 'service-key', fetch });

describe('bugReportStore', () => {
  it('finds the row of a fingerprint, or none', async () => {
    const db = dbFetch(() => json([ROW]));
    expect(await store(db.fetch).find(FINGERPRINT)).toEqual(ROW);
    expect(db.calls[0]?.search).toContain(`fingerprint=eq.${FINGERPRINT}`);
    expect(await store(dbFetch(() => json([])).fetch).find(FINGERPRINT)).toBeNull();
  });

  it('records a new fingerprint, and answers false when the row is already there', async () => {
    const db = dbFetch(() => new Response(null, { status: 201 }));
    expect(await store(db.fetch).record({ fingerprint: FINGERPRINT, repo: ROW.repo, issue: parseIssue(12) })).toBe(true);
    expect(db.calls[0]).toMatchObject({ method: 'POST', path: 'omni_bug_reports', body: { fingerprint: FINGERPRINT, repo: ROW.repo, issue: parseIssue(12) } });
    const taken = dbFetch(() => json({ message: 'duplicate key', code: '23505' }, 409));
    expect(await store(taken.fetch).record({ fingerprint: FINGERPRINT, repo: ROW.repo, issue: parseIssue(12) })).toBe(false);
  });

  it('throws any other refusal', async () => {
    const refused = dbFetch(() => json({ message: 'permission denied', code: '42501' }, 403));
    await expect(store(refused.fetch).record({ fingerprint: FINGERPRINT, repo: ROW.repo, issue: parseIssue(12) })).rejects.toThrow('permission denied (42501)');
  });

  it('reads the bug team\'s side of a bug by its issue, its fix pull request or its states', async () => {
    const team = { ...ROW, state: 'merged', fix_pr: 40, fixed_in: null };
    const db = dbFetch(() => json([team]));
    expect(await bugTeamStore({ url: 'https://db.example', key: 'service-key', fetch: db.fetch }).byIssue(ROW.repo, parseIssue(12))).toEqual({ fingerprint: FINGERPRINT, repo: ROW.repo, issue: parseIssue(12), state: 'merged', fixPr: parsePr(40), fixedIn: null });
    expect(db.calls[0]?.search).toContain('issue=eq.12');
    await bugTeamStore({ url: 'https://db.example', key: 'service-key', fetch: db.fetch }).byFixPr(ROW.repo, parsePr(40));
    expect(db.calls[1]?.search).toContain('fix_pr=eq.40');
    expect(await bugTeamStore({ url: 'https://db.example', key: 'service-key', fetch: db.fetch }).inStates(['merged', 'fixing'])).toHaveLength(1);
    expect(db.calls[2]?.search).toContain('state=in.(merged,fixing)');
    expect(await bugTeamStore({ url: 'https://db.example', key: 'service-key', fetch: dbFetch(() => json([])).fetch }).byIssue(ROW.repo, parseIssue(12))).toBeNull();
  });

  it('moves a bug only from the state it was read in, writing the facts it is given', async () => {
    const bug = { fingerprint: FINGERPRINT, repo: ROW.repo, issue: parseIssue(12), state: 'merged' as const, fixPr: parsePr(40), fixedIn: null };
    const db = dbFetch(() => json([{ fingerprint: FINGERPRINT }]));
    const team = bugTeamStore({ url: 'https://db.example', key: 'service-key', fetch: db.fetch });
    expect(await team.move(bug, { state: 'fixed', fixedIn: '0.0.680' })).toBe(true);
    expect(db.calls[0]).toMatchObject({ method: 'PATCH', path: 'omni_bug_reports', body: { state: 'fixed', fixed_in: '0.0.680' } });
    expect(db.calls[0]?.search).toContain(`fingerprint=eq.${FINGERPRINT}`);
    expect(db.calls[0]?.search).toContain('state=eq.merged');
    expect(db.calls[0]?.body).not.toHaveProperty('fix_pr');
    await team.move(bug, { state: 'open', fixPr: null, fixedIn: null });
    expect(db.calls[1]?.body).toEqual({ state: 'open', fix_pr: null, fixed_in: null });
    expect(await bugTeamStore({ url: 'https://db.example', key: 'service-key', fetch: dbFetch(() => json([])).fetch }).move(bug, { state: 'fixed', fixedIn: '0.0.680' })).toBe(false);
    const refused = dbFetch(() => json({ message: 'permission denied', code: '42501' }, 403));
    await expect(bugTeamStore({ url: 'https://db.example', key: 'service-key', fetch: refused.fetch }).move(bug, { state: 'open' })).rejects.toThrow('permission denied (42501)');
  });

  it('counts a repeat in one statement and reads the row it answers', async () => {
    const db = dbFetch(() => json([ROW]));
    expect(await store(db.fetch).seen(FINGERPRINT)).toEqual(ROW);
    expect(db.calls[0]).toMatchObject({ method: 'POST', path: 'rpc/omni_bug_report_seen', body: { p_fingerprint: FINGERPRINT } });
  });
});
