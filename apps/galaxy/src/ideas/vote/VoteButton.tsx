'use client';
import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '../../../../../supabase/database.types.ts';
import { startGithubSignIn } from '../../data/sign-in-github';
import { clientEnv, type PublicSupabase } from '../../env.client';
import { IDEAS } from '../words';
import { press, signInProblem, type VotePorts, type VoteState } from './vote';
import { addVote, removeVote } from './store';
import { VOTE } from './words';
import './vote.css';

// A card's ▲ (PRD 1246, s3): the idea's count, pressed when the reader's own vote is in it. A press
// votes or takes the vote back when signed in, and starts a voter's GitHub sign-in when not
// (./vote.ts). The server renders it with the count ideas_board() answered, so the page reads the same
// with no script; the press needs one.

/** The browser's ports, on the galaxy's Supabase; null for the demo, which has none. */
function browserPorts(supabase: PublicSupabase | null): VotePorts | null {
  if (!supabase) return null;
  const db = createBrowserClient<Database>(supabase.url, supabase.key);
  return {
    origin: window.location.origin,
    signedIn: async () => (await db.auth.getSession()).data.session !== null,
    add: (ideaId) => addVote(db, ideaId),
    remove: (ideaId) => removeVote(db, ideaId),
    signIn: (redirectTo) => startGithubSignIn(supabase, redirectTo, { orgs: false }),
  };
}

export function VoteButton({ board, ideaId, title, votes, voted }: { board: string; ideaId: string; title: string } & VoteState) {
  const [state, setState] = useState<VoteState>({ votes, voted });
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function onPress() {
    setBusy(true);
    setProblem(null);
    const pressed = await press(browserPorts(clientEnv().supabase), board, ideaId, state);
    if (pressed.kind === 'signing-in') return;
    if (pressed.kind === 'counted') setState(pressed.state);
    else setProblem(pressed.problem);
    setBusy(false);
  }

  return (
    <>
      <button
        type="button"
        className={`idea-votes idea-vote${state.voted ? ' idea-voted' : ''}`}
        aria-label={IDEAS.votes(state.votes)}
        aria-pressed={state.voted}
        title={VOTE.press(title, state.voted)}
        disabled={busy}
        onClick={() => void onPress()}
      >
        <span aria-hidden="true">▲</span>{' '}<span aria-hidden="true">{state.votes}</span>
      </button>
      {problem ? <span className="idea-vote-problem" role="alert">{problem}</span> : null}
    </>
  );
}

/** The line a board shows once, when a sign-in to vote came back refused (read from its address). */
export function SignInProblem() {
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => { setProblem(signInProblem(window.location.search)); }, []);
  return problem ? <p className="idea-notice" role="alert">{problem}</p> : null;
}
