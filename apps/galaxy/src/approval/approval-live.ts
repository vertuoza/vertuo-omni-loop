import 'server-only';
import { supabaseAs, supabaseEnv, supabaseServer } from '../data/supabase-server';
import { githubStore } from '../dossier/github/server';
import { serverEnv } from '../env';
import { appCredentials, installUrl } from '../signup/github-app';
import type { ApprovalDeps } from './approval-api';
import { approvedLabeler } from './label';

// The approval route's real dependencies (PRD 1299 s2), for /api/dossiers/approval: a Supabase client per
// call acting as the caller (a terminal's access token, or the page's own session), never a service key,
// so dossier_approve() and dossier_approval() check who calls; and the omni-loop App (GITHUB_APP_ID,
// GITHUB_APP_PRIVATE_KEY) to label an approved PRD's issue. Without Supabase configured every call
// answers 503; without the App, an approval is written and its label is skipped, said in the log.
export function approvalDeps(): ApprovalDeps {
  if (!supabaseEnv()) return { connect: null, session: () => Promise.resolve(null), label: () => Promise.resolve() };
  return {
    connect: supabaseAs,
    async session() {
      const db = await supabaseServer();
      const { data: { user } } = await db.auth.getUser();
      return user ? db : null;
    },
    label: (repo, prd) => approvedLabeler({ creds: appCredentials(), fetch, store: githubStore() })(repo, prd),
    installLink: installUrl(serverEnv().githubAppSlug),
  };
}
