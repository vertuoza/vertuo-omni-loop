'use client';
import { useState } from 'react';
import { startGithubSignIn } from '../data/sign-in-github';

// Signed out on the knowledge map: the galaxy's GitHub sign-in (PRD 359; src/data/sign-in-github.ts),
// coming back through /knowledge/callback, which exchanges the code, joins the workspaces of the
// person's GitHub orgs, and returns to the entry the address named.

type Supabase = { url: string; key: string };

export function KnowledgeSignIn({ supabase, returnPath, error }: { supabase: Supabase; returnPath: string; error?: string | null }) {
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
      <section className="ask-card" aria-labelledby="km-signin-title">
        <h1 id="km-signin-title">Sign in to read the knowledge map</h1>
        <p className="ask-muted">
          The map shows the repository&apos;s knowledge base to the crew. Sign in with your GitHub account, and you
          come straight back here.
        </p>
        {problem && <p className="ask-error" role="alert">{problem}</p>}
        <button type="button" className="ask-button" onClick={() => { void signIn(); }} disabled={busy}>
          {busy ? 'Opening GitHub…' : 'Sign in with GitHub'}
        </button>
      </section>
    </div>
  );
}
