import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { curatedDefault } from 'omni-loop/kit/lib/omni-settings/curated.ts';
import { githubStore } from '../dossier/github/server';
import { appCredentials } from '../signup/github-app';
import type { SettingsFile } from './omni-settings.contract';
import { settingsGithub } from './omni-settings.github';
import { omniSettingsRepository } from './omni-settings.repository';
import { omniSettingsPagesService, type OmniSettingsPagesService } from './omni-settings.service';

// Settings → Playbook's real dependencies (PRD 2417, s6): the signed-in person's client (row-level
// security decides which workspace they read), GitHub read as the Omni app, and the kit's first
// default. A deployment with no App credentials answers null (the page says it could not read); a kit
// default that cannot be read here leaves the list to the settings repository's own pages, and logs it.

/** The kit's first default, or none when its templates are not in this deployment. */
function kitDefault(): SettingsFile[] {
  try {
    return curatedDefault();
  } catch (err) {
    console.error(`omni settings: the kit's first default could not be read (${err instanceof Error ? err.message : String(err)})`);
    return [];
  }
}

export function settingsPagesFor(db: Pick<SupabaseClient, 'from' | 'rpc'>): OmniSettingsPagesService | null {
  try {
    const github = settingsGithub(appCredentials(), fetch, Date.now, githubStore());
    return omniSettingsPagesService(omniSettingsRepository(db), github, kitDefault);
  } catch (err) {
    console.error(`omni settings: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}
