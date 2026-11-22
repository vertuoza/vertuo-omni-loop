'use client';
import { GithubSignInCard, type SignInProps } from '../ask/page/GithubSignInCard';
import { APP_CALLBACK } from '../dashboard/sign-in';

// Signed out on the Inbox (PRD omni-loop-22, s5): only this card. The galaxy's GitHub sign-in (PRD 359),
// coming back through the dashboard's own callback (/app/callback), which exchanges the code, joins the
// workspaces of the person's GitHub orgs and returns to /app, the Inbox first in its menu.

export function InboxSignIn(props: Omit<SignInProps, 'returnPath'>) {
  return (
    <GithubSignInCard
      {...props}
      returnPath={APP_CALLBACK}
      titleId="inbox-signin-title"
      title="Sign in to see your Inbox"
      text="Your Inbox holds what waits on you: your agents’ questions, the PRDs to approve, the reviews to give. Sign in with your GitHub account; you come back to the app, the Inbox first in its menu."
    />
  );
}
