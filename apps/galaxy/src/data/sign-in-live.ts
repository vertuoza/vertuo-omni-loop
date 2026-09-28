import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { appCredentials, githubApp } from '../signup/github-app';
import type { SignupDeps } from '../signup/installation';
import { signupStore } from '../signup/store';
import { readGithubAccount } from './github-orgs';
import type { SignInDeps } from './sign-in';
import { joinByGithub } from './workspace';

// What a sign-in callback joins with in production: GitHub's API, and the service role's client
// (SUPABASE_SERVICE_ROLE_KEY, server only), the one role that may run join_workspaces_by_github().
// Without that key nobody joins by org: the sign-in still works, and the failure is logged (ADR 0044).
// Sign-up (PRD 359, src/signup/) adds GitHub as the omni-loop App reads it (GITHUB_APP_ID and
// GITHUB_APP_PRIVATE_KEY, server only) and the service role's sign-up writes. Each is read when a call
// needs it, so a deployment without them still signs people in.

/** The service role's client. Throws when this deployment has no service role key. */
export function serviceDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set on this deployment: nobody joins by GitHub org');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

const app = () => githubApp(appCredentials());
const store = () => signupStore(serviceDb());

export const signupDeps: SignupDeps = {
  installation: (id) => app().installation(id),
  orgInstallation: (org) => app().orgInstallation(org),
  userInstallation: (login) => app().userInstallation(login),
  createWorkspace: (userId, installation) => store().createWorkspace(userId, installation),
  pendingRequests: (userId) => store().pendingRequests(userId),
  recordRequest: (userId, org) => store().recordRequest(userId, org),
  dropRequest: (userId, org) => store().dropRequest(userId, org),
};

export const signInDeps: SignInDeps & { signup: SignupDeps } = {
  readGithub: (token) => readGithubAccount(token),
  joinByGithub: (userId, logins) => joinByGithub(serviceDb(), userId, logins),
  signup: signupDeps,
};
