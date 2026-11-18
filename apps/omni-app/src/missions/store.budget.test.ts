// The mission store's token budget (PRD 3040 s3), as the service role, never calling Supabase: each request recorded, each answer handed.
import { describe, expect, it } from 'vitest';
import { parseIssue, parsePrd } from 'omni-loop/kit/lib/ids.ts';
import { missionStore, type MissionRecord } from './store.ts';

const ID = '0b7c1f6e-3a52-4d8e-9f10-2c4b6a8d0e11';

type Recorded = { method: string; path: string; query: URLSearchParams; body: unknown };

/** A fetch that records each request and answers with the next of `answers` (a Response as is, anything else as JSON). */
function recordingFetch(answers: unknown[] = []) {
  const requests: Recorded[] = [];
  const fetch: typeof globalThis.fetch = (input, init = {}) =>
    new Promise((resolve) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      const body: unknown = typeof init.body === 'string' ? JSON.parse(init.body) : null;
      requests.push({ method: init.method ?? 'GET', path: url.pathname, query: url.searchParams, body });
      const answer: unknown = answers.shift() ?? [];
      resolve(answer instanceof Response ? answer : new Response(JSON.stringify(answer), { status: 200, headers: { 'content-type': 'application/json' } }));
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
  tokens: 2_000_000,
};

const stopRow = (over: Record<string, unknown> = {}) => ({
  id: 'stop-1', cap: 'mission', cap_tokens: 2_000_000, spent: 2_100_000, missions: [ID], answer: null, raised_to: null, created_at: '2027-01-26T08:00:00Z', answered_at: null, ...over,
});
const taken = new Response(JSON.stringify({ code: '23505', message: 'duplicate key value', details: null, hint: null }), { status: 409, headers: { 'content-type': 'application/json' } });

describe("missionStore — a mission's token budget (PRD 3040)", () => {
  it("reads the mission's budget from its mandate, and none when its mandate has none", async () => {
    const row = { id: ID, workspace_id: 'ws-1', repo: 'acme/widgets', fleet: 'night-shift', number: 12, title: 'Faster quotes', status: 'running', waiting_on: null, scope: { prds: [7], roadmaps: [] } };
    const db = recordingFetch([[{ ...row, mandate: { parallel: 2, tokens: 2_000_000 } }], [{ ...row, mandate: { parallel: 2 } }]]);
    const store = storeOn(db.fetch);
    expect((await store.mission(ID))?.tokens).toBe(2_000_000);
    expect(await store.mission(ID)).not.toHaveProperty('tokens');
  });

  it('reads what the mission and its fleet spent, the fleet cap, its stops and its own pauses and resumes', async () => {
    const db = recordingFetch([
      [{ daily_tokens: 5_000_000 }],
      2_100_000,
      [{ tokens: '3200000', oldest_end: '2027-01-25T14:30:00Z' }],
      [stopRow()],
      [stopRow({ id: 'stop-2', cap: 'fleet', cap_tokens: 3_000_000, spent: 3_200_000, missions: [ID, 'm-2'] })],
      [
        { kind: 'paused', actor: 'agent', at: '2027-01-26T08:30:00Z' },
        { kind: 'resumed', actor: 'ada', at: '2027-01-26T08:20:00Z' },
        { kind: 'paused', actor: 'grace', at: '2027-01-25T10:00:00Z' },
      ],
    ]);
    const read = await storeOn(db.fetch).budget(mission, new Date('2027-01-26T09:00:00Z'));
    expect(read).toEqual({
      missionSpent: 2_100_000,
      missionCap: 2_000_000,
      fleetSpent24h: 3_200_000,
      fleetCap: 5_000_000,
      oldestEnd: '2027-01-25T14:30:00Z',
      named: { id: 'stop-1', cap: 'mission', capTokens: 2_000_000, spent: 2_100_000, missions: [ID], answer: null, raisedTo: null, createdAt: '2027-01-26T08:00:00Z', answeredAt: null },
      open: { id: 'stop-2', cap: 'fleet', capTokens: 3_000_000, spent: 3_200_000, missions: [ID, 'm-2'], answer: null, raisedTo: null, createdAt: '2027-01-26T08:00:00Z', answeredAt: null },
      personPausedAt: '2027-01-25T10:00:00Z',
      personResumedAt: '2027-01-26T08:20:00Z',
      agentPausedAt: '2027-01-26T08:30:00Z',
    });
    expect(db.requests.map((one) => one.path)).toEqual([
      '/rest/v1/teams',
      '/rest/v1/rpc/mission_tokens',
      '/rest/v1/rpc/fleet_tokens_24h',
      '/rest/v1/mission_budget_stops',
      '/rest/v1/mission_budget_stops',
      '/rest/v1/mission_events',
    ]);
    expect(db.requests[0]?.query.get('name')).toBe('eq.night-shift');
    expect(db.requests[1]?.body).toEqual({ p_mission: ID });
    expect(db.requests[2]?.body).toEqual({ p_workspace: 'ws-1', p_fleet: 'night-shift', p_at: '2027-01-26T09:00:00.000Z' });
    expect(db.requests[3]?.query.get('missions')).toBe(`cs.{${ID}}`);
    expect(db.requests[4]?.query.get('answer')).toBe('is.null');
    expect(db.requests[5]?.query.get('prd')).toBe('is.null');
  });

  it('reads no cap, no stop and nothing spent as such', async () => {
    const db = recordingFetch([[], 0, [{ tokens: 0, oldest_end: null }], [], [], []]);
    const read = await storeOn(db.fetch).budget({ ...mission, tokens: null }, new Date('2027-01-26T09:00:00Z'));
    expect(read).toEqual({ missionSpent: 0, missionCap: null, fleetSpent24h: 0, fleetCap: null, oldestEnd: null, named: null, open: null, personPausedAt: null, personResumedAt: null, agentPausedAt: null });
  });

  it("names the fleet's missions that run or wait, the mission first", async () => {
    const db = recordingFetch([[{ id: 'm-2' }, { id: ID }, { id: 'm-3' }]]);
    expect(await storeOn(db.fetch).fleetMissions(mission)).toEqual([ID, 'm-2', 'm-3']);
    expect(db.requests[0]?.query.get('status')).toBe('in.(running,waiting)');
  });

  it('records a stop unanswered, or none when one of the same cap still waits', async () => {
    const db = recordingFetch([[{ id: 'stop-9' }], taken]);
    const store = storeOn(db.fetch);
    expect(await store.stop(mission, { cap: 'mission', capTokens: 2_000_000, spent: 2_100_000, missions: [ID] })).toBe('stop-9');
    expect(db.requests[0]?.body).toEqual({ workspace_id: 'ws-1', fleet: 'night-shift', cap: 'mission', mission_id: ID, cap_tokens: 2_000_000, spent: 2_100_000, missions: [ID] });
    expect(await store.stop(mission, { cap: 'fleet', capTokens: 3_000_000, spent: 3_200_000, missions: [ID, 'm-2'] })).toBeNull();
    expect(db.requests[1]?.body).toMatchObject({ cap: 'fleet', mission_id: null, missions: [ID, 'm-2'] });
  });

  it('pauses the missions a fleet stop names, only while they run or wait, and asks nothing for none', async () => {
    const db = recordingFetch([[{ id: 'm-2' }]]);
    const store = storeOn(db.fetch);
    await store.pause([], 'Paused');
    await store.pause(['m-2'], "Paused: budget reached · 3.2M of 3M tokens in the last 24 hours · this fleet's daily cap");
    expect(db.requests).toHaveLength(1);
    expect(db.requests[0]).toMatchObject({ method: 'PATCH', body: { status: 'paused', waiting_on: "Paused: budget reached · 3.2M of 3M tokens in the last 24 hours · this fleet's daily cap", next_wake_at: null } });
    expect(db.requests[0]?.query.get('status')).toBe('in.(running,waiting)');
  });
});
