'use client';
import { GithubSignInCard, type SignInProps } from '../ask/page/GithubSignInCard';

// Signed out on /app (PRD 328): only this card. The galaxy's GitHub sign-in (PRD 359;
// src/data/sign-in-github.ts), coming back through /app/callback, which exchanges the code, joins the
// workspaces of the person's GitHub orgs and returns to /app.

export function DashboardSignIn(props: SignInProps) {
  return (
    <GithubSignInCard
      {...props}
      titleId="dash-signin-title"
      title="Sign in to see your dashboard"
      text="Your dashboard shows your hero, your fleet and your season, what you merged this week, and the questions waiting for you. Sign in with your GitHub account, and you come straight back here."
    />
  );
}
