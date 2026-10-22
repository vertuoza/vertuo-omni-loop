import 'server-only';
import { log } from 'omni-loop/kit/lib/log/log.ts';
import { supabaseEnv, supabaseServer } from '../../data/supabase-server';
import type { ApiKeysDeps } from './api-keys.controller';
import { apiKeysRepository, type ApiKeysDb } from './api-keys.repository';
import { apiKeysService, type ApiKeysService } from './api-keys.service';
import { makeApiKey } from './secret';

// The API keys' real dependencies (PRD 2022 s1), for /api/api-keys and Settings › API keys: the rules
// over the signed-in person's own Supabase session, never a service key (ADR-0051), so the migration's
// functions decide who may make, list and revoke a key; secrets drawn with Web Crypto. Without Supabase
// configured (the demo galaxy) the routes answer 503.

/** The rules as the person `db` acts for. */
export const apiKeysServiceAs = (db: ApiKeysDb): ApiKeysService => apiKeysService(apiKeysRepository(db), () => makeApiKey());

/** The rules as the page's signed-in person, or null when nobody is signed in. */
async function signedInService(): Promise<ApiKeysService | null> {
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  return user ? apiKeysServiceAs(db) : null;
}

export function apiKeysDeps(): ApiKeysDeps {
  return {
    service: supabaseEnv() ? signedInService : null,
    log: (message) => { log.error({ event: 'api-keys', outcome: 'failed', message }); },
  };
}
