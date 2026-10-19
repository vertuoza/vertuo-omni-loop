import 'server-only';
import { serviceDb } from '../data/sign-in-live';
import { supabaseEnv, supabaseServer } from '../data/supabase-server';
import { githubStore } from '../dossier/github/server';
import { conceptFactsStore } from '../fixes/facts/store';
import { loginOf } from '../nav/viewer';
import { appCredentials } from '../signup/github-app';
import { keepIssue, storedFacts, type DoneDeps } from './done';
import { issueSetter } from './done-github';

// The done route's real dependencies (PRD 2213, s3), for /api/concepts/done: the page's own session, so the
// caller is checked as themselves and never with a service key; the omni-loop App (GITHUB_APP_ID,
// GITHUB_APP_PRIVATE_KEY) to close or reopen the issue; and the service role to store what GitHub answered,
// as the page's refresh does. Without Supabase configured every call answers 503.
export function doneDeps(): DoneDeps {
  if (!supabaseEnv()) return { session: null, facts: () => Promise.resolve(null), setIssue: () => Promise.reject(new Error('no database')), keep: () => Promise.resolve() };
  return {
    async session() {
      const db = await supabaseServer();
      const { data: { user } } = await db.auth.getUser();
      return user ? { db, login: loginOf(user) } : null;
    },
    facts: storedFacts,
    setIssue: (repo, issue, done, login) => issueSetter({ creds: appCredentials(), fetch, store: githubStore() })(repo, issue, done, login),
    keep: (concept, issue) => keepIssue(conceptFactsStore(serviceDb()))(concept, issue),
  };
}
