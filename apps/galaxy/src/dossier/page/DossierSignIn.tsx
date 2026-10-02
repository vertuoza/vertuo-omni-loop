'use client';
import { useState } from 'react';
import { startGithubSignIn } from '../../data/sign-in-github';

// Signed out on /prd/<id> or /prd (PRD 216): the galaxy's GitHub sign-in, as on the ask pages
// (PRD 359; src/data/sign-in-github.ts), coming back to the page's own callback, which exchanges the
// code, joins the workspaces of the person's GitHub orgs and goes back to the same page. `what` says
// which page asks: a dossier, or the history of them all.

type Supabase = { url: string; key: string };

const COPY = {
  dossier: {
    title: 'Sign in to read this PRD',
    body: 'This link opens a PRD\'s dossier: its before/after page, its spec, its plan and every version of each. It opens for the members of its workspace.',
  },
  visual: {
    title: 'Sign in to see your workspace\'s visual updates',
    body: 'This page lists every visual fix of your workspaces: its before/after page and the rounds of variations it was picked from.',
  },
  bug: {
    title: 'Sign in to see your workspace\'s bug fixes',
    body: 'This page lists every bug fix of your workspaces, with the record of each.',
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
    const failed = await startGithubSignIn(supabase, `${window.location.origin}${returnPath}`);
    if (failed) {
      setProblem(failed);
      setBusy(false);
    }
  }

  return (
    <div className="ask-col">
      <section className="ask-card" aria-labelledby="dossier-signin-title">
        <h1 id="dossier-signin-title">{COPY[what].title}</h1>
        <p className="ask-muted">
          {COPY[what].body} Sign in with your GitHub account, and you come straight back here.
        </p>
        {problem && <p className="ask-error" role="alert">{problem}</p>}
        <button type="button" className="ask-button" onClick={() => void signIn()} disabled={busy}>
          {busy ? 'Opening GitHub…' : 'Sign in with GitHub'}
        </button>
      </section>
    </div>
  );
}
