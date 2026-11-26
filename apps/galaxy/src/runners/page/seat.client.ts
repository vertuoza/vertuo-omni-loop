import { z } from 'zod';
import { SeatSchema, type Seat } from '../../supervisor/api/supervisor.contract';
import { UNREACHABLE, call, type Called } from '../runners.client';

// The Runners page's call to the Supervisor's seat route (PRD omni-loop-34 s8; ADR-0095): an owner places the seat on a
// runner of the workspace, or moves it there, through POST /api/supervisor/seat, which acts as that owner (the database
// checks is_owner and that the runner is the workspace's). Never `@supabase/*`: the page's session cookies go with it.

const Reply = z.object({ seat: SeatSchema });

/** Places the workspace's seat on `runner`, or moves it there; an answer out of shape reads as unreachable. */
export function placeSeat(workspace: string, runner: string, fetcher: typeof fetch = fetch): Promise<Called<Seat>> {
  return call(fetcher, '/api/supervisor/seat', { method: 'POST', body: JSON.stringify({ workspace, runner }) }, (body) => Reply.parse(body).seat)
    .catch((): Called<Seat> => ({ ok: false, error: UNREACHABLE }));
}
