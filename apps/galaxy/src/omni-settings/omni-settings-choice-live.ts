import 'server-only';
import { log } from 'omni-loop/kit/lib/log/log.ts';
import { supabaseEnv, supabaseServer } from '../data/supabase-server';
import type { SettingsRepositoryDeps } from './omni-settings.controller';
import { omniSettingsRepository } from './omni-settings.repository';
import { omniSettingsChoiceService } from './omni-settings.service';

// The settings-repository route's real dependencies (PRD 2543, s3), for /api/omni-settings/settings-repository:
// the page's own session (the person's cookie), so the database's owner-only function decides who may and
// never a service key. Without Supabase configured every call answers 503.

export function settingsRepositoryDeps(): SettingsRepositoryDeps {
  const line = (message: string) => { log.error({ event: 'omni-settings', message }); };
  if (!supabaseEnv()) return { session: null, log: line };
  return {
    async session() {
      const db = await supabaseServer();
      const { data: { user } } = await db.auth.getUser();
      return user ? { service: omniSettingsChoiceService(omniSettingsRepository(db)) } : null;
    },
    log: line,
  };
}
