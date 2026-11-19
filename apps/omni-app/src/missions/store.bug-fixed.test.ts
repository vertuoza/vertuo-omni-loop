// The mission store's reads of a bug's way back (PRD 3088 s5), as the service role, never calling Supabase: each request recorded,
// each answer handed.
import { describe, expect, it } from 'vitest';
import { missionStore } from './store.ts';

const FP = 'd'.repeat(64);
const OTHER = 'e'.repeat(64);

type Recorded = { method: string; path: string; query: URLSearchParams };

/** A fetch that records each request and answers with the next of `answers`, as JSON. */
function recordingFetch(answers: unknown[] = []) {
  const requests: Recorded[] = [];
  const fetch: typeof globalThis.fetch = (input, init = {}) =>
    new Promise((resolve) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      requests.push({ method: init.method ?? 'GET', path: url.pathname, query: url.searchParams });
      resolve(new Response(JSON.stringify(answers.shift() ?? []), { status: 200, headers: { 'content-type': 'application/json' } }));
    });
  return { fetch, requests };
}

const storeOn = (fetch: typeof globalThis.fetch) => missionStore({ url: 'https://db.example', key: 'service-key', fetch });

describe('missionStore — a bug\'s way back (PRD 3088 s5)', () => {
  it('reads where a filed bug stands: fixed in its version, won\'t fix, or open', async () => {
    const db = recordingFetch([
      [{ repo: 'vertuoza/vertuo-omni-loop', issue: 3100, state: 'fixed', fixed_in: '0.0.690' }],
      [{ repo: 'vertuoza/vertuo-omni-loop', issue: 3100, state: 'wont-fix', fixed_in: null }],
      [{ repo: 'vertuoza/vertuo-omni-loop', issue: 3100, state: 'merged', fixed_in: null }],
      [{ repo: 'vertuoza/vertuo-omni-loop', issue: 3100 }],
      [],
    ]);
    const store = storeOn(db.fetch);
    expect(await store.bugIssue(FP)).toEqual({ repo: 'vertuoza/vertuo-omni-loop', issue: 3100, fix: { state: 'fixed', version: '0.0.690' } });
    expect(await store.bugIssue(FP)).toMatchObject({ fix: { state: 'wont-fix' } });
    expect(await store.bugIssue(FP)).toMatchObject({ fix: { state: 'open' } });
    expect(await store.bugIssue(FP)).toMatchObject({ fix: { state: 'open' } });
    expect(await store.bugIssue(FP)).toBeNull();
    expect(db.requests[0]?.query.get('select')).toBe('repo,issue,state,fixed_in');
  });

  it('names the paused or stopped missions holding a PRD on a bug that moved, not told yet, by the fingerprint alone', async () => {
    const db = recordingFetch([
      [{ fingerprint: FP }, { fingerprint: OTHER }],
      [
        { mission_id: 'm1', job_id: 'r1', fingerprint: FP },
        { mission_id: 'm2', job_id: 'r2', fingerprint: FP },
        { mission_id: 'm3', job_id: 'r3', fingerprint: OTHER },
      ],
      [{ job_id: 'r1' }],
      [{ id: 'm2', repo: 'acme/widgets' }],
    ]);
    expect(await storeOn(db.fetch).bugTeam?.holders?.()).toEqual([{ id: 'm2', repo: 'acme/widgets' }]);
    const [bugs, repairs, told, missions] = db.requests;
    expect([bugs?.path, bugs?.query.get('state'), bugs?.query.get('select')]).toEqual(['/rest/v1/omni_bug_reports', 'in.(fixed,wont-fix)', 'fingerprint']);
    expect([repairs?.path, repairs?.query.get('fingerprint'), repairs?.query.get('outcome'), repairs?.query.get('trigger'), repairs?.query.get('retro->>class')]).toEqual([
      '/rest/v1/mission_repairs',
      `in.(${FP},${OTHER})`,
      'eq.stopped',
      'eq.failure',
      'eq.omni-loop',
    ]);
    expect([told?.path, told?.query.get('kind'), told?.query.get('job_id')]).toEqual(['/rest/v1/mission_events', 'eq.bug-fixed', 'in.(r1,r2,r3)']);
    expect([missions?.path, missions?.query.get('id'), missions?.query.get('status'), missions?.query.get('select')]).toEqual(['/rest/v1/missions', 'in.(m2,m3)', 'in.(paused,stopped)', 'id,repo']);
  });

  it('reads no further once no bug moved, or no mission stopped on one', async () => {
    const none = recordingFetch([[]]);
    expect(await storeOn(none.fetch).bugTeam?.holders?.()).toEqual([]);
    expect(none.requests).toHaveLength(1);
    const unheld = recordingFetch([[{ fingerprint: FP }], []]);
    expect(await storeOn(unheld.fetch).bugTeam?.holders?.()).toEqual([]);
    expect(unheld.requests).toHaveLength(2);
  });
});
