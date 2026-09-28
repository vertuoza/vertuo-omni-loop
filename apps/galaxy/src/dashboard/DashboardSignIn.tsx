'use client';
import { useState } from 'react';
import { startGithubSignIn } from '../data/sign-in-github';

// Signed out on /app (PRD 328): only this card. The galaxy's GitHub sign-in (PRD 359;
// src/data/sign-in-github.ts), coming back through /app/callback, which exchanges the code, joins the
// workspaces of the person's GitHub orgs and returns to /app.

type Supabase = { url: string; key: string };

export function DashboardSignIn({ supabase, returnPath, error }: { supabase: Supabase; returnPath: string; error?: string | null }) {
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
      <section className="ask-card" aria-labelledby="dash-signin-title">
        <h1 id="dash-signin-title">Sign in to see your dashboard</h1>
        <p className="ask-muted">
          Your dashboard shows your hero, your fleet and your season, what you merged this week, and the questions
          waiting for you. Sign in with your GitHub account, and you come straight back here.
        </p>
        {problem && <p className="ask-error" role="alert">{problem}</p>}
        <button type="button" className="ask-button" onClick={signIn} disabled={busy}>
          {busy ? 'Opening GitHub…' : 'Sign in with GitHub'}
        </button>
      </section>
    </div>
  );
}
