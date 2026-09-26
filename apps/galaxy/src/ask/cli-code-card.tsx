'use client';
import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

// /ask/signin, for `omni signin`: the galaxy's Google sign-in (hd=vertuoza.com filters Google's
// account chooser; the sign-in hook and the callback enforce the domain), coming back through the
// auth callback's ask-cli branch, which hands the terminal a sign-in of its own. This browser's own
// sign-in, if it has one, is left as it is.

type Supabase = { url: string; key: string };

export function CliSignInCard({ supabase, returnPath, error }: { supabase: Supabase; returnPath: string; error?: string | null }) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(error ?? null);

  async function signIn() {
    setBusy(true);
    setProblem(null);
    const { error: failed } = await createBrowserClient(supabase.url, supabase.key).auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}${returnPath}`, queryParams: { hd: 'vertuoza.com', prompt: 'select_account' } },
    });
    if (failed) {
      setProblem(`Google sign-in could not start: ${failed.message}`);
      setBusy(false);
    }
  }

  return (
    <div className="ask-col">
      <section className="ask-card" aria-labelledby="ask-cli-signin-title">
        <h1 id="ask-cli-signin-title">Sign the terminal in</h1>
        <p className="ask-muted">
          <code>omni signin</code> is waiting in your terminal. Sign in with your Vertuoza Google account: the terminal
          gets a sign-in of its own, and this tab can be closed once it says so.
        </p>
        {problem && <p className="ask-error" role="alert">{problem}</p>}
        <button type="button" className="ask-button" onClick={signIn} disabled={busy}>
          {busy ? 'Opening Google…' : problem ? 'Try again with Google' : 'Sign in with Google'}
        </button>
      </section>
    </div>
  );
}
