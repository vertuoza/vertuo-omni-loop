'use client';
import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { startGithubSignIn } from '../../data/sign-in-github';

// Signed out on an ask page: the galaxy's GitHub sign-in (PRD 359; src/data/sign-in-github.ts),
// coming back to `returnPath`, which exchanges the code and goes back to the page
// (/ask/<id>/callback for a session).

type Supabase = { url: string; key: string };

export function SignInCard({ supabase, returnPath, error }: { supabase: Supabase; returnPath: string; error?: string | null }) {
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
      <section className="ask-card" aria-labelledby="ask-signin-title">
        <h1 id="ask-signin-title">Sign in to answer Claude</h1>
        <p className="ask-muted">
          This page shows Claude&apos;s questions to the person who switched ask mode on. Sign in with the same
          GitHub account, and you come straight back here.
        </p>
        {problem && <p className="ask-error" role="alert">{problem}</p>}
        <button type="button" className="ask-button" onClick={signIn} disabled={busy}>
          {busy ? 'Opening GitHub…' : 'Sign in with GitHub'}
        </button>
      </section>
    </div>
  );
}

/** Signed in with the wrong account: sign out here, and the page asks for the right one. */
export function SwitchAccount({ supabase }: { supabase: Supabase }) {
  const [busy, setBusy] = useState(false);
  async function switchAccount() {
    setBusy(true);
    await createBrowserClient(supabase.url, supabase.key).auth.signOut();
    window.location.reload();
  }
  return (
    <button type="button" className="ask-button quiet" onClick={switchAccount} disabled={busy}>
      {busy ? 'Signing out…' : 'Sign in with another account'}
    </button>
  );
}
