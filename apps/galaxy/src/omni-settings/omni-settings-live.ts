import 'server-only';
import { supabaseAs, supabaseEnv } from '../data/supabase-server';
import { githubStore } from '../dossier/github/server';
import { serverEnv } from '../env';
import { appCredentials, installUrl } from '../signup/github-app';
import type { OmniSettingsDeps } from './omni-settings.controller';
import { settingsGithub } from './omni-settings.github';
import { omniSettingsRepository } from './omni-settings.repository';
import { omniSettingsService } from './omni-settings.service';

// The Omni settings route's real dependencies: a Supabase client per call, acting as the caller's
// access token (never a service key), so row-level security decides which workspaces they read; GitHub
// is read as the Omni app. Without Supabase configured (the demo galaxy) every call answers 503.
export function omniSettingsDeps(): OmniSettingsDeps {
  const log = (line: string) => { console.error(line); };
  if (!supabaseEnv()) return { connect: null, log };
  const github = settingsGithub(appCredentials(), fetch, Date.now, githubStore());
  return {
    connect: (token) => {
      const client = supabaseAs(token);
      return { auth: client.auth, service: omniSettingsService(omniSettingsRepository(client), github) };
    },
    installLink: installUrl(serverEnv().githubAppSlug),
    log,
  };
}
