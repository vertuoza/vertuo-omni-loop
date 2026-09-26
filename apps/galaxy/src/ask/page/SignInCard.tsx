'use client';
import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

// Signed out on an ask page: the galaxy's Google sign-in (hd=vertuoza.com filters Google's account
// chooser; the sign-in hook and every policy enforce the domain), coming back to `returnPath`,
// which exchanges the code and goes back to the page (/ask/<id>/callback for a session).

type Supabase = { url: string; key: string };

export function SignInCard({ supabase, returnPath, error }: { supabase: Supabase; returnPath: string; error?: string | null }) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(error ?? null);

  async function signIn() {
    setBusy(true);
    setProblem(null);
    const { error: failed } = await createBrowserClient(supabase.url, supabase.key).auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}${returnPath}`, queryParams: { hd: 'vertuoza.com' } },
    });
    if (failed) {
      setProblem(`Google sign-in could not start: ${failed.message}`);
      setBusy(false);
    }
  }

  return (
    <div className="ask-col">
      <section className="ask-card" aria-labelledby="ask-signin-title">
        <h1 id="ask-signin-title">Sign in to answer Claude</h1>
        <p className="ask-muted">
          This page shows Claude&apos;s questions to the person who switched ask mode on. Sign in with the same
          Vertuoza Google account, and you come straight back here.
        </p>
        {problem && <p className="ask-error" role="alert">{problem}</p>}
        <button type="button" className="ask-button" onClick={signIn} disabled={busy}>
          {busy ? 'Opening Google…' : 'Sign in with Google'}
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
