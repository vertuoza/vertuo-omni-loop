// The mission's store and the QA pair (PRD 3001 s4): a QA job's verdict read from its log's record line alone, and the QA pair's
// jobs sent under their keys. Against a recording fetch, never Supabase.
import { describe, expect, it } from 'vitest';
import { assertDefined } from 'omni-loop/kit/test/assert.ts';
import { parseIssue, parsePrd } from 'omni-loop/kit/lib/ids.ts';
import { missionStore, type MissionRecord } from './store.ts';

const ID = '0b7c1f6e-3a52-4d8e-9f10-2c4b6a8d0e11';
const COMMENT = 'https://github.com/acme/widgets/pull/12#issuecomment-77';

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

const storeOn = (fetch: typeof globalThis.fetch) => missionStore({ url: 'https://db.example', key: 'service-key', fetch });

const mission: MissionRecord = {
  id: ID,
  workspace: 'ws-1',
  repo: 'acme/widgets',
  fleet: 'night-shift',
  number: parseIssue(12),
  title: 'Faster quotes',
  level: 'with-you',
  status: 'running',
  waitingOn: null,
  parallel: 2,
  scope: { prds: [parsePrd(7)], roadmaps: [] },
};

const job = (id: string, over: Record<string, unknown> = {}) => ({ id, mission_key: null, resumes: null, status: 'done', outcome: null, reason: null, pr_url: null, ...over });

describe('missionStore — the QA pair (PRD 3001 s4)', () => {
  it('reads each QA job\'s verdict from its log\'s record line alone; none when it reads no verdict; nothing for a job still at work', async () => {
    const db = recordingFetch([
      [
        job('j-1', { mission_key: `mission:${ID}:prd:7:run:1`, outcome: 'review' }),
        job('j-2', { mission_key: `mission:${ID}:prd:7:run:1:qa:1` }),
        job('j-3', { mission_key: `mission:${ID}:prd:7:run:1:qa-fix:1:1`, outcome: 'pr-opened', pr_url: 'https://github.com/acme/widgets/pull/15' }),
        job('j-4', { mission_key: `mission:${ID}:prd:7:run:1:qa:2` }),
        job('j-5', { mission_key: `mission:${ID}:prd:8:run:1:qa:1`, status: 'running' }),
      ],
      [],
      [
        { id: 'j-2', log_tail: `checking the preview\nomni qa: posted round 1 (bugs, 2: #12 #13) on PR #12: ${COMMENT}` },
        { id: 'j-4', log_tail: 'it stopped before its verdict' },
      ],
    ]);
    const runs = await storeOn(db.fetch).runs(ID);
    expect(runs.map(({ prd, step, attempts }) => [prd, step, attempts.map((one) => one.checked)])).toEqual([
      [7, 'build', [undefined]],
      [7, 'qa:1', [{ verdict: { round: 1, verdict: 'bugs', bugs: [{ issue: 12 }, { issue: 13 }] }, count: 2, pr: 12, url: COMMENT }]],
      [7, 'qa-fix:1:1', [undefined]],
      [7, 'qa:2', [null]],
      [8, 'qa:1', [undefined]],
    ]);
    const logs = db.requests[2];
    assertDefined(logs, 'the log read');
    expect([logs.query.get('select'), logs.query.get('id')]).toEqual(['id,log_tail', 'in.(j-2,j-4)']);
  });

  it('sends QA\'s rounds and the Engineer\'s fix of a bug as the app, under their keys', async () => {
    const db = recordingFetch([[{ id: 'j-1' }], [{ id: 'j-2' }], [{ id: 'j-3' }]]);
    const store = storeOn(db.fetch);
    const own: MissionRecord = { ...mission, level: 'own-branch' };
    await store.send({ mission: own, prd: parsePrd(7), run: 1, step: 'qa:1', toFleet: true, skill: 'yolo' });
    await store.send({ mission: own, prd: parsePrd(7), run: 1, step: 'qa-fix:1:2', toFleet: true, skill: 'yolo', fix: { issue: parseIssue(13), branch: 'feat/faster-quotes' } });
    await store.send({ mission: own, prd: parsePrd(7), run: 1, step: 'qa:2', toFleet: true, skill: 'yolo' });
    expect(db.requests.map(({ body }) => body)).toMatchObject([
      { line: '/omni:qa 7', mission_key: `mission:${ID}:prd:7:run:1:qa:1`, sent_by_app: 'omni-app' },
      { line: '/omni:bug-fix #13 --base feat/faster-quotes', mission_key: `mission:${ID}:prd:7:run:1:qa-fix:1:2`, sent_by_app: 'omni-app' },
      { line: '/omni:qa 7 --round 2', mission_key: `mission:${ID}:prd:7:run:1:qa:2`, sent_by_app: 'omni-app' },
    ]);
  });
});
