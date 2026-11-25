import { z } from 'zod';
import { SeatSchema, type Seat } from '../api/supervisor.contract';
import { UNREACHABLE, call, type Called } from '../../runners/runners.client';

// The Supervisor page's call to its seat's route (PRD omni-loop-34 s5; ADR-0095): an owner pauses or resumes the
// seat, or sets its daily tokens, through PATCH /api/supervisor/seat, which acts as that owner (the database checks
// is_owner). The answer is parsed by the contract; a refusal is its `{error}` in plain words (the runners' client's
// `call`). Never `@supabase/*`: the page's session cookies go with the call.

/** The route's answer: the seat as it now stands. */
const Reply = z.object({ seat: SeatSchema });

/** Pauses or resumes the workspace's seat, or sets its daily tokens; an answer out of shape reads as unreachable. */
export function setSeat(workspace: string, change: { paused?: boolean; dailyTokens?: number }, fetcher: typeof fetch = fetch): Promise<Called<Seat>> {
  const read = (body: unknown) => Reply.parse(body).seat;
  return call(fetcher, '/api/supervisor/seat', { method: 'PATCH', body: JSON.stringify({ workspace, ...change }) }, read)
    .catch((): Called<Seat> => ({ ok: false, error: UNREACHABLE }));
}
