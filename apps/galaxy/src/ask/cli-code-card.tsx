'use client';
import { useGithubSignIn } from './page/GithubSignInCard';

// /ask/signin, for `omni signin`: the galaxy's GitHub sign-in (PRD 359; src/data/sign-in-github.ts),
// coming back through the auth callback's ask-cli branch, which joins the workspaces of the person's
// GitHub orgs and hands the terminal a sign-in of its own. This browser's own sign-in, if it has one,
// is left as it is. With `purpose=token` (PRD 1628), the same sign-in makes a kit token instead: the
// card names it, and says where it goes once made. The device page (/ask/device, PRD 1660) opens this
// same card once its code is confirmed; its signin sentence is cut to pass the word pass.

type Supabase = { url: string; key: string };

/** What the card asks for: the terminal's sign-in, or a kit token with its name, going to the terminal
 * (`omni setup-token`) or back to the page that asked. */
export type CardPurpose = { kind: 'signin' } | { kind: 'token'; name: string; days: number; toTerminal: boolean };

export function CliSignInCard({ supabase, returnPath, error, purpose = { kind: 'signin' } }: {
  supabase: Supabase; returnPath: string; error?: string | null; purpose?: CardPurpose;
}) {
  const { busy, problem, signIn } = useGithubSignIn({ supabase, returnPath, error });
  const token = purpose.kind === 'token' ? purpose : null;

  return (
    <div className="ask-col">
      <section className="ask-card" aria-labelledby="ask-cli-signin-title">
        <h1 id="ask-cli-signin-title">{token ? 'Make a terminal token' : 'Sign the terminal in'}</h1>
        {token ? (
          <p className="ask-muted">
            <strong>{token.name}</strong>, for {token.days} days. Sign in with your GitHub account: the token acts as you
            and is shown once, {token.toTerminal ? <>in the terminal, where <code>omni setup-token</code> waits.</> : 'back on your profile page.'}
          </p>
        ) : (
          <p className="ask-muted">The terminal gets its own sign-in.</p>
        )}
        {problem && <p className="ask-error" role="alert">{problem}</p>}
        <button type="button" className="ask-button" onClick={() => void signIn()} disabled={busy}>
          {busy ? 'Opening GitHub…' : problem ? 'Try again with GitHub' : 'Sign in with GitHub'}
        </button>
      </section>
    </div>
  );
}
