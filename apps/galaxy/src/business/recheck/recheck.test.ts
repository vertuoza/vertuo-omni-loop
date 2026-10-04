import { describe, expect, it, vi } from 'vitest';
import type { DraftRow } from '../draft/run';
import { recheckRoute, type RecheckDeps } from './recheck';
import { answerOf } from '../json.fake';

vi.mock('server-only', () => ({}));

// The weekly recheck with fakes (PRD 774, s4): refused without the secret; with it, every business with
// a confirmed claim is drafted again as a `recheck`, a failing workspace is skipped and the others still
// run, and a business with no confirmed claim is never read.

const SECRET = 'sunday-secret';

const row = (id: string, over: Partial<DraftRow> = {}): DraftRow => ({
  id, kind: 'recheck', state: 'running', started_at: '2026-09-27T22:00:00Z', finished_at: null, counts: {}, scanned: [], reason: null, ...over,
});

function fakes({ confirmed = ['ws-a', 'ws-b'], failStart = [] as string[], failList = false, running = [] as string[] } = {}) {
  const started: Array<[string, string]> = [];
  const ran: Array<[string, string]> = [];
  const deps: RecheckDeps = {
    secret: SECRET,
    businesses() {
      if (failList) return Promise.reject(new Error('the claims are unreadable'));
      return Promise.resolve(confirmed);
    },
    start(workspace) {
      if (failStart.includes(workspace)) return Promise.reject(new Error(`no business database for ${workspace}`));
      started.push([workspace, 'recheck']);
      return Promise.resolve(running.includes(workspace) ? row(`d-${workspace}`, { kind: 'draft' }) : row(`r-${workspace}`));
    },
    run(workspace, draft) {
      ran.push([workspace, draft]);
      return Promise.resolve();
    },
    now: () => '2026-09-27T22:00:01Z',
    log() {},
  };
  return { deps, started, ran };
}

const call = (auth?: string) =>
  new Request('https://galaxy.test/api/business/recheck', { method: 'POST', headers: auth ? { authorization: auth } : {} });

describe('POST /api/business/recheck', () => {
  it('refuses a call without the secret, and reads nothing', async () => {
    const { deps, started } = fakes();
    expect((await recheckRoute(call(), deps)).status).toBe(401);
    expect((await recheckRoute(call('Bearer wrong'), deps)).status).toBe(401);
    expect(started).toEqual([]);
  });

  it('refuses every call while the deployment has no secret', async () => {
    const { deps, started } = fakes();
    expect((await recheckRoute(call('Bearer '), { ...deps, secret: undefined })).status).toBe(401);
    expect((await recheckRoute(call(`Bearer ${SECRET}`), { ...deps, secret: undefined })).status).toBe(401);
    expect(started).toEqual([]);
  });

  it('drafts every business with a confirmed claim again, as a recheck', async () => {
    const { deps, started, ran } = fakes();
    const res = await recheckRoute(call(`Bearer ${SECRET}`), deps);
    expect(res.status).toBe(200);
    expect(started).toEqual([['ws-a', 'recheck'], ['ws-b', 'recheck']]);
    expect(ran).toEqual([['ws-a', 'r-ws-a'], ['ws-b', 'r-ws-b']]);
    expect(await res.json()).toEqual({ rechecked_at: '2026-09-27T22:00:01Z', rechecked: ['ws-a', 'ws-b'], skipped: [] });
  });

  it('skips a failing workspace, and still rechecks the others', async () => {
    const { deps, ran } = fakes({ confirmed: ['ws-a', 'ws-b', 'ws-c'], failStart: ['ws-b'] });
    const res = await recheckRoute(call(`Bearer ${SECRET}`), deps);
    expect(res.status).toBe(200);
    expect(ran.map(([ws]) => ws)).toEqual(['ws-a', 'ws-c']);
    const body = await answerOf(res);
    expect(body.rechecked).toEqual(['ws-a', 'ws-c']);
    expect(body.skipped).toEqual([{ workspace: 'ws-b', reason: 'no business database for ws-b' }]);
  });

  it('skips a workspace whose run fails, and still rechecks the others', async () => {
    const { deps } = fakes({ confirmed: ['ws-a', 'ws-b'] });
    const res = await recheckRoute(call(`Bearer ${SECRET}`), {
      ...deps,
      run(workspace) {
        if (workspace === 'ws-a') return Promise.reject(new Error('GitHub said no'));
        return Promise.resolve();
      },
    });
    const body = await answerOf(res);
    expect(body.rechecked).toEqual(['ws-b']);
    expect(body.skipped).toEqual([{ workspace: 'ws-a', reason: 'GitHub said no' }]);
  });

  it('skips a business whose draft is already running, and runs nothing twice', async () => {
    const { deps, ran } = fakes({ running: ['ws-a'] });
    const body = await answerOf(await recheckRoute(call(`Bearer ${SECRET}`), deps));
    expect(ran).toEqual([['ws-b', 'r-ws-b']]);
    expect(body.skipped).toEqual([{ workspace: 'ws-a', reason: 'a draft is already running' }]);
  });

  it('reads no business with no confirmed claim', async () => {
    const { deps, started } = fakes({ confirmed: [] });
    const body = await answerOf(await recheckRoute(call(`Bearer ${SECRET}`), deps));
    expect(started).toEqual([]);
    expect(body).toMatchObject({ rechecked: [], skipped: [] });
  });

  it('fails the run (500) when the businesses cannot be listed', async () => {
    const { deps } = fakes({ failList: true });
    expect((await recheckRoute(call(`Bearer ${SECRET}`), deps)).status).toBe(500);
  });
});

describe('the businesses a recheck reads', () => {
  it('are the workspaces holding a confirmed claim, each once', async () => {
    const { rechecked } = await import('./recheck');
    const asked: string[] = [];
    const db = {
      from(table: string) {
        asked.push(table);
        return {
          select(columns: string) {
            asked.push(columns);
            return {
              eq(column: string, value: string) {
                asked.push(`${column}=${value}`);
                return Promise.resolve({ data: [{ workspace_id: 'ws-b' }, { workspace_id: 'ws-a' }, { workspace_id: 'ws-b' }], error: null });
              },
            };
          },
        };
      },
    };
    expect(await rechecked(db)).toEqual(['ws-a', 'ws-b']);
    expect(asked).toEqual(['claims', 'workspace_id', 'state=confirmed']);
  });

  it('throw when a row is not a workspace\'s (PRD 1030)', async () => {
    const { rechecked } = await import('./recheck');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const db = { from: () => ({ select: () => ({ eq: () => Promise.resolve({ data: [{ workspace_id: null }], error: null }) }) }) };
    await expect(rechecked(db)).rejects.toThrow(/business\/recheck: claims: the answer does not parse: \[0\]\.workspace_id/);
  });

  it('throw when the claims cannot be read', async () => {
    const { rechecked } = await import('./recheck');
    const db = { from: () => ({ select: () => ({ eq: () => Promise.resolve({ data: null, error: { message: 'down' } }) }) }) };
    await expect(rechecked(db)).rejects.toThrow(/down/);
  });
});
