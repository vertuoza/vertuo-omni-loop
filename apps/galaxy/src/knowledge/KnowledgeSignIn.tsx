'use client';
import { GithubSignInCard, type SignInProps } from '../ask/page/GithubSignInCard';

// Signed out on the knowledge map: the galaxy's GitHub sign-in (PRD 359; src/data/sign-in-github.ts),
// coming back through /knowledge/callback, which exchanges the code, joins the workspaces of the
// person's GitHub orgs, and returns to the entry the address named.

export function KnowledgeSignIn(props: SignInProps) {
  return (
    <GithubSignInCard
      {...props}
      titleId="km-signin-title"
      title="Sign in to read the knowledge map"
      text="The map shows the repository's knowledge base to the crew. Sign in with your GitHub account, and you come straight back here."
    />
  );
}
