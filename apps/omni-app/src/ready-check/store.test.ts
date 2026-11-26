import { describe, expect, it } from 'vitest';
import { assertDefined } from 'omni-loop/kit/test/assert.ts';
import { parsePr, parsePrd } from 'omni-loop/kit/lib/ids.ts';
import { readyStore, type SavedVerdict } from './store.ts';

type Recorded = { method: string; path: string; query: URLSearchParams; body: unknown };

/** A fetch that records each request to the database and answers with the next of `answers`. */
function recordingFetch(answers: unknown[] = []) {
  const requests: Recorded[] = [];
  const fetch: typeof globalThis.fetch = (input, init = {}) =>
    new Promise((resolve) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      const body: unknown = typeof init.body === 'string' ? JSON.parse(init.body) : null;
      requests.push({ method: init.method ?? 'GET', path: url.pathname, query: url.searchParams, body });
      const answer: unknown = answers.shift() ?? [];
      resolve(new Response(JSON.stringify(answer), { status: 200, headers: { 'content-type': 'application/json' } }));
    });
  return { fetch, requests };
}

function nth<T>(list: readonly T[], index: number): T {
  const item = list[index];
  assertDefined(item, `request ${String(index)}`);
  return item;
}

const storeOn = (fetch: typeof globalThis.fetch) => readyStore({ url: 'https://db.example', key: 'service-key', fetch });
const PRD = { installationId: 7, repository: 'Acme/Widgets', prd: parsePrd(7) };

describe('readyStore — the ready check as the service role, never calling Supabase (PRD 2898 s7)', () => {
  it('finds a PRD of a live mission\'s scope, inside the installation\'s workspace and the repository, in lower case', async () => {
    const db = recordingFetch([[{ id: 'ws-1' }], [{ scope: { prds: [7], roadmaps: [] } }]]);
    expect(await storeOn(db.fetch).inMission(PRD)).toBe(true);
    expect(nth(db.requests, 0).query.get('github_installation_id')).toBe('eq.7');
    const missions = nth(db.requests, 1);
    expect(missions.path).toBe('/rest/v1/missions');
    expect([missions.query.get('workspace_id'), missions.query.get('repo'), missions.query.get('status')]).toEqual(['eq.ws-1', 'eq.acme/widgets', 'in.(running,waiting,paused)']);
    expect(db.requests).toHaveLength(2);
  });

  it('finds a PRD through a row of one of a live mission\'s roadmaps', async () => {
    const db = recordingFetch([[{ id: 'ws-1' }], [{ scope: { prds: [8], roadmaps: [40, 41] } }, { scope: { prds: [], roadmaps: [40] } }], [{ id: 'rm-40' }], [{ roadmap_id: 'rm-40' }]]);
    expect(await storeOn(db.fetch).inMission(PRD)).toBe(true);
    const roadmaps = nth(db.requests, 2);
    expect([roadmaps.path, roadmaps.query.get('workspace_id'), roadmaps.query.get('repo'), roadmaps.query.get('number')]).toEqual(['/rest/v1/roadmaps', 'eq.ws-1', 'eq.acme/widgets', 'in.(40,41)']);
    const rows = nth(db.requests, 3);
    expect([rows.path, rows.query.get('roadmap_id'), rows.query.get('prd')]).toEqual(['/rest/v1/roadmap_prds', 'in.(rm-40)', 'eq.7']);
  });

  it('answers no for a PRD in no live mission, for an installation no workspace holds, and for roadmaps that hold no row of it', async () => {
    expect(await storeOn(recordingFetch([[{ id: 'ws-1' }], []]).fetch).inMission(PRD)).toBe(false);
    const nobody = recordingFetch([[]]);
    expect(await storeOn(nobody.fetch).inMission(PRD)).toBe(false);
    expect(nobody.requests).toHaveLength(1);
    expect(await storeOn(recordingFetch([[{ id: 'ws-1' }], [{ scope: { prds: [], roadmaps: [40] } }], []]).fetch).inMission(PRD)).toBe(false);
    expect(await storeOn(recordingFetch([[{ id: 'ws-1' }], [{ scope: { prds: [], roadmaps: [40] } }], [{ id: 'rm-40' }], []]).fetch).inMission(PRD)).toBe(false);
  });

  it('reads a live mission scoped by product PRD ids without throwing, a product PRD playing no part in a repository PRD\'s verdict (#3322)', async () => {
    const products = recordingFetch([[{ id: 'ws-1' }], [{ scope: { prds: ['widgets-28', 'widgets-29'], roadmaps: ['widgets-R2'] } }]]);
    expect(await storeOn(products.fetch).inMission(PRD)).toBe(false);
    expect(products.requests).toHaveLength(2);
    const mixed = recordingFetch([[{ id: 'ws-1' }], [{ scope: { prds: ['widgets-28'], roadmaps: [] } }, { scope: { prds: [7], roadmaps: [] } }]]);
    expect(await storeOn(mixed.fetch).inMission(PRD)).toBe(true);
  });

  it('saves one row per pull request and head commit in the installation\'s workspace, a re-run rewriting it', async () => {
    const verdict: SavedVerdict = {
      ...PRD,
      prNumber: parsePr(31),
      headSha: 'a1'.repeat(20),
      state: 'not ready',
      passed: 4,
      headline: 'Not ready · 4 of 5 · No test was loosened: fail',
      checks: [{ id: 'ci', state: 'pass' }],
      criteria: [],
      checkUrl: 'https://github.com/acme/widgets/runs/9',
    };
    const db = recordingFetch([[{ id: 'ws-1' }], [{ id: 'v-1' }]]);
    expect(await storeOn(db.fetch).save(verdict)).toEqual({ saved: true, reason: null });
    const write = nth(db.requests, 1);
    expect([write.method, write.path, write.query.get('on_conflict')]).toEqual(['POST', '/rest/v1/ready_verdicts', 'workspace_id,repo,pr_number,head_sha']);
    expect(write.body).toMatchObject({ workspace_id: 'ws-1', repo: 'acme/widgets', prd: 7, pr_number: 31, head_sha: verdict.headSha, state: 'not ready', passed: 4, check_url: verdict.checkUrl });

    const nobody = recordingFetch([[]]);
    expect(await storeOn(nobody.fetch).save(verdict)).toEqual({ saved: false, reason: 'no workspace holds the installation 7' });
    expect(nobody.requests).toHaveLength(1);
  });
});

