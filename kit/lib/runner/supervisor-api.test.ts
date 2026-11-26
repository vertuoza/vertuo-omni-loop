// The seat's client of the Supervisor API (PRD omni-loop-34 s4): `runnerApi().supervisor` on a fake fetch. Whether the
// seat is here, the held `next`, the check-in: a 403 or 404 means the seat is not (or no longer) on this runner, never a
// refused sign-in.
import { describe, expect, it } from 'vitest';
import type { Tokens } from '../ask/schema.ts';
import { runnerApi } from './api.ts';
import type { SupervisorApi } from './api.ts';

const RUNNER = '00000000-0000-4000-8000-000000000900';
const SEAT = { workspace: 'w', runner: RUNNER, placedBy: 'u', paused: false, dailyTokens: 5_000_000, tokensToday: 0, thinking: true, lastLookAt: null, missedLooks: 0 };

function client(answer: (url: string) => Response): { api: SupervisorApi; calls: { url: string; init: RequestInit }[] } {
  const calls: { url: string; init: RequestInit }[] = [];
  const held: Record<string, Tokens> = { 'omni.test': { access_token: 'access-1', refresh_token: 'refresh-1' } };
  const { supervisor } = runnerApi({
    askUrl: 'https://omni.test/',
    tokens: { read: (host) => held[host] ?? null, write: (host, tokens) => { held[host] = tokens; } },
    fetch: (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return Promise.resolve(answer(url));
    },
  });
  if (supervisor === undefined) throw new Error('no supervisor client');
  return { api: supervisor, calls };
}

describe('runnerApi().supervisor', () => {
  it('reads the seat when this runner holds it, and none on a 403 (no seat here) or a 404 (an app without the routes)', async () => {
    const here = client(() => Response.json({ seat: SEAT }));
    expect(await here.api.seat(RUNNER)).toMatchObject({ runner: RUNNER, thinking: true });
    expect(here.calls[0]?.url).toBe(`https://omni.test/api/supervisor/seat?runner=${RUNNER}`);
    expect(here.calls[0]?.init).toMatchObject({ method: 'GET', headers: { authorization: 'Bearer access-1' } });
    for (const status of [403, 404]) expect(await client(() => Response.json({ error: 'no' }, { status })).api.seat(RUNNER)).toBeNull();
  });

  it('waits on next with since, answers nothing on 204, and `moved` once the seat left', async () => {
    const woke = client(() => Response.json({ at: '2026-11-25T08:00:10Z', wake: { signals: 1, messages: 0, presses: 0 }, seat: SEAT }));
    expect(await woke.api.next(RUNNER, '2026-11-25T08:00:00Z')).toMatchObject({ at: '2026-11-25T08:00:10Z', wake: { signals: 1 } });
    expect(woke.calls[0]?.url).toBe(`https://omni.test/api/supervisor/next?runner=${RUNNER}&since=2026-11-25T08%3A00%3A00Z`);
    expect(await client(() => new Response(null, { status: 204 })).api.next(RUNNER, null)).toBeNull();
    expect(await client(() => Response.json({ error: 'no seat' }, { status: 403 })).api.next(RUNNER, null)).toBe('moved');
  });

  it('checks in with its tokens on the seat route', async () => {
    const { api, calls } = client(() => Response.json({ seat: { ...SEAT, tokensToday: 1200 } }));
    expect((await api.checkIn(RUNNER, 1200)).tokensToday).toBe(1200);
    expect(calls[0]?.init).toMatchObject({ method: 'POST', body: JSON.stringify({ tokens: 1200 }) });
  });
});
