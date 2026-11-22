'use client';
import { GithubSignInCard, type SignInProps } from '../ask/page/GithubSignInCard';

// Signed out on the Inbox (PRD omni-loop-22, s5): only this card. The galaxy's GitHub sign-in (PRD 359),
// coming back through /app/inbox/callback, which exchanges the code, joins the workspaces of the
// person's GitHub orgs and returns to the Inbox.

/** Where GitHub sends the person back after signing in on the Inbox. */
const INBOX_CALLBACK = '/app/inbox/callback';

export function InboxSignIn(props: Omit<SignInProps, 'returnPath'>) {
  return (
    <GithubSignInCard
      {...props}
      returnPath={INBOX_CALLBACK}
      titleId="inbox-signin-title"
      title="Sign in to see your Inbox"
      text="Your Inbox holds what waits on you: your agents’ questions, the PRDs to approve, the reviews to give. Sign in with your GitHub account, and you come straight back here."
    />
  );
}
