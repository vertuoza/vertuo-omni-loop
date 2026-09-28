'use client';
import { useState } from 'react';
import { startGithubSignIn } from '../data/sign-in-github';

// /ask/signin, for `omni signin`: the galaxy's GitHub sign-in (PRD 359; src/data/sign-in-github.ts),
// coming back through the auth callback's ask-cli branch, which joins the workspaces of the person's
// GitHub orgs and hands the terminal a sign-in of its own. This browser's own sign-in, if it has one,
// is left as it is.

type Supabase = { url: string; key: string };

export function CliSignInCard({ supabase, returnPath, error }: { supabase: Supabase; returnPath: string; error?: string | null }) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(error ?? null);

  async function signIn() {
    setBusy(true);
    setProblem(null);
    const failed = await startGithubSignIn(supabase, `${window.location.origin}${returnPath}`);
    if (failed) {
      setProblem(failed);
      setBusy(false);
    }
  }

  return (
    <div className="ask-col">
      <section className="ask-card" aria-labelledby="ask-cli-signin-title">
        <h1 id="ask-cli-signin-title">Sign the terminal in</h1>
        <p className="ask-muted">
          <code>omni signin</code> is waiting in your terminal. Sign in with your GitHub account: the terminal gets a
          sign-in of its own, and this tab can be closed once it says so.
        </p>
        {problem && <p className="ask-error" role="alert">{problem}</p>}
        <button type="button" className="ask-button" onClick={signIn} disabled={busy}>
          {busy ? 'Opening GitHub…' : problem ? 'Try again with GitHub' : 'Sign in with GitHub'}
        </button>
      </section>
    </div>
  );
}
