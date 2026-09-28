import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { readGithubAccount } from './github-orgs';
import type { SignInDeps } from './sign-in';
import { joinByGithub } from './workspace';

// What a sign-in callback joins with in production: GitHub's API, and the service role's client
// (SUPABASE_SERVICE_ROLE_KEY, server only), the one role that may run join_workspaces_by_github().
// Without that key nobody joins by org: the sign-in still works, and the failure is logged (ADR 0044).

function serviceDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set on this deployment: nobody joins by GitHub org');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

export const signInDeps: SignInDeps = {
  readGithub: (token) => readGithubAccount(token),
  joinByGithub: (userId, logins) => joinByGithub(serviceDb(), userId, logins),
};
