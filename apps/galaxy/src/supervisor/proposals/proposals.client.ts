import { DismissReplySchema, PressReplySchema, type Dismissed, type Pressed } from './proposals.contract';
import { UNREACHABLE, call, type Called } from '../../runners/runners.client';

// The Supervisor page's calls to press a suggestion and to say Not a problem (PRD omni-loop-34 s7; ADR-0095), as the
// signed-in owner: the session cookies go with each call, never `@supabase/*`. The answer is parsed by the contract; a
// refusal is its `{error}` in plain words (the runners' client's `call`).

/** Presses a suggestion: the press as it ended (done, refused with why, or failed). */
export function pressSuggestion(workspace: string, proposal: string, fetcher: typeof fetch = fetch): Promise<Called<Pressed>> {
  return call(fetcher, '/api/supervisor/proposals', { method: 'POST', body: JSON.stringify({ workspace, proposal }) }, (body) => PressReplySchema.parse(body).press)
    .catch((): Called<Pressed> => ({ ok: false, error: UNREACHABLE }));
}

/** Says Not a problem to a finding: it closes as dismissed. */
export function dismissFinding(workspace: string, finding: string, fetcher: typeof fetch = fetch): Promise<Called<Dismissed>> {
  return call(fetcher, '/api/supervisor/proposals/dismiss', { method: 'POST', body: JSON.stringify({ workspace, finding }) }, (body) => DismissReplySchema.parse(body).dismissed)
    .catch((): Called<Dismissed> => ({ ok: false, error: UNREACHABLE }));
}