describe('readyStore — the e2e fallback\'s runner job, sent by the App (PRD 2898 s8)', () => {
  const LINE = `/omni:acceptance 7 --pr 31 --sha ${'a1'.repeat(20)}`;
  const ASKED = { installationId: 7, repository: 'Acme/Widgets', line: LINE };

  it('reads the latest job of the line the App itself sent, in the installation\'s workspace and the repository, in lower case', async () => {
    const db = recordingFetch([[{ id: 'ws-1' }], [{ status: 'done', log_tail: 'omni-acceptance: …', reason: null }]]);
    expect(await storeOn(db.fetch).appJob(ASKED)).toEqual({ status: 'done', logTail: 'omni-acceptance: …', reason: null });
    const read = nth(db.requests, 1);
    expect(read.path).toBe('/rest/v1/runner_jobs');
    expect([read.query.get('workspace_id'), read.query.get('repo'), read.query.get('line'), read.query.get('sent_by_app'), read.query.get('order')]).toEqual(['eq.ws-1', 'eq.acme/widgets', `eq.${LINE}`, 'not.is.null', 'queued_at.desc']);
  });

  it('reads none for an installation no workspace holds, or a line the App never queued', async () => {
    expect(await storeOn(recordingFetch([[]]).fetch).appJob(ASKED)).toBeNull();
    expect(await storeOn(recordingFetch([[{ id: 'ws-1' }], []]).fetch).appJob(ASKED)).toBeNull();
  });

  it('queues the line sent by the app, never in a person\'s name', async () => {
    const db = recordingFetch([[{ id: 'ws-1' }], [], [], [{ id: 'runner-1' }], [{ id: 'job-1' }]]);
    expect(await storeOn(db.fetch).queueApp(ASKED)).toEqual({ job: 'job-1', created: true, reason: null });
    const insert = nth(db.requests, 4);
    expect([insert.method, insert.path]).toEqual(['POST', '/rest/v1/runner_jobs']);
    expect(insert.body).toEqual({ workspace_id: 'ws-1', repo: 'acme/widgets', line: LINE, sent_by_app: 'omni-app' });
  });
});
