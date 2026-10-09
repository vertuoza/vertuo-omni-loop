import 'server-only';
import { supabaseGithubStore, type GithubStore } from '@omni/github';
import { serviceDb } from '../../data/sign-in-live';
import { serverEnv, type GithubAppEnv } from '../../env';
import { appCredentials } from '../../signup/github-app';
import { githubReader, type ConceptReader, type FixReader, type GithubReader } from './reader';

// The one GitHub reader of this server (PRD 426), so its token and its 60-second cache are shared by
// every request. It holds the App's existing GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY, set for
// sign-up (PRD 359); without them, there is no reader, and every numbered dossier's stage is unknown.
// Its calls spend the installation's budget through the shared client (PRD 902, s1), whose ETags and
// budget live in Supabase, written with the service role as prd_stages is.

let reader: (GithubReader & FixReader & ConceptReader) | null | undefined;
let store: GithubStore | undefined;

/** The budget's store on the service role's client, made at its first call: without the key, each call
 * throws, and the client calls GitHub plain, saying so once. */
export function githubStore(): GithubStore {
  if (store) return store;
  let made: GithubStore | undefined;
  const db = () => {
    if (made) return made;
    const client = serviceDb();
    made = supabaseGithubStore({ etags: () => client.from('github_etags'), budget: () => client.from('github_budget') });
    return made;
  };
  store = {
    etag: (...args) => db().etag(...args),
    saveEtag: (...args) => db().saveEtag(...args),
    touchEtag: (...args) => db().touchEtag(...args),
    budget: (...args) => db().budget(...args),
    saveBudget: (...args) => db().saveBudget(...args),
    pause: (...args) => db().pause(...args),
  };
  return store;
}

export function dossierGithub(app: GithubAppEnv | null = serverEnv().githubApp): (GithubReader & FixReader & ConceptReader) | null {
  if (reader !== undefined) return reader;
  try {
    reader = githubReader(appCredentials(app), fetch, Date.now, githubStore());
  } catch (error) {
    console.error(`PRD page: ${error instanceof Error ? error.message : String(error)}`);
    reader = null;
  }
  return reader;
}
