'use client';
import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

// Signed out on /prd/<id> or /prd (PRD 216): the galaxy's Google sign-in, as on the ask pages
// (hd=vertuoza.com filters Google's account chooser; the sign-in hook and every policy enforce the
// domain), coming back to the page's own callback, which exchanges the code and goes back to the same
// page. `what` says which page asks: a dossier, or the history of them all.

type Supabase = { url: string; key: string };

const COPY = {
  dossier: {
    title: 'Sign in to read this PRD',
    body: 'This link opens a PRD\'s dossier: its before/after page, its spec, its plan and every version of each. It opens for the members of its workspace.',
  },
  history: {
    title: 'Sign in to see your workspace\'s PRDs',
    body: 'This page lists the dossier of every PRD of your workspaces: its before/after page, its spec, its plan and the questions that shaped it.',
  },
} as const;

export function DossierSignIn({ supabase, returnPath, error, what = 'dossier' }: {
  supabase: Supabase; returnPath: string; error?: string | null; what?: keyof typeof COPY;
}) {
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
      <section className="ask-card" aria-labelledby="dossier-signin-title">
        <h1 id="dossier-signin-title">{COPY[what].title}</h1>
        <p className="ask-muted">
          {COPY[what].body} Sign in with your Vertuoza Google account, and you come straight back here.
        </p>
        {problem && <p className="ask-error" role="alert">{problem}</p>}
        <button type="button" className="ask-button" onClick={signIn} disabled={busy}>
          {busy ? 'Opening Google…' : 'Sign in with Google'}
        </button>
      </section>
    </div>
  );
}
