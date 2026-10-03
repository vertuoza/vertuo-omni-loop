'use client';
import { useState } from 'react';
import { startGithubSignIn } from '../../data/sign-in-github';

// The card a signed-out page shows: its title, one muted paragraph, the line of a sign-in that failed,
// and the galaxy's GitHub sign-in (PRD 359; src/data/sign-in-github.ts), coming back to `returnPath`.
// The ask pages, /app and the knowledge map each give it their own title and text.

/** What a page hands its sign-in card: the project to sign in to, where to come back, a failure to show. */
export type SignInProps = { supabase: { url: string; key: string }; returnPath: string; error?: string | null | undefined };

/** The GitHub sign-in a card starts: busy while GitHub opens, and the line of a sign-in that failed. */
export function useGithubSignIn({ supabase, returnPath, error }: SignInProps) {
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
  return { busy, problem, signIn };
}

export function GithubSignInCard({ supabase, returnPath, error, titleId, title, text }: SignInProps & { titleId: string; title: string; text: string }) {
  const { busy, problem, signIn } = useGithubSignIn({ supabase, returnPath, error });

  return (
    <div className="ask-col">
      <section className="ask-card" aria-labelledby={titleId}>
        <h1 id={titleId}>{title}</h1>
        <p className="ask-muted">{text}</p>
        {problem && <p className="ask-error" role="alert">{problem}</p>}
        <button type="button" className="ask-button" onClick={() => void signIn()} disabled={busy}>
          {busy ? 'Opening GitHub…' : 'Sign in with GitHub'}
        </button>
      </section>
    </div>
  );
}
