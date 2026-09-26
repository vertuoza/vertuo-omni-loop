'use client';
import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

// Signed out on the knowledge map: the galaxy's Google sign-in (hd=vertuoza.com filters Google's
// account chooser; the sign-in hook and every policy enforce the domain), coming back through
// /knowledge/callback, which exchanges the code and returns to the entry the address named.

type Supabase = { url: string; key: string };

export function KnowledgeSignIn({ supabase, returnPath, error }: { supabase: Supabase; returnPath: string; error?: string | null }) {
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
      <section className="ask-card" aria-labelledby="km-signin-title">
        <h1 id="km-signin-title">Sign in to read the knowledge map</h1>
        <p className="ask-muted">
          The map shows the repository&apos;s knowledge base to the crew. Sign in with your Vertuoza Google account, and
          you come straight back here.
        </p>
        {problem && <p className="ask-error" role="alert">{problem}</p>}
        <button type="button" className="ask-button" onClick={signIn} disabled={busy}>
          {busy ? 'Opening Google…' : 'Sign in with Google'}
        </button>
      </section>
    </div>
  );
}
