'use client';
import { useState } from 'react';
import { GithubSignInCard, type SignInProps } from './GithubSignInCard';
import { signOutHere } from '../../data/sign-in.client';

// Signed out on an ask page: the galaxy's GitHub sign-in (PRD 359; src/data/sign-in-github.ts),
// coming back to `returnPath`, which exchanges the code and goes back to the page
// (/ask/<id>/callback for a session).

type Supabase = { url: string; key: string };

export function SignInCard(props: SignInProps) {
  return (
    <GithubSignInCard
      {...props}
      titleId="ask-signin-title"
      title="Sign in to answer Claude"
      text="This page shows Claude's questions to the person who switched ask mode on. Sign in with the same GitHub account, and you come straight back here."
    />
  );
}

/** Signed in with the wrong account: sign out here, and the page asks for the right one. */
export function SwitchAccount({ supabase }: { supabase: Supabase }) {
  const [busy, setBusy] = useState(false);
  async function switchAccount() {
    setBusy(true);
    await signOutHere(supabase);
    window.location.reload();
  }
  return (
    <button type="button" className="ask-button quiet" onClick={() => void switchAccount()} disabled={busy}>
      {busy ? 'Signing out…' : 'Sign in with another account'}
    </button>
  );
}
