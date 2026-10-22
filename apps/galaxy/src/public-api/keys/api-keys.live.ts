import 'server-only';
import { log } from 'omni-loop/kit/lib/log/log.ts';
import { supabaseEnv, supabaseServer } from '../../data/supabase-server';
import { serverEnv } from '../../env';
import { masterKey } from '../../jev/secret-box';
import type { ApiKeysDeps } from './api-keys.controller';
import { apiKeysRepository, type ApiKeysDb } from './api-keys.repository';
import { apiKeysService, type ApiKeysService, type GithubAppDeps } from './api-keys.service';
import { checkApp } from './github-app';
import { makeApiKey } from './secret';

// The API keys' real dependencies (PRD 2022 s1), for /api/api-keys and Settings › API keys: the rules
// over the signed-in person's own Supabase session, never a service key (ADR-0051), so the migration's
// functions decide who may make, list and revoke a key; secrets drawn with Web Crypto. Without Supabase
// configured (the demo galaxy) the routes answer 503.
//
// A key's GitHub App (PRD 2433 s4): its private key is sealed under SECRETS_MASTER_KEY, and the pair is
// checked with GitHub through the global fetch.

/** What attaching a GitHub App needs here: the master key, and GitHub. */
const githubAppDeps = (): GithubAppDeps => ({
  master: () => masterKey(serverEnv().secretsMasterKey),
  check: (credentials) => checkApp(credentials),
});

/** The rules as the person `db` acts for. */
export const apiKeysServiceAs = (db: ApiKeysDb): ApiKeysService => apiKeysService(apiKeysRepository(db), () => makeApiKey(), githubAppDeps());

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
