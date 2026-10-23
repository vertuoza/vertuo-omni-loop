import 'server-only';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { curatedFrom } from 'omni-loop/kit/lib/omni-settings/curated-forms.ts';
import { checkoutRoot } from '../data/load-knowledge';
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

/** The kit's templates folder, relative to the checkout's root. */
const KIT_TEMPLATES = 'kit/templates';

/** The kit's first default, read from the checkout's kit templates, or none when they are not in
 * this deployment. Read by path at request time: the kit's own templates loader finds its folder
 * through `import.meta.url`, which the app's bundler cannot resolve. */
function kitDefault(): SettingsFile[] {
  try {
    const root = checkoutRoot(process.cwd());
    if (root === null) throw new Error(`no checkout at or above ${process.cwd()}`);
    return curatedFrom((path) => readFileSync(join(/*turbopackIgnore: true*/ root, KIT_TEMPLATES, path), 'utf8'));
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
