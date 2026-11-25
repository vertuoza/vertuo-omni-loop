import { describe, expect, it, vi } from 'vitest';
import { UNREACHABLE } from '../../runners/runners.client';
import { setSeat } from './seat.client';

// The page's call to PATCH /api/supervisor/seat (PRD omni-loop-34 s5), on a fake fetch.

const SEAT = { workspace: 'ws-1', runner: 'r1', placedBy: 'pierre', paused: true, dailyTokens: 5_000_000, tokensToday: 0, thinking: true, lastLookAt: null, missedLooks: 0 };
const answer = (status: number, body: unknown) => vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status })));

describe('setSeat', () => {
  it('sends the workspace and the change, and reads the seat back', async () => {
    const fetcher = answer(200, { seat: SEAT });
    expect(await setSeat('ws-1', { paused: true }, fetcher)).toEqual({ ok: true, value: SEAT });
    expect(fetcher).toHaveBeenCalledWith('/api/supervisor/seat', expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ workspace: 'ws-1', paused: true }) }));
  });

  it('gives the route\'s words for a refusal, and says unreachable otherwise', async () => {
    expect(await setSeat('ws-1', { paused: true }, answer(403, { error: 'Only an owner pauses the Supervisor.' }))).toEqual({ ok: false, error: 'Only an owner pauses the Supervisor.' });
    expect(await setSeat('ws-1', { paused: true }, answer(500, 'nope'))).toEqual({ ok: false, error: UNREACHABLE });
    expect(await setSeat('ws-1', { paused: true }, answer(200, { seat: 'x' }))).toEqual({ ok: false, error: UNREACHABLE });
    expect(await setSeat('ws-1', { paused: true }, vi.fn(() => Promise.reject(new Error('offline'))))).toEqual({ ok: false, error: UNREACHABLE });
  });
});
