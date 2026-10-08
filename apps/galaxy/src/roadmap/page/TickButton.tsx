'use client';
import { useState } from 'react';
import { z } from 'zod';

// Mark as done on a roadmap's `person` prerequisite (PRD 1218, s7), shown to a member only: it asks
// POST /api/roadmaps/tick for GitHub's authorisation of the omni-loop App, then goes there; GitHub brings
// the person back to the tab, the tick posted on the roadmap's issue as them (src/roadmap/tick/tick.ts).
// A refusal says why, and nothing was posted.

const ENDPOINT = '/api/roadmaps/tick';

/** What the endpoint answers: the authorisation to follow, or why it refused; anything else, neither. */
const Answer = z.object({ authorize: z.string().optional(), error: z.string().optional() }).catch({});

export function TickButton({ roadmap, row }: { roadmap: string; row: string }) {
  const [state, setState] = useState<{ kind: 'idle' | 'going' } | { kind: 'error'; message: string }>({ kind: 'idle' });

  async function tick() {
    setState({ kind: 'going' });
    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ roadmap, row }),
      });
      const body = Answer.parse(await response.json().catch(() => null));
      if (response.ok && body.authorize) {
        window.location.assign(body.authorize);
        return;
      }
      setState({ kind: 'error', message: body.error ?? 'Nothing was posted: try again.' });
    } catch {
      setState({ kind: 'error', message: 'The page could not be reached, so nothing was posted. Try again in a moment.' });
    }
  }

  return (
    <p className="roadmap-tick">
      <button type="button" className="ask-button" onClick={() => void tick()} disabled={state.kind === 'going'}>Mark as done</button>
      {state.kind === 'going' ? <span className="ask-hint" role="status"> Opening GitHub…</span> : null}
      {state.kind === 'error' ? <span className="ask-hint" role="alert"> {state.message}</span> : null}
      <span className="roadmap-muted"> · it comments on the roadmap&apos;s issue as you, and the next tick takes up what it held.</span>
    </p>
  );
}
