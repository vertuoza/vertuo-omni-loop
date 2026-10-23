import 'server-only';
import { log } from 'omni-loop/kit/lib/log/log.ts';
import { supabaseEnv, supabaseServer } from '../data/supabase-server';
import { githubStore } from '../dossier/github/server';
import { serverEnv } from '../env';
import { loginOf } from '../nav/viewer';
import { appCredentials, installUrl } from '../signup/github-app';
import type { PlaybookProposalDeps } from './omni-settings.controller';
import { settingsPullRequests } from './omni-settings.pull-request';
import { omniSettingsRepository } from './omni-settings.repository';
import { omniSettingsEditService, type SettingsPullRequests } from './omni-settings.service';

// The proposal route's real dependencies (PRD 2417, s7), for /api/omni-settings/proposal: the page's own
// session (the person's cookie), so `is_owner()` decides who may and never a service key; GitHub written
// as the Omni app (GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY). A deployment with no App credentials answers
// every proposal as GitHub refusing it, and logs why. Without Supabase configured every call answers 503.

/** A writer that refuses every call, saying why: the App is not set up on this deployment. */
function noApp(error: unknown): SettingsPullRequests {
  const refused = () => Promise.reject(error instanceof Error ? error : new Error(String(error)));
  return { installationFor: refused, propose: refused };
}

function writer(): SettingsPullRequests {
  try {
    return settingsPullRequests(appCredentials(), fetch, Date.now, githubStore());
  } catch (error) {
    return noApp(error);
  }
}

export function playbookProposalDeps(): PlaybookProposalDeps {
  const line = (message: string) => { log.error({ event: 'omni-settings', message }); };
  if (!supabaseEnv()) return { session: null, log: line };
  return {
    async session() {
      const db = await supabaseServer();
      const { data: { user } } = await db.auth.getUser();
      return user ? { login: loginOf(user), service: omniSettingsEditService(omniSettingsRepository(db), writer()) } : null;
    },
    installLink: installUrl(serverEnv().githubAppSlug),
    log: line,
  };
}
